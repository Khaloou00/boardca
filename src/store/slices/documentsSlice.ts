import type { StateCreator } from "zustand";
import { sha256 } from "js-sha256";
import { supabase } from "@/lib/supabase";
import { mapDocument, mapBoardBook } from "@/lib/mappers";
import { genererBoardBookPdf, type SectionBoardBook } from "@/lib/board-book-pdf";
import type { BoardStore, DocumentsSlice } from "../types";

export const createDocumentsSlice: StateCreator<BoardStore, [], [], DocumentsSlice> = (
  set,
  get,
) => ({
  documents: [],
  boardBooks: [],
  documentsLoading: false,

  fetchDocuments: async (reunionId) => {
    set({ documentsLoading: true });
    const { data } = await supabase.from("documents").select("*").eq("reunion_id", reunionId);
    set((s) => ({
      documents: [
        ...s.documents.filter((d) => d.reunionId !== reunionId),
        ...(data ?? []).map(mapDocument),
      ],
      documentsLoading: false,
    }));
  },

  fetchBoardBook: async (reunionId) => {
    const { data } = await supabase
      .from("board_books")
      .select("*")
      .eq("reunion_id", reunionId)
      .maybeSingle();
    set((s) => ({
      boardBooks: [
        ...s.boardBooks.filter((b) => b.reunionId !== reunionId),
        ...(data ? [mapBoardBook(data)] : []),
      ],
    }));
  },

  addDocument: async (d) => {
    const { data, error } = await supabase
      .from("documents")
      .insert({
        reunion_id: d.reunionId,
        nom: d.nom,
        type: d.type,
        taille_bytes: d.tailleBytes,
        pages: d.pages,
        contenu: d.contenu,
        storage_path: d.storagePath,
        point_oj_id: d.pointOjId ?? null,
        uploaded_by: get().profile?.id,
      })
      .select("id")
      .single();
    if (error || !data) throw error;
    await get().logEvent("Upload document", d.nom);
    await get().fetchDocuments(d.reunionId);
    return data.id;
  },

  assignDocToPoint: async (docId, pointOjId) => {
    const doc = get().documents.find((d) => d.id === docId);
    const { error } = await supabase
      .from("documents")
      .update({ point_oj_id: pointOjId })
      .eq("id", docId);
    if (error) throw error;
    if (doc) await get().fetchDocuments(doc.reunionId);
  },

  removeDocument: async (id) => {
    const doc = get().documents.find((d) => d.id === id);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;
    if (doc) await get().fetchDocuments(doc.reunionId);
  },

  // Le Board Book N'EST PAS un document unique : c'est le FORMAT du recueil —
  // l'ordre du jour et, sous chaque point, les documents qui lui sont rattachés,
  // chacun restant son propre fichier que le membre ouvre séparément. « Générer »
  // revient donc à publier ce recueil : on scelle la liste des pièces (empreinte)
  // et on horodate la publication, ce qui notifie les membres du Conseil.
  generateBoardBook: async (reunionId) => {
    const reunion = get().reunions.find((r) => r.id === reunionId);
    if (!reunion) return null;
    await get().fetchDocuments(reunionId);
    const docs = get().documents.filter((d) => d.reunionId === reunionId);

    // Garde-fou : un point EXPLICITEMENT marqué obligatoire doit porter au moins
    // un document. Les autres points peuvent rester sans fichier.
    const obligatoires = reunion.ordreDuJour.filter((p) => p.obligatoire);
    const complet = obligatoires.every((p) => docs.some((d) => d.pointOjId === p.id));
    if (!complet) return null;

    // Le recueil = les documents RATTACHÉS à un point, dans l'ordre des points.
    // Les fichiers orphelins n'en font pas partie.
    const points = [...reunion.ordreDuJour].sort((a, b) => a.position - b.position);
    const rattaches = points.flatMap((p) => docs.filter((d) => d.pointOjId === p.id));

    const pages = rattaches.reduce((acc, d) => acc + (d.pages ?? 1), 0);
    const tailleBytes = rattaches.reduce((acc, d) => acc + d.tailleBytes, 0);

    // Empreinte des pièces publiées : elle change dès qu'un document entre ou sort
    // du recueil, et sert de preuve de ce qui a été mis à disposition du Conseil.
    const hash = sha256(
      rattaches
        .map((d) => d.id)
        .sort()
        .join("|") + reunionId,
    );

    const { data, error } = await supabase
      .from("board_books")
      .upsert(
        {
          reunion_id: reunionId,
          pages,
          taille_bytes: tailleBytes,
          // Aucun fichier compilé : le recueil n'a pas de PDF unique en Storage.
          storage_path: null,
          hash_sha256: hash,
          genere_par: get().profile?.id,
          genere_at: new Date().toISOString(),
        },
        { onConflict: "reunion_id" },
      )
      .select("*")
      .single();
    if (error || !data) throw error;
    await get().logEvent(
      "Publication du Board Book",
      `${reunion.titre} — ${rattaches.length} document(s) rattaché(s) à ${points.length} point(s)`,
    );
    const boardBook = mapBoardBook(data);
    set((s) => ({
      boardBooks: [...s.boardBooks.filter((b) => b.reunionId !== reunionId), boardBook],
    }));
    return boardBook;
  },

  // AJOUT (ne remplace pas `generateBoardBook`) : compile un PDF unique du recueil
  // — couverture, sommaire dynamique des points de l'ordre du jour, puis chaque
  // point suivi de ses fichiers rattachés. Le PDF est stocké dans `board_books.
  // storage_path` (colonne jusque-là inutilisée) ; le format « fichiers séparés »
  // reste disponible tel quel.
  generateBoardBookPdf: async (reunionId) => {
    const reunion = get().reunions.find((r) => r.id === reunionId);
    if (!reunion) return null;
    await get().fetchDocuments(reunionId);
    const docs = get().documents.filter((d) => d.reunionId === reunionId);

    // Sections = points de l'ordre du jour dans l'ordre, avec leurs documents.
    const points = [...reunion.ordreDuJour].sort((a, b) => a.position - b.position);
    const sections: SectionBoardBook[] = [];
    for (const p of points) {
      const rattaches = docs.filter((d) => d.pointOjId === p.id && d.storagePath);
      const fichiers = [];
      for (const d of rattaches) {
        const { data, error } = await supabase.storage
          .from("boardca-docs")
          .download(d.storagePath!);
        if (error || !data) continue; // fichier manquant : ignoré
        fichiers.push({ nom: d.nom, type: d.type, bytes: await data.arrayBuffer() });
      }
      sections.push({ titre: p.titre, position: p.position, fichiers });
    }

    const { bytes, pages } = await genererBoardBookPdf({
      titre: reunion.titre,
      date: reunion.date,
      sections,
    });

    // Chemin horodaté : le bucket n'a qu'une policy INSERT (pas d'UPDATE/DELETE),
    // un chemin fixe échouerait à la régénération.
    const chemin = `board-books/${reunionId}/${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("boardca-docs")
      .upload(chemin, new Blob([bytes as BlobPart], { type: "application/pdf" }), {
        contentType: "application/pdf",
      });
    if (upErr) throw upErr;

    const { data, error } = await supabase
      .from("board_books")
      .update({ storage_path: chemin, pages, taille_bytes: bytes.byteLength })
      .eq("reunion_id", reunionId)
      .select("*")
      .single();
    if (error || !data) throw error;
    await get().logEvent("PDF Board Book généré", `${reunion.titre} — ${pages} page(s)`);
    const boardBook = mapBoardBook(data);
    set((s) => ({
      boardBooks: [...s.boardBooks.filter((b) => b.reunionId !== reunionId), boardBook],
    }));
    return { boardBook, storagePath: chemin };
  },
});
