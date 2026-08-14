import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useApp, ROLE_META } from "@/lib/app-store";
import { useBoardStore } from "@/store/useBoardStore";
import { supabase } from "@/lib/supabase";
import { NEW_TO_OLD_ROLE, ROLE_LABELS } from "@/lib/role-labels";
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
// Politique de mot de passe partagée avec /auth/invite : une seule définition,
// et une liste d'exclusion des mots de passe publiquement connus.
import { evaluerMotDePasse, premierDefaut } from "@/lib/mot-de-passe";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({ meta: [{ title: "Connexion — BoardCA" }] }),
});

// L'étape "2fa" d'origine a été RETIRÉE le 2026-08-10 : l'écran acceptait
// n'importe quels 6 chiffres sans jamais vérifier de TOTP (0 facteur MFA
// enrôlé en base), et proposait même un bouton « code de démo ». Une 2FA qui
// accepte tout est pire que pas de 2FA. Remplacée le 2026-08-14 par une vraie
// vérification : après mot de passe correct, un code est généré et vérifié
// côté serveur (`send-login-otp` + `verifyOtp`), pas un TOTP enrôlé, mais un
// facteur réel et contrôlé.
// Plus de sélection de profil : l'écran listait tous les rôles de
// l'institution (super-administrateur, président du conseil...) et ce
// qu'ils permettent, à qui passait par là. Ce choix n'avait de toute
// façon aucun effet : la destination est calculée après authentification
// depuis `profile.role` lu en base, jamais depuis la carte cliquée.
type Step =
  | "credentials"
  | "login-otp"
  | "change-password"
  | "forgot"
  | "forgot-otp"
  | "forgot-new-password";

function AuthPage() {
  const navigate = useNavigate();
  const { login: legacyLogin } = useApp();
  const storeLogin = useBoardStore((s) => s.login);
  const completePasswordChange = useBoardStore((s) => s.completePasswordChange);
  const [step, setStep] = useState<Step>("credentials");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showNewPwd2, setShowNewPwd2] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [loginOtpCode, setLoginOtpCode] = useState("");

  // Envoie (ou renvoie) le code de connexion — appelé après un mot de passe
  // validé. L'email n'est jamais transmis : la fonction serveur le lit sur la
  // session déjà établie par `storeLogin`.
  const envoyerCodeConnexion = async () => {
    await supabase.functions.invoke("send-login-otp");
    setLoginOtpCode("");
    setStep("login-otp");
  };

  const submitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Identifiants requis");
    setLoading(true);
    try {
      await storeLogin(email, password);
      await envoyerCodeConnexion();
    } catch {
      toast.error("Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  const submitLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginOtpCode.trim()) return toast.error("Code requis");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: loginOtpCode.trim(),
        type: "recovery",
      });
      if (error) throw error;
      await useBoardStore.getState().loadProfile();
      finish();
    } catch {
      toast.error("Code invalide ou expiré");
    } finally {
      setLoading(false);
    }
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

  const submitForgot = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!forgotEmail.trim()) return toast.error("Adresse email requise");
    setLoading(true);
    try {
      // Réponse volontairement générique : voir la fonction serveur, qui ne
      // doit jamais laisser deviner quels emails ont un compte. On passe donc
      // TOUJOURS à l'écran de saisie du code, que l'adresse existe ou non.
      await supabase.functions.invoke("request-password-reset", {
        body: { email: forgotEmail.trim().toLowerCase() },
      });
    } finally {
      setForgotCode("");
      setStep("forgot-otp");
      setLoading(false);
    }
  };

  const submitForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCode.trim()) return toast.error("Code requis");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: forgotEmail.trim().toLowerCase(),
        token: forgotCode.trim(),
        type: "recovery",
      });
      if (error) throw error;
      await useBoardStore.getState().loadProfile();
      setNewPwd("");
      setNewPwd2("");
      setStep("forgot-new-password");
    } catch {
      toast.error("Code invalide ou expiré");
    } finally {
      setLoading(false);
    }
  };

  const submitForgotNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const defaut = premierDefaut(newPwd);
    if (defaut) return toast.error("Mot de passe trop faible", { description: defaut });
    if (newPwd !== newPwd2) return toast.error("Les deux mots de passe ne correspondent pas");
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
    // Politique commune à tous les écrans (voir lib/mot-de-passe). Ne PAS se
    // contenter d'une longueur : `0101010101` fait 10 caractères, et c'est
    // l'ancien mot de passe de démonstration, lisible dans l'historique public
    // du dépôt — deux comptes ont pu le reprendre faute de ce contrôle.
    const defaut = premierDefaut(newPwd);
    if (defaut) return toast.error("Mot de passe trop faible", { description: defaut });
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
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2 bg-background">
      {/* En-tête mobile avec l'image du conseil */}
      <div className="relative h-[35vh] min-h-[280px] w-full lg:hidden shrink-0 overflow-hidden bg-navy">
        {/* L'image remplit l'espace (object-cover) comme sur la maquette validée */}
        <img 
          src="/Ca.png" 
          alt="Réunion du Conseil" 
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-navy/20" />
      </div>

      {/* Left institutional panel (Desktop only) */}
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
            Accès réservé aux membres et aux services du Conseil, sur identifiants nominatifs.
          </p>
        </div>
        {/* Ne mentionner ici que ce qui est RÉELLEMENT en place. « Biométrie »
            a été retirée le 2026-08-10 (jamais implémentée). La 2FA par code
            email, elle, est réelle depuis le 2026-08-14. */}
        <div className="relative flex gap-6 text-xs text-navy-foreground/60">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-gold" /> Connexion chiffrée
          </div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-gold" /> Vérification par code
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="relative z-10 flex-1 flex lg:items-center justify-center p-6 pt-10 md:p-12 bg-background rounded-t-[32px] -mt-10 lg:mt-0 lg:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.15)] lg:shadow-none">
        <div className="w-full max-w-md">
          {step === "credentials" && (
            <form onSubmit={submitCreds} className="animate-in fade-in slide-in-from-right-2">
              <h1 className="text-3xl font-bold text-navy">Connexion</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Accès réservé aux membres et aux services du Conseil.
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
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setStep("forgot");
                    }}
                    className="mt-2 text-xs text-muted-foreground hover:text-gold transition"
                  >
                    Mot de passe oublié ?
                  </button>
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

          {step === "login-otp" && (
            <div className="animate-in fade-in slide-in-from-right-2">
              <div className="h-16 w-16 rounded-2xl bg-navy flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-gold" />
              </div>
              <h1 className="text-2xl font-bold text-navy mt-5 text-center">
                Saisissez le code reçu
              </h1>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Un code de vérification vient d'être envoyé par email. Il est valable une seule
                fois.
              </p>
              <form onSubmit={submitLoginOtp} className="mt-6 space-y-4">
                <Field label="Code de vérification">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={loginOtpCode}
                    onChange={(e) => setLoginOtpCode(e.target.value)}
                    placeholder="Code reçu par email"
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </Field>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-navy text-navy-foreground font-semibold py-3 hover:bg-navy-light disabled:opacity-50 transition"
                >
                  {loading ? "Vérification…" : "Vérifier"}
                </button>
              </form>
              <button
                type="button"
                onClick={envoyerCodeConnexion}
                disabled={loading}
                className="mt-4 w-full text-xs text-muted-foreground hover:text-gold transition disabled:opacity-50"
              >
                Renvoyer le code
              </button>
              <button
                type="button"
                onClick={() => setStep("credentials")}
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
              </button>
            </div>
          )}

          {step === "forgot" && (
            <div className="animate-in fade-in slide-in-from-right-2">
              <div className="h-16 w-16 rounded-2xl bg-navy flex items-center justify-center mx-auto">
                <KeyRound className="h-8 w-8 text-gold" />
              </div>
              <h1 className="text-2xl font-bold text-navy mt-5 text-center">
                Mot de passe oublié
              </h1>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Indiquez votre email professionnel : si un compte y est associé, un code de
                vérification à 6 chiffres vous sera envoyé.
              </p>
              <form onSubmit={submitForgot} className="mt-6 space-y-4">
                <Field label="Email professionnel">
                  <input
                    type="email"
                    autoFocus
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </Field>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-gold text-gold-foreground font-semibold py-3 hover:brightness-110 transition disabled:opacity-50"
                >
                  {loading ? "Envoi…" : "Envoyer le code"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setStep("credentials")}
                className="mt-6 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
              </button>
            </div>
          )}

          {step === "forgot-otp" && (
            <div className="animate-in fade-in slide-in-from-right-2">
              <div className="h-16 w-16 rounded-2xl bg-navy flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-gold" />
              </div>
              <h1 className="text-2xl font-bold text-navy mt-5 text-center">
                Saisissez le code reçu
              </h1>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Si un compte est associé à cette adresse, un code de vérification vient d'être
                envoyé par email. Il est valable une seule fois.
              </p>
              <form onSubmit={submitForgotOtp} className="mt-6 space-y-4">
                <Field label="Code de vérification">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                    placeholder="Code reçu par email"
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </Field>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-navy text-navy-foreground font-semibold py-3 hover:bg-navy-light disabled:opacity-50 transition"
                >
                  {loading ? "Vérification…" : "Vérifier"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => submitForgot()}
                disabled={loading}
                className="mt-4 w-full text-xs text-muted-foreground hover:text-gold transition disabled:opacity-50"
              >
                Renvoyer le code
              </button>
              <button
                type="button"
                onClick={() => setStep("credentials")}
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
              </button>
            </div>
          )}

          {step === "forgot-new-password" && (
            <div className="animate-in fade-in slide-in-from-right-2">
              <div className="h-16 w-16 rounded-2xl bg-navy flex items-center justify-center mx-auto">
                <KeyRound className="h-8 w-8 text-gold" />
              </div>
              <h1 className="text-2xl font-bold text-navy mt-5 text-center">
                Choisissez votre nouveau mot de passe
              </h1>
              <form onSubmit={submitForgotNewPassword} className="mt-6 space-y-4">
                <Field label="Nouveau mot de passe">
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      autoFocus
                      autoComplete="new-password"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="Au moins 8 caractères"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      tabIndex={-1}
                    >
                      {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirmer le mot de passe">
                  <div className="relative">
                    <input
                      type={showNewPwd2 ? "text" : "password"}
                      autoComplete="new-password"
                      value={newPwd2}
                      onChange={(e) => setNewPwd2(e.target.value)}
                      placeholder="Ressaisissez le mot de passe"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd2(!showNewPwd2)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      tabIndex={-1}
                    >
                      {showNewPwd2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                {newPwd2.length > 0 && newPwd !== newPwd2 && (
                  <div className="text-[12px] text-red-600">
                    Les deux mots de passe ne correspondent pas.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || !evaluerMotDePasse(newPwd).valide || newPwd !== newPwd2}
                  className="w-full rounded-lg bg-gold text-gold-foreground font-semibold py-3 hover:brightness-110 transition inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-5 w-5" /> Enregistrer et continuer
                </button>
              </form>
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
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      autoFocus
                      autoComplete="new-password"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="Au moins 8 caractères"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      tabIndex={-1}
                    >
                      {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirmer le mot de passe">
                  <div className="relative">
                    <input
                      type={showNewPwd2 ? "text" : "password"}
                      autoComplete="new-password"
                      value={newPwd2}
                      onChange={(e) => setNewPwd2(e.target.value)}
                      placeholder="Ressaisissez le mot de passe"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd2(!showNewPwd2)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      tabIndex={-1}
                    >
                      {showNewPwd2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                {newPwd2.length > 0 && newPwd !== newPwd2 && (
                  <div className="text-[12px] text-red-600">
                    Les deux mots de passe ne correspondent pas.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || !evaluerMotDePasse(newPwd).valide || newPwd !== newPwd2}
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

