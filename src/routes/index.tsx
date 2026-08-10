import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  FileCheck2,
  Vote,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  Lock,
  Users,
  Fingerprint,
  Archive,
  ClipboardSignature,
  ScrollText,
  Sparkles,
  Globe2,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "BoardCA — Plateforme de gouvernance du Conseil d'Administration BNETD" },
      {
        name: "description",
        content:
          "Solution digitale de pilotage du CA BNETD : convocation, Board Book, votes électroniques, PV signés eIDAS, archives probantes. Souveraineté et conformité.",
      },
      { property: "og:title", content: "BoardCA — Gouvernance du Conseil d'Administration BNETD" },
      {
        property: "og:description",
        content:
          "De la convocation à l'archivage : cycle complet du CA, sécurisé, souverain et conforme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/85 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex flex-col items-center gap-1">
            <BrandLogo imgClassName="h-6" />
            <div className="text-center">
              <div className="font-bold text-navy leading-tight tracking-tight">BoardCA  · République de Côte d'Ivoire</div>

            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a href="#cycle" className="text-muted-foreground hover:text-navy transition">
              Cycle du CA
            </a>
            <a href="#roles" className="text-muted-foreground hover:text-navy transition">
              Profils
            </a>
            <a href="#security" className="text-muted-foreground hover:text-navy transition">
              Sécurité
            </a>
            <a href="#stack" className="text-muted-foreground hover:text-navy transition">
              Souveraineté
            </a>
          </nav>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-navy text-navy-foreground px-4 py-2 text-sm font-medium hover:bg-navy-light transition shadow-md shadow-navy/20"
          >
            Accéder à la plateforme <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-navy-foreground">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,var(--gold),transparent_40%),radial-gradient(circle_at_80%_80%,var(--gold),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.15))]" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-gold/10 border border-gold/30 px-3 py-1 text-xs text-gold mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
              Solution officielle · Bureau National d'Études Techniques et de Développement
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
              Le Conseil d'Administration
              <br />
              <span className="text-gold">entièrement digital.</span>
            </h1>
            <p className="mt-8 text-lg text-navy-foreground/75 max-w-2xl leading-relaxed">
              De la convocation trois semaines avant, à la signature du procès-verbal le jour même,
              en passant par le vote électronique et le suivi des décisions :{" "}
              <strong className="text-navy-foreground">
                un cycle complet, sécurisé, souverain
              </strong>
              .
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-lg bg-gold text-gold-foreground px-6 py-3.5 font-semibold hover:brightness-110 transition shadow-lg shadow-gold/20"
              >
                Démarrer la démonstration <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#cycle"
                className="inline-flex items-center gap-2 rounded-lg border border-navy-foreground/25 px-6 py-3.5 font-medium hover:bg-white/5 transition"
              >
                Voir le cycle complet
              </a>
            </div>
            <div className="mt-12 grid grid-cols-4 gap-6 max-w-lg">
              {[
                { v: "38", l: "écrans" },
                { v: "4", l: "profils" },
                { v: "eIDAS", l: "conforme" },
                { v: "10 ans", l: "archives" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl md:text-3xl font-bold text-gold">{s.v}</div>
                  <div className="text-[10px] text-navy-foreground/60 uppercase tracking-widest mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="absolute -inset-8 bg-gold/25 blur-3xl rounded-full" />
            <div className="relative rounded-2xl border border-gold/30 bg-navy-light/60 backdrop-blur-sm p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <div className="h-2 w-2 rounded-full bg-yellow-400" />
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <div className="ml-auto text-[10px] uppercase tracking-widest text-gold">
                  CA Ordinaire · Juillet 2026
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-navy-foreground/60 uppercase tracking-wider">
                      Quorum
                    </div>
                    <span className="text-[10px] rounded-full bg-success/20 text-success px-2 py-0.5 border border-success/40">
                      Atteint
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      12<span className="text-navy-foreground/40 text-base"> / 15</span>
                    </span>
                    <span className="text-xs text-navy-foreground/60">
                      administrateurs présents
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-navy-foreground/60 uppercase tracking-wider">
                      Vote — Budget 2026
                    </div>
                    <span className="text-[10px] text-gold animate-pulse">● en cours</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <div className="flex-1 rounded bg-success/20 border border-success/30 py-1.5 text-center">
                      <b>9</b> OUI
                    </div>
                    <div className="flex-1 rounded bg-destructive/20 border border-destructive/30 py-1.5 text-center">
                      <b>2</b> NON
                    </div>
                    <div className="flex-1 rounded bg-white/10 border border-white/20 py-1.5 text-center">
                      <b>1</b> ABS
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-gold/10 border border-gold/30 px-4 py-3 flex items-center gap-3">
                  <ClipboardSignature className="h-5 w-5 text-gold" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">PV en rédaction assistée</div>
                    <div className="text-xs text-navy-foreground/60">
                      Signature eIDAS en attente · 3 / 5 administrateurs
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline / Cycle */}
      <section id="cycle" className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-xs uppercase tracking-[0.2em] text-gold mb-3">
            Un cycle rigoureux
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-navy tracking-tight">
            Trois semaines pour préparer, une journée pour décider
          </h2>
          <p className="text-muted-foreground mt-4">
            Chaque étape codifie une pratique existante du secrétariat du CA. Aucune improvisation,
            aucun oubli.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gradient-to-b from-gold via-gold/50 to-transparent md:left-1/2 md:-translate-x-px" />
          <div className="space-y-12">
            {[
              {
                when: "J − 21",
                who: "Secrétaire",
                title: "Ouverture de la session",
                d: "Création de la réunion, ordre du jour glissable-déposable, upload des rapports par point.",
              },
              {
                when: "J − 7",
                who: "Secrétaire",
                title: "Board Book & convocations",
                d: "Génération PDF sécurisée, envoi des convocations traçables aux 12 membres du CA en un clic.",
              },
              {
                when: "J − 3",
                who: "Membre du CA",
                title: "Consultation mobile hors-ligne",
                d: "Téléchargement chiffré du Board Book, annotations privées, notes personnelles — même sans réseau.",
              },
              {
                when: "Jour J",
                who: "Séance plénière",
                title: "Émargement, quorum, votes",
                d: "QR-code d'émargement, quorum calculé en direct, votes OUI/NON/ABS scellés côté serveur.",
              },
              {
                when: "J + 1",
                who: "Secrétaire",
                title: "PV assisté & signature eIDAS",
                d: "Trame pré-remplie à partir des décisions, signature certifiée certifiée YouSign de tous les signataires.",
              },
              {
                when: "J + n",
                who: "Resp. d'Action",
                title: "Suivi des décisions",
                d: "Attribution automatique, rappels d'échéance, mise à jour de l'avancement visible du CA.",
              },
            ].map((step, i) => (
              <div
                key={i}
                className={`relative grid md:grid-cols-2 gap-6 items-center ${i % 2 === 1 ? "md:direction-rtl" : ""}`}
              >
                <div
                  className={`${i % 2 === 1 ? "md:order-2 md:text-left md:pl-16" : "md:text-right md:pr-16"} pl-20 md:pl-0`}
                >
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-gold mb-2">
                    <span className="rounded bg-navy text-navy-foreground px-2 py-0.5">
                      {step.when}
                    </span>
                    <span className="text-muted-foreground uppercase tracking-widest">
                      {step.who}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-navy">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{step.d}</p>
                </div>
                <div
                  className={`absolute left-8 md:left-1/2 md:-translate-x-1/2 h-4 w-4 rounded-full bg-gold border-4 border-background shadow-lg shadow-gold/40`}
                />
                <div />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section
        id="roles"
        className="py-24 bg-gradient-to-b from-muted/40 to-background border-y border-border"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <div className="text-xs uppercase tracking-[0.2em] text-gold mb-3">
              Quatre profils métier
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-navy tracking-tight">
              Chaque acteur, son interface adaptée
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Shield,
                t: "Super Admin",
                sub: "DSI · Informaticien BNETD",
                c: "Configuration système, utilisateurs, comités, matrice de droits, journal d'audit. N'intervient jamais en séance.",
              },
              {
                icon: ScrollText,
                t: "Secrétaire du CA",
                sub: "Assistante Direction Générale",
                c: "Pivot opérationnel : prépare la séance de A à Z, anime le jour J, finalise le PV et attribue les actions.",
              },
              {
                icon: Smartphone,
                t: "Membre du CA",
                sub: "Conseil d'Administration",
                c: "Board Book mobile hors-ligne, vote électronique, annotations privées, signature du PV depuis sa tablette.",
              },
              {
                icon: Users,
                t: "Resp. d'Action",
                sub: "Casquette temporaire",
                c: "Accès restreint aux seules tâches assignées après une décision du CA. Mise à jour de l'avancement.",
              },
            ].map((r) => (
              <div
                key={r.t}
                className="rounded-2xl bg-card border border-border p-6 relative overflow-hidden group hover:border-gold/60 hover:shadow-xl hover:shadow-navy/5 transition"
              >
                <div className="absolute top-0 right-0 h-24 w-24 bg-gold/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition duration-500" />
                <r.icon className="h-8 w-8 text-navy mb-4" />
                <div className="text-xl font-bold text-navy">{r.t}</div>
                <div className="text-[11px] uppercase tracking-widest text-gold mt-1">{r.sub}</div>
                <div className="text-sm text-muted-foreground mt-3 leading-relaxed">{r.c}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <div className="text-xs uppercase tracking-[0.2em] text-gold mb-3">
            Fonctionnalités clés
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-navy tracking-tight">
            Ce que la plateforme fait pour vous
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              i: FileCheck2,
              t: "Ordre du jour drag & drop",
              d: "Réorganisez les points de la séance par glisser-déposer avant envoi des convocations.",
            },
            {
              i: Sparkles,
              t: "Board Book généré",
              d: "Un PDF sécurisé compile ordre du jour, rapports financiers, annexes — en un clic.",
            },
            {
              i: Smartphone,
              t: "Consultation hors-ligne",
              d: "Le membre en déplacement télécharge le Board Book chiffré, lit et annote sans réseau.",
            },
            {
              i: Vote,
              t: "Vote électronique scellé",
              d: "OUI / NON / ABS ou consultation écrite entre deux sessions. Résultats horodatés et signés.",
            },
            {
              i: ClipboardSignature,
              t: "PV & signature eIDAS",
              d: "Trame assistée, puis signature certifiée YouSign des administrateurs concernés.",
            },
            {
              i: Archive,
              t: "Archives probantes 10 ans",
              d: "Chaque document scellé par hash SHA-256 + horodatage certifié — valeur légale garantie.",
            },
          ].map((f) => (
            <div
              key={f.t}
              className="rounded-xl border border-border bg-card p-6 hover:border-navy transition group"
            >
              <div className="h-11 w-11 rounded-lg bg-navy flex items-center justify-center mb-4 group-hover:bg-gold transition">
                <f.i className="h-5 w-5 text-gold group-hover:text-gold-foreground transition" />
              </div>
              <div className="font-semibold text-navy">{f.t}</div>
              <div className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section
        id="security"
        className="py-24 bg-navy text-navy-foreground relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,var(--gold),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gold mb-3">
              Sécurité institutionnelle
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Confiance, traçabilité, souveraineté
            </h2>
            <p className="mt-6 text-navy-foreground/75 leading-relaxed">
              Les données du Conseil d'Administration sont classifiées « confidentiel institutionnel
              ». BoardCA applique le plus haut niveau de garanties.
            </p>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {[
                {
                  i: Fingerprint,
                  t: "2FA + biométrie",
                  d: "TOTP obligatoire, Face ID / Touch ID sur mobile",
                },
                {
                  i: Lock,
                  t: "Chiffrement AES-256",
                  d: "Documents chiffrés au repos et en transit",
                },
                {
                  i: ScrollText,
                  t: "Journal append-only",
                  d: "Chaque action loggée : qui, quoi, quand, d'où",
                },
                {
                  i: ClipboardSignature,
                  t: "Signature eIDAS",
                  d: "PV certifiés YouSign, valeur juridique complète",
                },
              ].map((item) => (
                <div key={item.t} className="rounded-lg bg-white/5 border border-white/10 p-4">
                  <item.i className="h-5 w-5 text-gold mb-2" />
                  <div className="font-semibold text-sm">{item.t}</div>
                  <div className="text-xs text-navy-foreground/60 mt-1">{item.d}</div>
                </div>
              ))}
            </div>
          </div>
          <div
            id="stack"
            className="rounded-2xl bg-navy-light/60 border border-gold/30 p-8 backdrop-blur"
          >
            <Globe2 className="h-10 w-10 text-gold" />
            <div className="mt-4 text-2xl font-bold">Hébergement souverain</div>
            <p className="text-sm text-navy-foreground/70 mt-2">
              Vos données restent sur le continent. VPS OVH Abidjan/France ou Azure Afrique du Sud
              selon la sensibilité du dossier.
            </p>
            <div className="mt-6 space-y-2 text-sm">
              {[
                "PostgreSQL — table d'audit append-only",
                "Redis — sessions & rate limiting",
                "S3 compatible — documents AES-256",
                "SendGrid — convocations traçables",
                "Expo Push — alertes temps réel",
              ].map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />{" "}
                  <span className="text-navy-foreground/85">{t}</span>
                </div>
              ))}
            </div>
            <Link
              to="/auth"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gold text-gold-foreground px-5 py-3 font-semibold hover:brightness-110 shadow-lg shadow-gold/20"
            >
              Se connecter à la plateforme <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Use case */}
      <section className="py-24 max-w-5xl mx-auto px-6">
        <div className="rounded-2xl border-2 border-gold/40 bg-gradient-to-br from-gold/5 to-transparent p-8 md:p-12">
          <div className="text-xs uppercase tracking-[0.2em] text-gold mb-3">Cas d'usage réel</div>
          <blockquote className="text-xl md:text-2xl text-navy leading-relaxed font-medium">
            « M. Koné, représentant du Ministère des Finances au CA, est en déplacement à Paris. Il
            reçoit la convocation, télécharge le Board Book de 120 pages en mode hors-ligne avant de
            monter dans l'avion. Dans l'avion, il lit le rapport financier, surligne 3 passages,
            ajoute une note privée. Le jour de la réunion, il vote OUI sur la résolution 3, signe
            électroniquement le PV depuis sa tablette. »
          </blockquote>
          <div className="mt-6 text-sm text-muted-foreground">
            — Scénario opérationnel décrit dans le cahier des charges BoardCA
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <BrandLogo imgClassName="h-4" />
            <span>© 2026 BNETD · BoardCA · Version 2026.1</span>
          </div>
          <div className="flex gap-6">
            <span>Développé par TimuTech · Abidjan</span>
            <span>Hébergement souverain</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
