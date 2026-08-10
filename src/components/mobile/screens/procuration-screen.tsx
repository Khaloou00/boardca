// ProcurationScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState } from "react";
import { TopBar } from "../shared/ui-components";
import { type View } from "../shared/view-state";
import { ROLE_LABELS } from "@/lib/role-labels";
import { CheckCircle2, Copy, Loader2, Mail, Search as SearchIcon, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useMobileSession } from "../shared/mobile-session";

export function ProcurationScreen({ nav }: { nav: (v: View) => void }) {
  const {
    addProcuration,
    chargerMesDelegations,
    confirmConvocation,
    convocationReunionId,
    inviteExterneResultat,
    inviterExterne,
    presidentReunion,
    profile,
    realReunions,
    realUsers,
    requireOnline,
    setInviteExterneResultat,
    setProcurationSent,
  } = useMobileSession();

  const [recherche, setRecherche] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formInvite, setFormInvite] = useState(false);
  const [prenom, setPrenom] = useState("");
  const [nomInvite, setNomInvite] = useState("");
  const [emailInvite, setEmailInvite] = useState("");
  const [motif, setMotif] = useState("");
  const [busyInvite, setBusyInvite] = useState(false);
  // Vit dans MobileAdminApp, pas ici — voir le commentaire à sa déclaration
  // (piège de remount de ce fichier).
  const envoyee = inviteExterneResultat;

  const reunion = realReunions.find((r) => r.id === convocationReunionId) ?? presidentReunion;
  const titreSeance = reunion?.titre ?? "cette séance";

  // Toute personne du système sauf le super_admin et le PCA titulaire — et
  // moi-même. Inclut la Secrétaire et les invités déjà validés lors d'une
  // réunion précédente : les choisir ne crée rien, juste une procuration.
  const eligibles = realUsers.filter(
    (u) => u.role !== "super_admin" && !u.estPresidentCA && u.id !== profile?.id,
  );
  const q = recherche.trim().toLowerCase();
  const filtres = q
    ? eligibles.filter(
        (u) => u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
    : eligibles;
  const ressembleAUnEmail = q.includes("@") && q.includes(".");
  const aucunResultat = filtres.length === 0;

  const choisir = async (u: { id: string; nom: string }) => {
    if (!convocationReunionId || !profile) return;
    if (!requireOnline("Désignation d'un mandataire")) return;
    setBusyId(u.id);
    try {
      const { emailSent } = await addProcuration(convocationReunionId, profile.id, u.id);
      await confirmConvocation(convocationReunionId, profile.id, "excused");
      await chargerMesDelegations();
      setProcurationSent(true);
      toast.success("Mandataire désigné", {
        description: emailSent
          ? `${u.nom} peut désormais voter, signer et scanner votre présence à votre place — il/elle a été alerté(e) par email.`
          : `${u.nom} peut désormais voter, signer et scanner votre présence à votre place. L'email d'alerte n'a pas pu être envoyé — prévenez-le/la directement.`,
      });
      nav({ tab: "home" });
    } catch (e) {
      toast.error("Échec de la désignation", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  const ouvrirFormInvite = () => {
    setEmailInvite(ressembleAUnEmail ? recherche.trim() : "");
    setPrenom("");
    setNomInvite("");
    setMotif("");
    setFormInvite(true);
  };

  const inviterPersonne = async () => {
    if (!requireOnline("Invitation d'un mandataire")) return;
    if (!nomInvite.trim() || !prenom.trim() || !emailInvite.trim()) {
      return toast.error("Nom, prénom et email requis");
    }
    if (!convocationReunionId) return toast.error("Aucune séance à représenter");
    setBusyInvite(true);
    try {
      const resultat = await inviterExterne(convocationReunionId, {
        nom: nomInvite.trim(),
        prenom: prenom.trim(),
        email: emailInvite.trim(),
        motif: motif.trim() || undefined,
      });
      await chargerMesDelegations();
      setInviteExterneResultat({
        nom: nomInvite.trim(),
        prenom: prenom.trim(),
        emailSent: resultat.emailSent,
        lien: resultat.lien,
      });
      setFormInvite(false);
    } catch (e) {
      toast.error("Échec de l'invitation", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusyInvite(false);
    }
  };

  const terminer = () => {
    setProcurationSent(true);
    setInviteExterneResultat(null);
    nav({ tab: "home" });
  };

  if (envoyee) {
    return (
      <div>
        <TopBar title="Procuration" onBack={terminer} />
        <div className="px-5 py-4">
          <div className="rounded-2xl bg-white border border-emerald-200 p-5 shadow-sm text-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="mt-3 text-[15px] font-bold text-navy">Mandataire désigné</div>
            <div className="mt-1 text-[12px] text-slate-500">
              {envoyee.emailSent
                ? `Un email d'invitation a été envoyé à ${envoyee.nom} ${envoyee.prenom} avec son accès à l'espace invité.`
                : `${envoyee.nom} ${envoyee.prenom} peut déjà vous représenter, mais l'email d'invitation n'a pas pu être envoyé — communiquez-lui l'accès ci-dessous manuellement.`}
            </div>
            {!envoyee.emailSent && envoyee.lien && (
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-left text-[12px] space-y-2">
                <div className="flex items-start gap-2">
                  <span className="flex-1 font-mono text-navy break-all">{envoyee.lien}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(envoyee.lien!);
                      toast.success("Lien copié");
                    }}
                    className="shrink-0 h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 active:scale-95"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-slate-400">
                  Envoyez ce lien à {envoyee.nom} {envoyee.prenom} (SMS, WhatsApp…) — il y créera
                  son mot de passe personnel.
                </div>
              </div>
            )}
          </div>
          <button
            onClick={terminer}
            className="mt-4 w-full bg-navy text-white rounded-xl py-3.5 font-semibold active:scale-[0.98]"
          >
            Terminé
          </button>
        </div>
      </div>
    );
  }

  if (formInvite) {
    return (
      <div>
        <TopBar title="Nouvel invité" onBack={() => setFormInvite(false)} />
        <div className="px-5 py-4">
          <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm space-y-3">
            <div className="text-[11px] text-slate-500">
              Cette personne n'est pas encore dans le système : son compte est créé immédiatement
              et elle reçoit un email avec le lien pour se connecter et vous représenter.
            </div>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Nom
              </span>
              <input
                value={nomInvite}
                onChange={(e) => setNomInvite(e.target.value)}
                placeholder="Nom"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Prénom
              </span>
              <input
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Prénom"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Email
              </span>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={emailInvite}
                  onChange={(e) => setEmailInvite(e.target.value)}
                  placeholder="email@exemple.com"
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Motif (facultatif)
              </span>
              <input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Raison de la représentation"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </label>
          </div>
          <button
            onClick={inviterPersonne}
            disabled={busyInvite}
            className="mt-4 w-full bg-navy text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
          >
            {busyInvite ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            {busyInvite ? "Création en cours…" : "Créer et inviter"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Procuration" onBack={() => nav({ tab: "home", sub: "convocation" })} />
      <div className="px-5 py-4">
        <div className="text-[11px] text-slate-500 mb-3">
          Désignez la personne qui vous représentera pour « {titreSeance} » : elle pourra voter,
          signer le procès-verbal, scanner votre présence et recevoir le Board Book à votre place,
          jusqu'à 2 jours après la clôture de la séance.
        </div>
        <div className="relative mb-3">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {filtres.map((u) => (
            <button
              key={u.id}
              onClick={() => choisir(u)}
              disabled={!!busyId}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 disabled:opacity-60"
            >
              <div className="h-9 w-9 rounded-full bg-navy text-gold flex items-center justify-center text-[12px] font-bold shrink-0">
                {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : u.initiales}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-navy truncate">{u.nom}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {ROLE_LABELS[u.role].short} · {u.email}
                </div>
              </div>
            </button>
          ))}
          {aucunResultat && (
            <div className="px-4 py-6 text-center text-[12px] text-slate-500">
              Aucune personne ne correspond à « {recherche} ».
            </div>
          )}
        </div>
        {ressembleAUnEmail && aucunResultat && (
          <button
            onClick={ouvrirFormInvite}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gold text-navy bg-gold/5 py-3.5 font-semibold active:scale-[0.98]"
          >
            <UserPlus className="h-5 w-5" /> Inviter « {recherche.trim()} »
          </button>
        )}
      </div>
    </div>
  );
}
