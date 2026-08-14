// Route d'activation de compte : sert deux flux distincts, distingués par le
// paramètre `type` de l'URL.
//   - `type` absent (défaut) : invité/mandataire désigné par un membre du CA
//     (edge function `invite-guest`) — /auth/invite?email=...&token=...
//   - `type=activation` : compte classique créé par le Super Admin, sans mot
//     de passe posé par personne (edge function `admin-users`) —
//     /auth/invite?email=...&token=...&type=activation
// Les deux partagent exactement la même mécanique (lien à usage unique,
// création du mot de passe personnel) ; seule la copie change.
//
// 2026-08-14 : email PRÉ-REMPLI depuis le paramètre `?email=` du lien reçu —
// décision explicite (demande produit), qui remplace la règle précédente
// « jamais de pré-remplissage » (le compromis vie privée/URL en clair est
// assumé).
//
// Le compte est créé SANS mot de passe — c'est le destinataire qui crée le
// sien, jamais le système. Le jeton porté par le lien n'est vérifié QUE
// lorsque l'utilisateur clique explicitement sur le bouton d'activation —
// jamais au simple chargement de la page, pour qu'un scanner de sécurité de
// messagerie qui pré-charge le lien ne puisse pas consommer le jeton avant
// l'ouverture réelle (voir mémoire). Une fois le jeton vérifié, DOIT créer
// son mot de passe personnel avant d'entrer dans l'application.
//
// 2FA : une connexion par email + mot de passe (étape "connexion", pour un
// compte déjà activé) exige ensuite un code reçu par email avant d'entrer —
// même mécanique que /auth (voir `send-login-otp`). Ne s'applique PAS à
// l'activation initiale par lien (déjà un facteur fort à usage unique).
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp, ROLE_META } from "@/lib/app-store";
import { useBoardStore } from "@/store/useBoardStore";
import { NEW_TO_OLD_ROLE, ROLE_LABELS } from "@/lib/role-labels";
import { supabase } from "@/lib/supabase";
import {
  UserCheck,
  Loader2,
  Lock,
  CheckCircle2,
  Check,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { evaluerMotDePasse } from "@/lib/mot-de-passe";
import { BrandLogo } from "@/components/brand-logo";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth_/invite")({
  ssr: false,
  component: AuthInvitePage,
  head: () => ({ meta: [{ title: "Activation du compte — BoardCA" }] }),
});

type Etape = "accueil" | "creer-mdp" | "connexion" | "connexion-otp";

function AuthInvitePage() {
  const navigate = useNavigate();
  const { login: legacyLogin } = useApp();
  const storeLogin = useBoardStore((s) => s.login);
  const completePasswordChange = useBoardStore((s) => s.completePasswordChange);

  const [type] = useState<"invite" | "activation">(
    () => (new URLSearchParams(window.location.search).get("type") === "activation"
      ? "activation"
      : "invite"),
  );
  const estActivation = type === "activation";

  const [email, setEmail] = useState(
    () => new URLSearchParams(window.location.search).get("email") ?? "",
  );
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  const [etape, setEtape] = useState<Etape>(token ? "accueil" : "connexion");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showNewPwd2, setShowNewPwd2] = useState(false);
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | undefined>();
  // Le jeton magiclink est à usage unique : une fois vérifié avec succès une
  // 1re fois (session posée en local), le rejouer échoue côté serveur — sans
  // pour autant que le compte soit activé (mot de passe pas encore créé). Pour
  // ne jamais annoncer un lien « expiré » tant que l'activation n'est pas
  // terminée, on regarde d'abord si une session valide existe déjà (même
  // onglet/navigateur, ex. fermé avant de créer le mot de passe puis rouvert
  // le même lien) — sans jamais appeler verifyOtp au montage (voir plus bas).
  const [resuming, setResuming] = useState(() => !!token);

  const entrerDansLApp = () => {
    const profile = useBoardStore.getState().profile;
    if (!profile) return toast.error("Session invalide, réessayez");
    const oldRole = NEW_TO_OLD_ROLE[profile.role]; // pont legacy, voir auth.tsx
    legacyLogin(oldRole);
    toast.success(
      estActivation ? `Bienvenue, ${ROLE_LABELS[profile.role].label}` : "Bienvenue",
      { description: estActivation ? undefined : "Vous représentez un membre du Conseil." },
    );
    navigate({ to: ROLE_META[oldRole].path });
  };

  // Bascule commune aux trois points d'entrée authentifiés (reprise de
  // session, activation par lien, connexion par mot de passe + code) :
  // premier mot de passe à créer, ou entrée directe.
  const apresAuthentification = () => {
    const profile = useBoardStore.getState().profile;
    if (!profile) return toast.error("Session invalide, réessayez");
    if (profile.mustChangePassword) {
      setNewPwd("");
      setNewPwd2("");
      setEtape("creer-mdp");
    } else {
      entrerDansLApp();
    }
  };

  useEffect(() => {
    if (!token) return;
    (async () => {
      await useBoardStore.getState().loadProfile();
      const profile = useBoardStore.getState().profile;
      // Comparaison avec l'email du lien : au montage, `email` en est déjà
      // pré-rempli, donc équivalent — mais explicite plutôt qu'implicite.
      if (profile && profile.email.toLowerCase() === email.trim().toLowerCase()) {
        apresAuthentification();
        setResuming(false);
        return;
      }
      setResuming(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ne s'exécute QUE sur un clic explicite — jamais au montage.
  const accederEspace = async () => {
    setLoading(true);
    setErreur(undefined);
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "magiclink" });
      if (error) throw error;
      await useBoardStore.getState().loadProfile();
      apresAuthentification();
    } catch {
      setErreur("Ce lien n'est plus valide : il a déjà été utilisé ou a expiré.");
      setEtape("connexion");
    } finally {
      setLoading(false);
    }
  };

  // Envoie (ou renvoie) le code de connexion — appelé après un mot de passe
  // validé. L'email n'est jamais transmis : la fonction serveur le lit sur la
  // session déjà établie par `storeLogin`.
  const envoyerCodeConnexion = async () => {
    await supabase.functions.invoke("send-login-otp");
    setLoginOtpCode("");
    setEtape("connexion-otp");
  };

  const soumettreConnexion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return toast.error("Email et mot de passe requis");
    setLoading(true);
    setErreur(undefined);
    try {
      await storeLogin(email.trim(), password);
      await envoyerCodeConnexion();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  const soumettreConnexionOtp = async (e: React.FormEvent) => {
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
      apresAuthentification();
    } catch {
      toast.error("Code invalide ou expiré");
    } finally {
      setLoading(false);
    }
  };

  const { criteres, valide } = evaluerMotDePasse(newPwd);
  const soumettreNouveauMdp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valide) return toast.error("Le mot de passe ne respecte pas encore tous les critères");
    if (newPwd !== newPwd2) return toast.error("Les deux mots de passe ne correspondent pas");
    setLoading(true);
    try {
      await completePasswordChange(newPwd);
      toast.success("Mot de passe créé");
      entrerDansLApp();
    } catch (e) {
      toast.error("Échec de la création du mot de passe", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          <BrandLogo imgClassName="h-7" />
          <div className="text-navy font-bold text-lg">BoardCA</div>
          <div className="text-[10px] uppercase tracking-widest text-gold">
            {estActivation ? "Activation du compte" : "Espace invité"}
          </div>
        </div>

        {etape === "accueil" && resuming && (
          <div className="flex flex-col items-center text-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-navy" />
            <p className="text-sm text-muted-foreground">Vérification de votre accès…</p>
          </div>
        )}

        {etape === "accueil" && !resuming && (
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-16 w-16 rounded-2xl bg-navy flex items-center justify-center">
              <KeyRound className="h-8 w-8 text-gold" />
            </div>
            <h1 className="text-2xl font-bold text-navy mt-2">
              {estActivation ? "Bienvenue chez BoardCA" : "Vous avez été désigné"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {estActivation
                ? "Votre compte a été créé. Activez-le pour créer votre mot de passe personnel."
                : "Un membre du Conseil vous a désigné pour le représenter. Accédez à votre espace pour créer votre mot de passe personnel."}
            </p>
            {email && (
              <div className="text-xs text-muted-foreground font-mono truncate max-w-full">
                {email}
              </div>
            )}
            <button
              onClick={accederEspace}
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-navy text-navy-foreground font-semibold py-3 hover:bg-navy-light disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading
                ? "Vérification…"
                : estActivation
                  ? "Activer mon compte"
                  : "Accéder à mon espace invité"}
            </button>
          </div>
        )}

        {etape === "connexion" && (
          <div>
            <div className="h-16 w-16 rounded-2xl bg-navy flex items-center justify-center mx-auto">
              <UserCheck className="h-8 w-8 text-gold" />
            </div>
            <h1 className="text-2xl font-bold text-navy mt-5 text-center">Connexion</h1>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Utilisez l'email et le mot de passe que vous avez créés.
            </p>
            {erreur && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-center text-[12px] text-red-700">
                {erreur}
              </div>
            )}
            <form onSubmit={soumettreConnexion} className="mt-6 space-y-4">
              <Field label="Email">
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
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-navy text-navy-foreground font-semibold py-3 hover:bg-navy-light disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Connexion…" : "Continuer"}
              </button>
            </form>
          </div>
        )}

        {etape === "connexion-otp" && (
          <div>
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
            <form onSubmit={soumettreConnexionOtp} className="mt-6 space-y-4">
              <Field label="Code de vérification">
                <div className="flex justify-center">
                  <InputOTP maxLength={8} value={loginOtpCode} onChange={(val) => setLoginOtpCode(val)} autoFocus>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="w-10 h-14 text-lg" />
                      <InputOTPSlot index={1} className="w-10 h-14 text-lg" />
                      <InputOTPSlot index={2} className="w-10 h-14 text-lg" />
                      <InputOTPSlot index={3} className="w-10 h-14 text-lg" />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={4} className="w-10 h-14 text-lg" />
                      <InputOTPSlot index={5} className="w-10 h-14 text-lg" />
                      <InputOTPSlot index={6} className="w-10 h-14 text-lg" />
                      <InputOTPSlot index={7} className="w-10 h-14 text-lg" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
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
          </div>
        )}

        {etape === "creer-mdp" && (
          <div>
            <div className="h-16 w-16 rounded-2xl bg-navy flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-gold" />
            </div>
            <h1 className="text-2xl font-bold text-navy mt-5 text-center">
              Créez votre mot de passe
            </h1>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Ce mot de passe personnel vous servira pour vos prochaines connexions.
            </p>
            <form onSubmit={soumettreNouveauMdp} className="mt-6 space-y-4">
              <Field label="Nouveau mot de passe">
                <div className="relative">
                  <input
                    type={showNewPwd ? "text" : "password"}
                    autoFocus
                    autoComplete="new-password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd((v) => !v)}
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
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd2((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    tabIndex={-1}
                  >
                    {showNewPwd2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <div className="rounded-lg bg-muted/40 border border-input p-3 space-y-1.5">
                {criteres.map((c) => (
                  <div
                    key={c.label}
                    className={`flex items-center gap-2 text-[12px] ${c.ok ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                    <Check className={`h-3.5 w-3.5 ${c.ok ? "opacity-100" : "opacity-30"}`} />
                    {c.label}
                  </div>
                ))}
              </div>
              {newPwd2.length > 0 && newPwd !== newPwd2 && (
                <div className="text-[12px] text-red-600">
                  Les deux mots de passe ne correspondent pas.
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !valide || newPwd !== newPwd2}
                className="w-full rounded-lg bg-gold text-gold-foreground font-semibold py-3 hover:brightness-110 transition inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                {loading ? "Enregistrement…" : "Enregistrer et continuer"}
              </button>
            </form>
          </div>
        )}

        <Link
          to="/auth"
          className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
        </Link>
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
