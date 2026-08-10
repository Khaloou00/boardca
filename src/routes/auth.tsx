import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useApp, ROLE_META, type Role } from "@/lib/app-store";
import { useBoardStore } from "@/store/useBoardStore";
import { supabase } from "@/lib/supabase";
import { NEW_TO_OLD_ROLE, ROLE_LABELS } from "@/lib/role-labels";
import {
  Fingerprint,
  Shield,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  Crown,
  UserCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({ meta: [{ title: "Connexion — BoardCA" }] }),
});

type Step = "role" | "credentials" | "2fa" | "change-password";

// Comptes réels seedés en base (mot de passe commun de démo). Cliquer une carte
// pré-remplit ces identifiants ; l'authentification qui suit est un vrai
// supabase.auth.signInWithPassword — pas une session simulée.
const DEMO_PASSWORD = "0101010101";
// Aucun compte « Responsable d'Action » n'est seedé : il se crée à la demande
// depuis Super Admin · Utilisateurs. Son email reste vide → à saisir à la main.
const SEED_EMAIL: Record<Role, string> = {
  super_admin: "admin@timutech.com",
  secretary: "fofanaaicha@gmail.com",
  admin: "cisseibrahimkhalilou@gmail.com",
  action_manager: "",
};

function AuthPage() {
  const navigate = useNavigate();
  const { login: legacyLogin } = useApp();
  const storeLogin = useBoardStore((s) => s.login);
  const completePasswordChange = useBoardStore((s) => s.completePasswordChange);
  const [step, setStep] = useState<Step>("role");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  // Le PCA n'est pas un rôle mais un attribut (`est_president_ca`) porté par un
  // administrateur : on le résout dynamiquement au clic (jamais codé en dur, le
  // titulaire est mutable depuis Super Admin · Utilisateurs).
  const [pcaMode, setPcaMode] = useState(false);
  const [resolvingPCA, setResolvingPCA] = useState(false);

  const pickRole = (r: Role) => {
    setPcaMode(false);
    setRole(r);
    setEmail(SEED_EMAIL[r]);
    setPassword(DEMO_PASSWORD);
    setStep("credentials");
  };

  const pickPCA = async () => {
    setResolvingPCA(true);
    try {
      // RPC dédiée : l'utilisateur est encore anonyme ici et la RLS de `profiles`
      // interdit les lectures anon — `current_pca_email()` (SECURITY DEFINER) renvoie
      // uniquement l'email du titulaire courant.
      const { data: pcaEmail, error } = await supabase.rpc("current_pca_email");
      if (error || !pcaEmail) {
        toast.error("Aucun PCA désigné", {
          description: "Désignez-en un depuis Super Admin · Utilisateurs (icône couronne).",
        });
        return;
      }
      setRole("admin"); // le PCA est un administrateur → même interface mobile
      setPcaMode(true);
      setEmail(pcaEmail);
      setPassword(DEMO_PASSWORD);
      setStep("credentials");
    } catch {
      toast.error("Impossible de résoudre le profil PCA");
    } finally {
      setResolvingPCA(false);
    }
  };

  const submitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Identifiants requis");
    setLoading(true);
    try {
      await storeLogin(email, password);
      setStep("2fa");
      toast.info("Code envoyé sur votre application d'authentification");
    } catch {
      toast.error("Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  const otpFull = otp.join("").length === 6;
  const submitOtp = () => {
    if (!otpFull) return toast.error("Code à 6 chiffres requis");
    finish();
  };

  const entrerDansLApp = () => {
    const profile = useBoardStore.getState().profile;
    if (!profile) return toast.error("Session invalide, réessayez");
    const oldRole = NEW_TO_OLD_ROLE[profile.role];
    legacyLogin(oldRole); // pont — voir commentaire NEW_TO_OLD_ROLE
    toast.success(
      profile.estPresidentCA
        ? "Bienvenue, Président du Conseil"
        : `Bienvenue, ${ROLE_LABELS[profile.role].label}`,
    );
    navigate({ to: ROLE_META[oldRole].path });
  };

  const finish = () => {
    const profile = useBoardStore.getState().profile;
    if (!profile) return toast.error("Session invalide, réessayez");
    // Compte créé par le Super Admin : on impose un nouveau mot de passe AVANT
    // de laisser entrer. Le drapeau est effacé côté serveur au changement.
    if (profile.mustChangePassword) {
      setNewPwd("");
      setNewPwd2("");
      setStep("change-password");
      return;
    }
    entrerDansLApp();
  };

  const submitNewPassword = async () => {
    if (newPwd.length < 8) return toast.error("Mot de passe : 8 caractères minimum");
    if (newPwd !== newPwd2) return toast.error("Les deux mots de passe ne correspondent pas");
    if (newPwd === password)
      return toast.error("Choisissez un mot de passe différent de celui fourni");
    setLoading(true);
    try {
      await completePasswordChange(newPwd);
      toast.success("Mot de passe mis à jour");
      entrerDansLApp();
    } catch (e: any) {
      toast.error("Changement impossible", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left institutional panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-navy text-navy-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,var(--gold),transparent_45%),radial-gradient(circle_at_70%_80%,var(--gold),transparent_45%)]" />
        <div className="relative">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs text-navy-foreground/70 hover:text-gold"
          >
            <ArrowLeft className="h-4 w-4" /> Retour au site
          </Link>
          <div className="flex flex-col items-start gap-2 mt-12">
            <BrandLogo imgClassName="h-7" variant="white" />
            <div>
              <div className="text-2xl font-bold">BoardCA</div>
              <div className="text-xs uppercase tracking-widest text-gold">
                BNETD · Côte d'Ivoire
              </div>
            </div>
          </div>
          <h2 className="mt-16 text-4xl font-bold leading-tight max-w-md">
            Accédez à la <span className="text-gold">gouvernance numérique</span> du Conseil
            d'Administration.
          </h2>
          <p className="mt-4 text-navy-foreground/70 max-w-md">
            Une session sécurisée en 3 étapes : identifiants, code 2FA, biométrie.
          </p>
        </div>
        <div className="relative flex gap-6 text-xs text-navy-foreground/60">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-gold" /> Chiffré
          </div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-gold" /> 2FA
          </div>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-gold" /> Biométrie
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <div className="w-full max-w-md">
          {step !== "change-password" && <Stepper step={step} />}

          {step === "role" && (
            <div className="animate-in fade-in slide-in-from-right-2">
              <h1 className="text-3xl font-bold text-navy">Choisissez votre profil</h1>
              <p className="mt-2 text-muted-foreground">
                Chaque profil ouvre une interface adaptée à vos missions.
              </p>
              <div className="mt-8 grid gap-3">
                {(Object.keys(ROLE_META) as Role[]).map((r) => {
                  const m = ROLE_META[r];
                  return (
                    <button
                      key={r}
                      onClick={() => pickRole(r)}
                      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left hover:border-gold hover:shadow-lg transition"
                    >
                      <div
                        className={`h-12 w-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-white font-bold`}
                      >
                        {m.short.slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-navy">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.description}</div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gold group-hover:translate-x-1 transition" />
                    </button>
                  );
                })}

                {/* PCA — pas un rôle mais le titulaire (administrateur) du titre, résolu au clic. */}
                <button
                  onClick={pickPCA}
                  disabled={resolvingPCA}
                  className="group flex items-center gap-4 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/5 to-transparent p-4 text-left hover:border-gold hover:shadow-lg transition disabled:opacity-60"
                >
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center text-white font-bold">
                    {resolvingPCA ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Crown className="h-6 w-6" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-navy">PCA — Président du Conseil</div>
                    <div className="text-xs text-muted-foreground">
                      Discussions, présidence de séance, sceau du PV
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gold group-hover:translate-x-1 transition" />
                </button>

                {/* Invité — mandataire de procuration externe : page dédiée, email +
                    mot de passe (temporaire puis personnel), pas de prérempli possible. */}
                <button
                  onClick={() => navigate({ to: "/auth/invite" })}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left hover:border-gold hover:shadow-lg transition"
                >
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white font-bold">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-navy">Invité — Mandataire</div>
                    <div className="text-xs text-muted-foreground">
                      Vote, signature et présence au nom d'un membre représenté
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-gold group-hover:translate-x-1 transition" />
                </button>
              </div>
            </div>
          )}

          {step === "credentials" && role && (
            <form onSubmit={submitCreds} className="animate-in fade-in slide-in-from-right-2">
              <button
                type="button"
                onClick={() => setStep("role")}
                className="text-xs text-muted-foreground hover:text-navy flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Changer de profil
              </button>
              <h1 className="text-3xl font-bold text-navy mt-4">Identifiants</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Connexion en tant que{" "}
                <span className="font-medium text-navy">
                  {pcaMode ? "Président du Conseil (PCA)" : ROLE_META[role].label}
                </span>
              </p>
              <div className="mt-8 space-y-4">
                <Field label="Email professionnel">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </Field>
                <Field label="Mot de passe">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </Field>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-8 w-full rounded-lg bg-navy text-navy-foreground font-semibold py-3 hover:bg-navy-light disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
              >
                {loading ? "Connexion…" : "Continuer"} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {step === "2fa" && (
            <div className="animate-in fade-in slide-in-from-right-2">
              <button
                onClick={() => setStep("credentials")}
                className="text-xs text-muted-foreground hover:text-navy flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Retour
              </button>
              <div className="h-14 w-14 rounded-2xl bg-gold/15 flex items-center justify-center mt-4">
                <KeyRound className="h-7 w-7 text-gold" />
              </div>
              <h1 className="text-3xl font-bold text-navy mt-4">Code 2FA</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Saisissez le code à 6 chiffres depuis votre application.
              </p>
              <div className="mt-8 flex gap-2 justify-between">
                {otp.map((v, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    inputMode="numeric"
                    maxLength={1}
                    value={v}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 1);
                      const next = [...otp];
                      next[i] = val;
                      setOtp(next);
                      if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
                    }}
                    className="h-14 w-12 text-center text-2xl font-bold rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                ))}
              </div>
              <button
                onClick={submitOtp}
                disabled={!otpFull}
                className="mt-8 w-full rounded-lg bg-navy text-navy-foreground font-semibold py-3 hover:bg-navy-light disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
              >
                Vérifier <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOtp(["1", "2", "3", "4", "5", "6"])}
                className="mt-3 w-full text-xs text-muted-foreground hover:text-navy"
              >
                Utiliser un code de démo
              </button>
            </div>
          )}

          {step === "change-password" && (
            <div className="animate-in fade-in slide-in-from-right-2">
              <div className="h-16 w-16 rounded-2xl bg-navy flex items-center justify-center mx-auto">
                <KeyRound className="h-8 w-8 text-gold" />
              </div>
              <h1 className="text-2xl font-bold text-navy mt-5 text-center">
                Choisissez votre mot de passe
              </h1>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Première connexion : remplacez le mot de passe temporaire qui vous a été transmis
                avant d'accéder à votre espace.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitNewPassword();
                }}
                className="mt-6 space-y-4"
              >
                <Field label="Nouveau mot de passe">
                  <input
                    type="password"
                    autoFocus
                    autoComplete="new-password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </Field>
                <Field label="Confirmer le mot de passe">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPwd2}
                    onChange={(e) => setNewPwd2(e.target.value)}
                    placeholder="Ressaisissez le mot de passe"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </Field>
                {newPwd2.length > 0 && newPwd !== newPwd2 && (
                  <div className="text-[12px] text-red-600">
                    Les deux mots de passe ne correspondent pas.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || newPwd.length < 8 || newPwd !== newPwd2}
                  className="w-full rounded-lg bg-gold text-gold-foreground font-semibold py-3 hover:brightness-110 transition inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-5 w-5" /> Enregistrer et continuer
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-navy uppercase tracking-wider">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Step[] = ["role", "credentials", "2fa"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex-1 flex items-center gap-2">
          <div className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-gold" : "bg-border"}`} />
        </div>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">{idx + 1}/3</span>
    </div>
  );
}
