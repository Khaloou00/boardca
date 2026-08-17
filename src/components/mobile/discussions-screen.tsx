import { useEffect, useMemo, useRef, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import {
  type Discussion,
  type DiscussionMessage,
  fetchDiscussions,
  fetchMessages,
  fetchLastMessages,
  createDiscussion,
  sendMessage,
  editMessage,
  softDeleteMessage,
  closeDiscussion,
  uploadDiscussionFile,
  getFileSignedUrl,
  pinMessage,
  subscribeDiscussionsList,
  subscribeDiscussionRow,
  subscribeMessages,
  mapDiscussion,
} from "@/lib/discussions";
import { ROLE_LABELS } from "@/lib/role-labels";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Plus,
  Send,
  ArrowLeft,
  Crown,
  Lock,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  ChevronDown,
  Paperclip,
  Pin,
  PinOff,
  FileText,
  Download,
} from "lucide-react";

type LocalMsg = DiscussionMessage & { pending?: boolean };

function formatBytes(n?: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

// Pièce jointe : aperçu image inline (URL signée) ou carte fichier + téléchargement.
function FileAttachment({ msg }: { msg: DiscussionMessage }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!msg.fichier) return;
    let cancelled = false;
    getFileSignedUrl(msg.fichier.path).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [msg.fichier?.path]);
  if (!msg.fichier) return null;
  const isImage = (msg.fichier.type ?? "").startsWith("image/");
  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 block">
        <img
          src={url}
          alt={msg.fichier.nom}
          className="max-h-40 rounded-lg border border-slate-200 object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 max-w-[240px]"
    >
      <div className="h-8 w-8 rounded bg-navy/10 text-navy flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-navy truncate">{msg.fichier.nom}</div>
        <div className="text-[10px] text-slate-500">{formatBytes(msg.fichier.taille)}</div>
      </div>
      <Download className="h-4 w-4 text-slate-400 shrink-0" />
    </a>
  );
}

function TopBarLocal({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 flex items-center gap-3">
      {onBack ? (
        <button onClick={onBack} className="text-navy">
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : (
        <div className="w-5" />
      )}
      <div className="flex-1 text-center font-semibold text-navy truncate">{title}</div>
      <div className="w-5 flex justify-end">{right}</div>
    </div>
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, yesterday)) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24);
  return `${j} j`;
}

export function DiscussionsScreen() {
  const { profile, users } = useBoardStore(
    useShallow((s) => ({ profile: s.profile, users: s.users })),
  );
  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const isPCA = !!profile?.estPresidentCA;

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, DiscussionMessage>>({});
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRow, setActiveRow] = useState<Discussion | null>(null);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitre, setNewTitre] = useState("");
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [showJumpPill, setShowJumpPill] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userScrolledUp = useRef(false);

  const reloadList = async () => {
    const list = await fetchDiscussions();
    setDiscussions(list);
    const last = await fetchLastMessages(list.map((d) => d.id));
    setLastMessages(last);
    setListLoading(false);
  };

  useEffect(() => {
    reloadList();
    return subscribeDiscussionsList(() => reloadList());
  }, []);

  // Réactivité sécurité : la ligne active peut changer sous nos yeux (clôture,
  // bascule de visibilité). Pour un administrateur/PCA ceci ne coupe pas l'accès
  // (is_ca_member() reste vrai), mais on reflète l'état en direct (badges, composer).
  useEffect(() => {
    if (!activeId) return;
    return subscribeDiscussionRow(activeId, (row) => {
      if (!row) {
        setActiveRow(null);
        return;
      }
      setActiveRow(mapDiscussion(row));
    });
  }, [activeId]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    fetchMessages(activeId).then((msgs) => {
      setMessages(msgs);
      setMessagesLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    });
    return subscribeMessages(
      activeId,
      (row) => {
        const incoming = { ...row, id: row.id } as unknown as DiscussionMessage;
        const mapped: DiscussionMessage = {
          id: row.id,
          discussionId: row.discussion_id,
          auteurId: row.auteur_id,
          contenu: row.contenu,
          createdAt: row.created_at,
          editedAt: row.edited_at ?? undefined,
          deletedAt: row.deleted_at ?? undefined,
        };
        setMessages((prev) => {
          const withoutPending = prev.filter(
            (m) => !(m.pending && m.auteurId === mapped.auteurId && m.contenu === mapped.contenu),
          );
          if (withoutPending.some((m) => m.id === mapped.id)) return withoutPending;
          const next = [...withoutPending, mapped].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return next;
        });
        void incoming;
        if (userScrolledUp.current) setShowJumpPill(true);
        else
          requestAnimationFrame(() =>
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
          );
      },
      (row) => {
        const mapped: DiscussionMessage = {
          id: row.id,
          discussionId: row.discussion_id,
          auteurId: row.auteur_id,
          contenu: row.contenu,
          createdAt: row.created_at,
          editedAt: row.edited_at ?? undefined,
          deletedAt: row.deleted_at ?? undefined,
        };
        setMessages((prev) => prev.map((m) => (m.id === mapped.id ? { ...mapped, pending: false } : m)));
      },
      // Resynchro sur reconnexion du canal : récupère les messages postés
      // pendant une coupure Realtime, sans perturber le défilement en cours.
      () => {
        fetchMessages(activeId).then(setMessages);
      },
    );
  }, [activeId]);

  const openDiscussion = (d: Discussion) => {
    setActiveId(d.id);
    setActiveRow(d);
    userScrolledUp.current = false;
    setShowJumpPill(false);
  };

  const backToList = () => {
    setActiveId(null);
    setActiveRow(null);
    setMessages([]);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    userScrolledUp.current = !nearBottom;
    if (nearBottom) setShowJumpPill(false);
  };

  const jumpToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    userScrolledUp.current = false;
    setShowJumpPill(false);
  };

  const handleCreate = async () => {
    if (!profile || !newTitre.trim()) return;
    try {
      const id = await createDiscussion(newTitre.trim(), profile.id);
      setCreating(false);
      setNewTitre("");
      await reloadList();
      const created = (await fetchDiscussions()).find((d) => d.id === id);
      if (created) openDiscussion(created);
      toast.success("Discussion créée");
    } catch {
      toast.error("Échec de la création de la discussion");
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !profile || !activeId || sending) return;
    setDraft("");
    const optimistic: LocalMsg = {
      id: `temp-${Date.now()}`,
      discussionId: activeId,
      auteurId: profile.id,
      contenu: text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
    setSending(true);
    try {
      await sendMessage(activeId, profile.id, text);
    } catch {
      toast.error("Échec de l'envoi du message");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!file || !profile || !activeId || uploading) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (25 Mo maximum)");
      return;
    }
    setUploading(true);
    try {
      const fichier = await uploadDiscussionFile(activeId, file);
      await sendMessage(activeId, profile.id, draft.trim(), fichier);
      setDraft("");
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      );
    } catch {
      toast.error("Échec de l'envoi du fichier");
    } finally {
      setUploading(false);
    }
  };

  const handleTogglePin = async (msg: DiscussionMessage) => {
    try {
      await pinMessage(msg.id, !msg.epingleAt);
      toast.success(msg.epingleAt ? "Message désépinglé" : "Message épinglé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'épinglage");
    }
  };

  const handleClose = async () => {
    if (!activeId) return;
    try {
      await closeDiscussion(activeId);
      toast.success("Discussion clôturée");
      setCloseConfirm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la clôture");
    }
  };

  const handleEditSave = async (messageId: string) => {
    if (!editDraft.trim()) return;
    try {
      await editMessage(messageId, editDraft.trim());
      setEditingId(null);
    } catch {
      toast.error("Échec de la modification");
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await softDeleteMessage(messageId);
    } catch {
      toast.error("Échec de la suppression");
    }
  };

  const isClosed = activeRow?.statut === "cloturee";

  // ─── VUE LISTE ───────────────────────────────────────────────
  if (!activeId) {
    return (
      <div className="bg-[#F8FAFC] min-h-full pb-6">
        <TopBarLocal
          title="Discussions du CA"
          right={
            isPCA ? (
              <button onClick={() => setCreating(true)} aria-label="Nouvelle discussion">
                <Plus className="h-5 w-5 text-gold" />
              </button>
            ) : undefined
          }
        />
        <div className="px-4 py-3 space-y-2">
          {listLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 text-slate-300 animate-spin" />
            </div>
          ) : discussions.length === 0 ? (
            <div className="text-center py-14">
              <MessageSquare className="h-8 w-8 text-slate-300 mx-auto" />
              <div className="mt-2 text-sm text-slate-500">Aucune discussion pour l'instant.</div>
              {isPCA && (
                <div className="mt-1 text-xs text-slate-400">
                  Créez-en une avec le bouton + en haut à droite.
                </div>
              )}
            </div>
          ) : (
            discussions.map((d) => {
              const last = lastMessages[d.id];
              const author = last ? usersById[last.auteurId] : undefined;
              return (
                <button
                  key={d.id}
                  onClick={() => openDiscussion(d)}
                  className="w-full text-left bg-white rounded-xl p-3 border border-slate-100 flex items-start gap-3 active:scale-[0.98] transition"
                >
                  <div className="h-10 w-10 rounded-lg bg-navy text-gold flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="text-sm font-semibold text-navy truncate">{d.titre}</div>
                      {d.statut === "cloturee" && (
                        <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 font-bold shrink-0">
                          Clôturée
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {last ? (
                        <>
                          <span className="font-medium">{author?.nom.split(" ")[0] ?? "—"} : </span>
                          {last.deletedAt ? "message supprimé" : last.contenu}
                        </>
                      ) : (
                        "Aucun message"
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 shrink-0">
                    {last ? relativeTime(last.createdAt) : relativeTime(d.createdAt)}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle discussion</DialogTitle>
            </DialogHeader>
            <Input
              value={newTitre}
              onChange={(e) => setNewTitre(e.target.value)}
              placeholder="Titre de la discussion"
              maxLength={200}
            />
            <DialogFooter>
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 text-sm text-slate-500"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitre.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-semibold disabled:opacity-50"
              >
                Créer
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── VUE FIL (THREAD) ────────────────────────────────────────
  let lastDay = "";
  let lastAuthor = "";
  const pinnedMessages = messages.filter((m) => m.epingleAt && !m.deletedAt);

  const jumpToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="bg-[#F8FAFC] min-h-full flex flex-col" style={{ height: "100%" }}>
      <TopBarLocal
        title={activeRow?.titre ?? "Discussion"}
        onBack={backToList}
        right={
          isPCA ? (
            <button onClick={() => setCloseConfirm(true)} aria-label="Options" disabled={isClosed}>
              <Crown className={`h-5 w-5 ${isClosed ? "text-slate-300" : "text-gold"}`} />
            </button>
          ) : undefined
        }
      />

      {pinnedMessages.length > 0 && (
        <div className="px-4 py-2 bg-gold/5 border-b border-gold/20">
          <div className="text-[10px] uppercase tracking-wide text-gold font-bold flex items-center gap-1 mb-1">
            <Pin className="h-3 w-3" /> Épinglés ({pinnedMessages.length})
          </div>
          <div className="space-y-1">
            {pinnedMessages.map((m) => (
              <button
                key={m.id}
                onClick={() => jumpToMessage(m.id)}
                className="w-full text-left flex items-center gap-2 text-[12px] text-slate-700 rounded px-1.5 py-1 hover:bg-gold/10"
              >
                {m.fichier ? (
                  <FileText className="h-3.5 w-3.5 text-navy shrink-0" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 text-navy shrink-0" />
                )}
                <span className="font-medium text-navy shrink-0">
                  {usersById[m.auteurId]?.nom.split(" ")[0] ?? "—"} :
                </span>
                <span className="truncate">{m.fichier ? m.fichier.nom : m.contenu}</span>
                {isPCA && !isClosed && (
                  <PinOff
                    className="h-3.5 w-3.5 text-slate-400 hover:text-red-500 ml-auto shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(m);
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3 relative">
        {messagesLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 text-slate-300 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-14 text-sm text-slate-500">
            Aucun message. Lancez la discussion.
          </div>
        ) : (
          messages.map((m) => {
            const author = usersById[m.auteurId];
            const day = dayLabel(m.createdAt);
            const showDay = day !== lastDay;
            if (showDay) lastDay = day;
            const grouped = !showDay && lastAuthor === m.auteurId;
            lastAuthor = m.auteurId;
            const mine = m.auteurId === profile?.id;
            const isEditing = editingId === m.id;
            return (
              <div key={m.id} id={`msg-${m.id}`}>
                {showDay && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                      {day}
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}
                <div className={`group flex gap-2.5 ${grouped ? "mt-0.5" : "mt-3"} ${m.epingleAt ? "bg-gold/5 -mx-2 px-2 rounded-lg" : ""}`}>
                  <div className="w-8 shrink-0">
                    {!grouped && (
                      <div className="h-8 w-8 rounded-full bg-navy text-gold flex items-center justify-center text-[11px] font-bold">
                        {author?.initiales ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {!grouped && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[12.5px] font-semibold text-navy">
                          {author?.nom ?? "Membre"}
                        </span>
                        {author?.estPresidentCA && <Crown className="h-3 w-3 text-gold" />}
                        <span className="text-[10px] text-slate-400">
                          {new Date(m.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                    {isEditing ? (
                      <div className="mt-1 flex items-start gap-1.5">
                        <Textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          className="text-[13px] min-h-[36px] py-1.5"
                          autoFocus
                        />
                        <button onClick={() => handleEditSave(m.id)} className="text-emerald-600 mt-1.5">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 mt-1.5">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-[13px] text-slate-700">
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0 flex-1">
                            {m.deletedAt ? (
                              <span className="italic text-slate-400">message supprimé</span>
                            ) : (
                              <>
                                {(!m.fichier || m.contenu !== m.fichier.nom) && (
                                  <span className="whitespace-pre-wrap">
                                    {m.contenu}
                                    {m.editedAt && (
                                      <span className="text-[10px] text-slate-400 ml-1">(modifié)</span>
                                    )}
                                  </span>
                                )}
                                {m.pending && (
                                  <span className="text-[10px] text-slate-300 ml-1">envoi…</span>
                                )}
                                {m.fichier && <FileAttachment msg={m} />}
                              </>
                            )}
                          </div>
                          {!m.deletedAt && !m.pending && !isClosed && (isPCA || mine) && (
                            <span className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 shrink-0 mt-0.5">
                              {isPCA && (
                                <button
                                  onClick={() => handleTogglePin(m)}
                                  className={m.epingleAt ? "text-gold" : "text-slate-400 hover:text-gold"}
                                  title={m.epingleAt ? "Désépingler" : "Épingler"}
                                >
                                  {m.epingleAt ? (
                                    <PinOff className="h-3.5 w-3.5" />
                                  ) : (
                                    <Pin className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                              {mine && !m.fichier && (
                                <button
                                  onClick={() => {
                                    setEditingId(m.id);
                                    setEditDraft(m.contenu);
                                  }}
                                  className="text-slate-400 hover:text-navy"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                              {mine && (
                                <button
                                  onClick={() => handleDelete(m.id)}
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                        {m.epingleAt && !m.deletedAt && (
                          <div className="mt-0.5 text-[10px] text-gold flex items-center gap-1">
                            <Pin className="h-2.5 w-2.5" /> Épinglé
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showJumpPill && (
        <button
          onClick={jumpToBottom}
          className="absolute left-1/2 -translate-x-1/2 bottom-20 bg-navy text-white text-[11px] px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1"
        >
          Nouveaux messages <ChevronDown className="h-3 w-3" />
        </button>
      )}

      {profile?.role === "secretaire" ? (
        <div className="px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-2 text-[12px] text-slate-500">
          <Lock className="h-4 w-4" /> Lecture seule
        </div>
      ) : isClosed ? (
        <div className="px-4 py-3 bg-white border-t border-slate-100 text-[12px] text-slate-500 text-center">
          Discussion clôturée
          {activeRow?.closedAt ? ` le ${new Date(activeRow.closedAt).toLocaleDateString("fr-FR")}` : ""}
        </div>
      ) : (
        <div className="px-3 py-2.5 bg-white border-t border-slate-100 flex items-end gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          <button
            onClick={handlePickFile}
            disabled={uploading}
            title="Joindre un fichier"
            className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 flex items-center justify-center shrink-0 hover:bg-slate-50 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Écrire un message…"
            className="min-h-[38px] max-h-28 text-[13px] resize-none py-2"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="h-9 w-9 rounded-full bg-gold text-gold-foreground flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}

      <AlertDialog open={closeConfirm} onOpenChange={setCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer cette discussion ?</AlertDialogTitle>
            <AlertDialogDescription>
              Plus aucun message ne pourra être envoyé. La discussion reste consultable en lecture
              seule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clôturer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
