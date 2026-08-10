// AnnotationsPanel — extrait de `admin-app.tsx`.
import { useState } from "react";
import { TopBar } from "./ui-components";
import { deleteAnnotation, type DocAnnotation } from "@/lib/annotations";
import { AlertCircle, BookOpen, Lock, Search as SearchIcon, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export function AnnotationsPanel({
  annotations,
  docNomById,
  userId,
  onBack,
  onOpenAnnotation,
  onDeleted,
}: {
  annotations: DocAnnotation[];
  docNomById: Record<string, string>;
  userId: string;
  onBack: () => void;
  onOpenAnnotation: (a: DocAnnotation) => void;
  onDeleted: (id: string) => void;
}) {
  type Filtre = "all" | "highlight" | "comment" | "private" | "public";
  const [filter, setFilter] = useState<Filtre>("all");
  const [q, setQ] = useState("");

  const correspond = (a: DocAnnotation) =>
    filter === "all" ||
    (filter === "highlight" || filter === "comment" ? a.type === filter : a.visibility === filter);

  const filtered = annotations.filter(
    (a) =>
      correspond(a) && (!q || `${a.texte} ${a.note ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );

  const del = async (id: string) => {
    try {
      await deleteAnnotation(id);
      onDeleted(id);
      toast.success("Annotation supprimée");
    } catch {
      toast.error("Suppression impossible");
    }
  };

  const LIBELLE: Record<Filtre, string> = {
    all: "Toutes",
    highlight: "Surlignages",
    comment: "Commentaires",
    private: "Privées",
    public: "Partagées",
  };

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-6">
      <TopBar title="Mes annotations" onBack={onBack} />
      <div className="px-4 py-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="w-full bg-white rounded-lg pl-8 pr-3 py-2 text-[13px] border border-slate-200 outline-none"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(["all", "highlight", "comment", "private", "public"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${filter === k ? "bg-[#0D1B3E] text-white" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              {LIBELLE[k]}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
              <AlertCircle className="h-6 w-6 text-slate-300 mx-auto" />
              <div className="mt-2 text-sm font-semibold text-navy">Aucune annotation</div>
              <div className="mt-1 text-[11px] text-slate-500">
                Ouvrez un PDF du Board Book et sélectionnez un passage pour l'annoter.
              </div>
              <button
                onClick={onBack}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D1B3E] text-white text-[12px] font-semibold"
              >
                <BookOpen className="h-4 w-4" /> Ouvrir le Board Book
              </button>
            </div>
          ) : (
            filtered.map((a) => (
              <article key={a.id} className="bg-white rounded-xl p-3 border border-slate-100">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider">
                  {a.type === "highlight" ? (
                    <span className="text-yellow-700">Surlignage</span>
                  ) : (
                    <span className="text-blue-700">Commentaire</span>
                  )}
                  {a.visibility === "private" ? (
                    <span className="text-slate-500 flex items-center gap-1 normal-case font-semibold">
                      <Lock className="h-3 w-3" /> Privé
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1 normal-case font-semibold">
                      <Users className="h-3 w-3" /> Partagé
                    </span>
                  )}
                  <span className="ml-auto text-slate-400 normal-case font-normal">
                    {new Date(a.createdAt).toLocaleDateString("fr-FR")} · {a.auteurNom ?? "—"}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1 italic">« {a.texte} »</div>
                {a.note && (
                  <div className="mt-2 text-sm text-navy bg-slate-50 rounded-md p-2">{a.note}</div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-[10px] text-slate-400 truncate min-w-0 flex-1">
                    {a.boardBookId
                      ? "Board Book"
                      : (a.documentId && docNomById[a.documentId]) || "Document"}{" "}
                    · page {a.page}
                  </div>
                  <button
                    onClick={() => onOpenAnnotation(a)}
                    className="text-[11px] text-navy font-semibold px-2 py-1 rounded shrink-0"
                  >
                    Voir dans le document
                  </button>
                  {a.userId === userId && (
                    <button
                      onClick={() => del(a.id)}
                      aria-label="Supprimer l'annotation"
                      className="text-[11px] text-red-600 font-semibold p-1.5 rounded shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
