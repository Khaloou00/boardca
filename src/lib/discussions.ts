// Couche données du module Discussions CA (Discord-style, piloté par le PCA).
// La confidentialité est portée par la RLS côté Supabase — ce fichier ne fait
// que refléter ce que le serveur autorise déjà ; aucune logique de sécurité ici.
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Discussion {
  id: string;
  titre: string;
  createdBy: string;
  statut: "ouverte" | "cloturee";
  secretaireVisible: boolean;
  createdAt: string;
  closedAt?: string;
}

export interface DiscussionFile {
  path: string;
  nom: string;
  type?: string;
  taille?: number;
}

export interface DiscussionMessage {
  id: string;
  discussionId: string;
  auteurId: string;
  contenu: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  fichier?: DiscussionFile;
  epingleAt?: string;
  epinglePar?: string;
}

export function mapDiscussion(row: Tables<"discussions">): Discussion {
  return {
    id: row.id,
    titre: row.titre,
    createdBy: row.created_by,
    statut: row.statut as Discussion["statut"],
    secretaireVisible: row.secretaire_visible,
    createdAt: row.created_at,
    closedAt: row.closed_at ?? undefined,
  };
}

export function mapMessage(row: Tables<"discussion_messages">): DiscussionMessage {
  return {
    id: row.id,
    discussionId: row.discussion_id,
    auteurId: row.auteur_id,
    contenu: row.contenu,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    fichier: row.fichier_path
      ? {
          path: row.fichier_path,
          nom: row.fichier_nom ?? "fichier",
          type: row.fichier_type ?? undefined,
          taille: row.fichier_taille ?? undefined,
        }
      : undefined,
    epingleAt: row.epingle_at ?? undefined,
    epinglePar: row.epingle_par ?? undefined,
  };
}

export async function fetchDiscussions(): Promise<Discussion[]> {
  const { data } = await supabase
    .from("discussions")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapDiscussion);
}

export async function fetchMessages(discussionId: string): Promise<DiscussionMessage[]> {
  const { data } = await supabase
    .from("discussion_messages")
    .select("*")
    .eq("discussion_id", discussionId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapMessage);
}

// Dernier message (non supprimé en priorité) par discussion, pour l'aperçu sidebar.
export async function fetchLastMessages(
  discussionIds: string[],
): Promise<Record<string, DiscussionMessage>> {
  if (discussionIds.length === 0) return {};
  const { data } = await supabase
    .from("discussion_messages")
    .select("*")
    .in("discussion_id", discussionIds)
    .order("created_at", { ascending: false });
  const byDiscussion: Record<string, DiscussionMessage> = {};
  for (const row of data ?? []) {
    if (!byDiscussion[row.discussion_id]) byDiscussion[row.discussion_id] = mapMessage(row);
  }
  return byDiscussion;
}

export async function createDiscussion(titre: string, createdBy: string): Promise<string> {
  const { data, error } = await supabase
    .from("discussions")
    .insert({ titre, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function sendMessage(
  discussionId: string,
  auteurId: string,
  contenu: string,
  fichier?: DiscussionFile,
) {
  const { error } = await supabase.from("discussion_messages").insert({
    discussion_id: discussionId,
    auteur_id: auteurId,
    // Un message-fichier stocke le nom du fichier comme contenu (la contrainte
    // char_length >= 1 sur contenu ne permet pas un contenu vide).
    contenu: contenu.trim() || fichier?.nom || "Fichier",
    fichier_path: fichier?.path,
    fichier_nom: fichier?.nom,
    fichier_type: fichier?.type,
    fichier_taille: fichier?.taille,
  });
  if (error) throw error;
}

// Upload d'un fichier de discussion dans le bucket privé (dossier discussions/).
// RLS : réservé aux membres du CA (voir migration 015). Renvoie les métadonnées
// à joindre au message.
export async function uploadDiscussionFile(
  discussionId: string,
  file: File,
): Promise<DiscussionFile> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `discussions/${discussionId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("boardca-docs").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return { path, nom: file.name, type: file.type || undefined, taille: file.size };
}

// URL signée (bucket privé) pour consulter/télécharger une pièce jointe.
export async function getFileSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from("boardca-docs").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

// Épinglage — PCA only (RPC, garde is_pca() interne, message FR utilisateur-final).
export async function pinMessage(messageId: string, pinned: boolean) {
  const { error } = await supabase.rpc("pin_message", {
    p_message_id: messageId,
    p_pinned: pinned,
  });
  if (error) throw error;
}

export async function editMessage(messageId: string, contenu: string) {
  const { error } = await supabase
    .from("discussion_messages")
    .update({ contenu, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

export async function softDeleteMessage(messageId: string) {
  const { error } = await supabase
    .from("discussion_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

// RPC — PCA only (vérifié côté serveur, message d'erreur FR déjà utilisateur-final).
export async function closeDiscussion(discussionId: string) {
  const { error } = await supabase.rpc("close_discussion", { p_discussion_id: discussionId });
  if (error) throw error;
}

export async function setDiscussionVisibility(discussionId: string, visible: boolean) {
  const { error } = await supabase.rpc("set_discussion_visibility", {
    p_discussion_id: discussionId,
    p_visible: visible,
  });
  if (error) throw error;
}

// ─── REALTIME ───────────────────────────────────────────────────
// Realtime respecte la RLS SELECT : un abonné ne reçoit que ce que sa policy
// autorise (voir PCA_DISCUSSIONS_DB.md §5). Couper secretaire_visible coupe donc
// le flux de la Secrétaire côté serveur, indépendamment de ce composant.

// Resynchro à chaque (re)connexion des canaux ci-dessous : le tenant Realtime
// (free tier) se coupe après inactivité et ne rejoue pas les événements
// manqués pendant la coupure (voir src/lib/notifications.ts).
export function subscribeDiscussionsList(onChange: () => void): () => void {
  const channel = supabase
    .channel("discussions:list")
    .on("postgres_changes", { event: "*", schema: "public", table: "discussions" }, onChange)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onChange();
    });
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeDiscussionRow(
  discussionId: string,
  onChange: (row: Tables<"discussions"> | null) => void,
): () => void {
  const resync = async () => {
    const { data } = await supabase
      .from("discussions")
      .select("*")
      .eq("id", discussionId)
      .maybeSingle();
    onChange(data ?? null);
  };
  const channel = supabase
    .channel(`discussions:row:${discussionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "discussions", filter: `id=eq.${discussionId}` },
      (payload) => {
        if (payload.eventType === "DELETE") onChange(null);
        else onChange(payload.new as Tables<"discussions">);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") resync();
    });
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeMessages(
  discussionId: string,
  onInsert: (row: Tables<"discussion_messages">) => void,
  onUpdate: (row: Tables<"discussion_messages">) => void,
  // Appelé à chaque (re)connexion du canal — un message posté pendant une
  // coupure Realtime n'est jamais rejoué par onInsert/onUpdate, il faut
  // recharger la conversation entière pour le récupérer.
  onResync?: () => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`discussions:messages:${discussionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "discussion_messages",
        filter: `discussion_id=eq.${discussionId}`,
      },
      (payload) => onInsert(payload.new as Tables<"discussion_messages">),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "discussion_messages",
        filter: `discussion_id=eq.${discussionId}`,
      },
      (payload) => onUpdate(payload.new as Tables<"discussion_messages">),
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onResync?.();
    });
  return () => {
    supabase.removeChannel(channel);
  };
}
