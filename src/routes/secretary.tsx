import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SecretaryLayout, SECTION_KEYS, type SectionKey } from "@/components/secretary/layout";
import { useSectionPersistante } from "@/lib/use-section-persistante";
import { SecretaryDashboard } from "@/components/secretary/dashboard";
import { MeetingCreator } from "@/components/secretary/meeting-creator";
import { BoardBookPanel } from "@/components/secretary/boardbook-panel";
import { ConvocationsPanel } from "@/components/secretary/convocations-panel";
import { AttendancePanel } from "@/components/secretary/attendance-panel";
import { CalendarPanel } from "@/components/secretary/calendar-panel";
import { PVPanel } from "@/components/secretary/pv-panel";
import { ActionsPanel } from "@/components/secretary/actions-panel";
import { VotePanel } from "@/components/secretary/vote-panel";
import { ConsultationPanel } from "@/components/secretary/consultation-panel";
import { InvitesPanel } from "@/components/secretary/invites-panel";
import { GestionJetons } from "@/components/secretary/gestion-jetons";
import { SectionBrowser } from "@/components/secretary/section-browser";
import { SignatureTracker } from "@/components/secretary/signature-tracker";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import type { Reunion } from "@/types/domain";
import { ROLE_LABELS } from "@/lib/role-labels";
import { ShieldAlert, Loader2, LogIn } from "lucide-react";

export const Route = createFileRoute("/secretary")({
  ssr: false,
  component: SecretaryPage,
  head: () => ({ meta: [{ title: "Secrétariat CA — BoardCA" }] }),
});

// Garde d'accès, jumeau de celui de /super-admin. La RLS réserve l'écriture des
// réunions/convocations/présences au secrétariat (`reunions_write_priv` :
// `is_secretaire() or is_super_admin()`). Sans ce garde, un membre du CA voyait
// tout l'écran Secrétaire mais chaque action échouait sur un toast générique
// (« Échec de la création de la réunion ») sans jamais dire que c'était un
// refus de droits — d'où des heures de recherche d'un bug inexistant.
function SecretaryPage() {
  const { profile, authReady } = useBoardStore(
    useShallow((s) => ({ profile: s.profile, authReady: s.authReady })),
  );
  const navigate = useNavigate();

  // Ne rien trancher tant que la session n'a pas été résolue une première fois,
  // sinon une vraie secrétaire voit passer un flash d'« accès refusé ».
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.role !== "secretaire" && profile?.role !== "super_admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-navy mt-4">Espace réservé au Secrétariat</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {profile
              ? `Vous êtes connecté en tant que ${ROLE_LABELS[profile.role].label}. Créer une réunion, envoyer les convocations ou tenir l'émargement exige le compte Secrétaire.`
              : "Vous n'êtes pas connecté. Identifiez-vous avec le compte Secrétaire pour accéder à cet espace."}
          </p>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy text-white font-semibold py-3 hover:bg-navy-light transition"
          >
            <LogIn className="h-5 w-5" /> Se connecter en Secrétaire
          </button>
        </div>
      </div>
    );
  }

  return <SecretaryContent />;
}

function SecretaryContent() {
  // Onglet conservé au rafraîchissement (F5, rechargement du serveur de dev) —
  // sinon on retombait toujours sur le tableau de bord, quel que soit l'écran ouvert.
  const [section, setSectionState] = useSectionPersistante<SectionKey>(
    "sec-section",
    SECTION_KEYS,
    "dashboard",
  );
  // Réunion à ouvrir d'emblée dans la section visée (clic depuis le tableau de bord
  // ou le calendrier). Remis à zéro dès qu'on navigue à la main : sinon la section
  // rouvrirait toujours la même réunion au lieu de montrer sa grille.
  const [autoOpenId, setAutoOpenId] = useState<string | null>(null);
  const setSection = (s: SectionKey) => {
    setAutoOpenId(null);
    setSectionState(s);
  };
  // Réunion active = celle du vrai store. SectionBrowser la pose en ouvrant une
  // réunion ; le bootstrap recharge alors documents/convocations/présences/votes/PV.
  const setActiveMeetingId = useBoardStore((s) => s.setReunionActive);

  // Statut du PV de chaque réunion : sert à garder une réunion "En cours" dans la
  // grille du Procès-verbal tant que son PV n'est pas scellé, même une fois la
  // séance elle-même terminée (voir `estArchivePv` plus bas).
  const pvStatuts = useBoardStore((s) => s.pvStatuts);
  const fetchPvStatuts = useBoardStore((s) => s.fetchPvStatuts);
  useEffect(() => {
    if (section === "pv") fetchPvStatuts();
  }, [section, fetchPvStatuts]);
  const estArchivePv = (r: Reunion) => {
    const st = pvStatuts[r.id];
    return st === "signe" || st === "archive";
  };

  // Même principe pour "Actions & Suivi" : une réunion reste "En cours" tant que
  // toutes ses actions ne sont pas terminées, même une fois la séance close.
  // `s.actions` est déjà chargé intégralement (voir useBootstrap), pas de fetch
  // supplémentaire nécessaire ici.
  const actions = useBoardStore((s) => s.actions);
  const estArchiveActions = (r: Reunion) => {
    const actionsReunion = actions.filter((a) => a.reunionId === r.id);
    // Aucune action à suivre : rien ne justifie de garder la réunion "En cours"
    // indéfiniment, on retombe sur le comportement par défaut.
    if (actionsReunion.length === 0) return r.statut === "terminee";
    return actionsReunion.every((a) => a.statut === "terminee");
  };

  // Les documents se déposent désormais à la création de la réunion : ouvrir une
  // réunion depuis le tableau de bord ou le calendrier mène à son Board Book.
  const ouvrirReunion = (id: string) => {
    setActiveMeetingId(id);
    setSectionState("boardbook");
    setAutoOpenId(id);
  };

  return (
    <SecretaryLayout section={section} setSection={setSection}>
      {section === "dashboard" && (
        <SecretaryDashboard onOpenMeeting={ouvrirReunion} onNew={() => setSection("create")} />
      )}
      {section === "create" && (
        <MeetingCreator
          onCreated={(id) => {
            setActiveMeetingId(id);
            // Retour au tableau de bord (store réel) : la réunion créée y apparaît,
            // convocations envoyées.
            setSection("dashboard");
          }}
        />
      )}
      {section === "gouvernance" && <GestionJetons />}
      {section === "calendrier" && <CalendarPanel onOpenMeeting={ouvrirReunion} />}
      {section === "boardbook" && (
        <SectionBrowser
          title="Board Book"
          subtitle="Ouvrez une réunion pour compiler et publier son recueil."
          autoOpenId={autoOpenId}
        >
          {(id) => <BoardBookPanel meetingId={id} />}
        </SectionBrowser>
      )}
      {section === "convocations" && (
        <SectionBrowser
          title="Convocations"
          subtitle="Ouvrez une réunion pour suivre les convocations et les réponses."
        >
          {(id) => <ConvocationsPanel meetingId={id} />}
        </SectionBrowser>
      )}
      {section === "attendance" && (
        <SectionBrowser
          title="Émargement & Quorum"
          subtitle="Ouvrez une réunion pour ouvrir l'émargement et suivre le quorum."
        >
          {(id) => <AttendancePanel meetingId={id} />}
        </SectionBrowser>
      )}
      {section === "vote" && (
        <SectionBrowser
          title="Votes électroniques"
          subtitle="Ouvrez une réunion pour lancer et dépouiller ses scrutins."
        >
          {(id) => <VotePanel meetingId={id} />}
        </SectionBrowser>
      )}
      {section === "consultation" && <ConsultationPanel />}
      {section === "invites" && <InvitesPanel />}
      {section === "pv" && (
        <SectionBrowser
          title="Procès-verbal"
          subtitle="Ouvrez une réunion pour rédiger, faire signer et sceller son PV."
          estArchive={estArchivePv}
        >
          {() => <PVPanel />}
        </SectionBrowser>
      )}
      {section === "actions" && (
        <SectionBrowser
          title="Actions & Suivi"
          subtitle="Ouvrez une réunion pour suivre les actions décidées en séance."
          estArchive={estArchiveActions}
        >
          {(id) => <ActionsPanel meetingId={id} />}
        </SectionBrowser>
      )}

      {/* Suivi des signatures : flottant, il vit AU-DESSUS de tous les onglets — la
          Secrétaire continue de travailler pendant que les membres signent. */}
      <SignatureTracker />
    </SecretaryLayout>
  );
}
