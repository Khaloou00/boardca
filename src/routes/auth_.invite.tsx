// Route dédiée à la connexion d'un invité (mandataire de procuration) reçue
// par email (edge function `invite-guest`) : /auth/invite?email=...&token=...
// Distincte de /auth (5 profils + étapes 2FA/biométrie).
//
// 2026-08-05 : le compte est créé SANS mot de passe — c'est l'invité qui crée
// le sien, jamais le système (avant : mot de passe temporaire généré côté
// serveur). Le jeton porté par le lien n'est vérifié QUE lorsque l'invité
// clique explicitement sur « Accéder à mon espace invité » — jamais au simple
// chargement de la page, pour qu'un scanner de sécurité de messagerie qui
// pré-charge le lien ne puisse plus consommer le jeton avant l'ouverture
// réelle (voir mémoire). Une fois le jeton vérifié, l'invité DOIT créer son
// mot de passe personnel avant d'entrer dans l'application. Présentée dans le
// même cadre téléphone/tablette que le reste de l'expérience mobile (/mobile)
// puisque c'est la première chose qu'un invité voit avant d'y atterrir.
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp, ROLE_META } from "@/lib/app-store";
import { useBoardStore } from "@/store/useBoardStore";
import { NEW_TO_OLD_ROLE } from "@/lib/role-labels";
import { supabase } from "@/lib/supabase";
import {
  UserCheck,
  Loader2,
  ArrowLeft,
  Mail,
  Lock,
  CheckCircle2,
  Check,
  Smartphone,
  Tablet,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/auth_/invite")({
  ssr: false,
  component: AuthInvitePage,
  head: () => ({ meta: [{ title: "Espace invité — BoardCA" }] }),
});

type Critere = { ok: boolean; label: string };

function evaluerMotDePasse(pwd: string): { criteres: Critere[]; valide: boolean } {
  const criteres: Critere[] = [
    { ok: pwd.length >= 8, label: "Au moins 8 caractères" },
    { ok: /[a-z]/.test(pwd), label: "Une minuscule" },
    { ok: /[A-Z]/.test(pwd), label: "Une majuscule" },
    { ok: /[0-9]/.test(pwd), label: "Un chiffre" },
    { ok: /[^A-Za-z0-9]/.test(pwd), label: "Un caractère spécial (!@#$…)" },
  ];
  return { criteres, valide: criteres.every((c) => c.ok) };
}

type Etape = "accueil" | "creer-mdp" | "connexion";
type Appareil = "telephone" | "tablette";
const STORAGE_KEY = "mobile-preview-appareil";

function AuthInvitePage() {
  const navigate = useNavigate();
  const { login: legacyLogin } = useApp();
  const storeLogin = useBoardStore((s) => s.login);
  const completePasswordChange = useBoardStore((s) => s.completePasswordChange);

  const [email, setEmail] = useState(
    () => new URLSearchParams(window.location.search).get("email") ?? "",
  );
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  const [etape, setEtape] = useState<Etape>(token ? "accueil" : "connexion");
  const [password, setPassword] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showNewPwd2, setShowNewPwd2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | undefined>();
  // Le jeton magiclink est à usage unique : une fois vérifié avec succès une
  // 1re fois (session posée en local), le rejouer échoue côté serveur — sans
  // pour autant que le compte soit activé (mot de passe pas encore créé). Pour
  // ne jamais annoncer un lien « expiré » tant que l'invité n'a pas terminé,
  // on regarde d'abord si une session valide existe déjà (même onglet/navigateur,
  // ex. l'invité a fermé l'app avant de créer son mot de passe puis a rouvert
  // le même lien) — sans jamais appeler verifyOtp au montage (voir plus bas).
  const [resuming, setResuming] = useState(() => !!token);

  const [appareil, setAppareil] = useState<Appareil>("telephone");
  useEffect(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "telephone" || v === "tablette") setAppareil(v);
  }, []);

  const choisirAppareil = (v: Appareil) => {
    setAppareil(v);
    localStorage.setItem(STORAGE_KEY, v);
  };

  const entrerDansLApp = () => {
    const profile = useBoardStore.getState().profile;
    if (!profile) return toast.error("Session invalide, réessayez");
    legacyLogin(NEW_TO_OLD_ROLE[profile.role]); // pont legacy, voir auth.tsx
    toast.success("Bienvenue", { description: "Vous représentez un membre du Conseil." });
    navigate({ to: ROLE_META["admin"].path }); // l'invité utilise l'interface mobile
  };

  useEffect(() => {
    if (!token) return;
    (async () => {
      await useBoardStore.getState().loadProfile();
      const profile = useBoardStore.getState().profile;
      if (profile && profile.email.toLowerCase() === email.trim().toLowerCase()) {
        if (profile.mustChangePassword) {
          setNewPwd("");
          setNewPwd2("");
          setEtape("creer-mdp");
        } else {
          entrerDansLApp();
          return;
        }
      }
      setResuming(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ne s'exécute QUE sur un clic explicite de l'invité — jamais au montage.
  const accederEspace = async () => {
    setLoading(true);
    setErreur(undefined);
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "magiclink" });
      if (error) throw error;
      await useBoardStore.getState().loadProfile();
      const profile = useBoardStore.getState().profile;
      if (!profile) throw new Error("Session invalide, réessayez");
      if (profile.mustChangePassword) {
        setNewPwd("");
        setNewPwd2("");
        setEtape("creer-mdp");
      } else {
        entrerDansLApp();
      }
    } catch {
      setErreur("Ce lien n'est plus valide : il a déjà été utilisé ou a expiré.");
      setEtape("connexion");
    } finally {
      setLoading(false);
    }
  };

  const soumettreConnexion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return toast.error("Email et mot de passe requis");
    setLoading(true);
    setErreur(undefined);
    try {
      await storeLogin(email.trim(), password);
      const profile = useBoardStore.getState().profile;
      if (!profile) throw new Error("Session invalide, réessayez");
      if (profile.mustChangePassword) {
        setNewPwd("");
        setNewPwd2("");
        setEtape("creer-mdp");
      } else {
        entrerDansLApp();
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Identifiants incorrects");
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

  const contenu = (
    <div className="h-full w-full overflow-y-auto bg-white px-6 py-6 flex flex-col">
      <div className="flex flex-col items-center gap-1.5 mb-6">
        <BrandLogo imgClassName="h-6" />
        <div className="text-navy font-bold text-base">BoardCA</div>
        <div className="text-[10px] uppercase tracking-widest text-gold">Espace invité</div>
      </div>

      {etape === "accueil" && resuming && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-navy" />
          <p className="text-[12.5px] text-slate-500">Vérification de votre accès…</p>
        </div>
      )}

      {etape === "accueil" && !resuming && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-navy/5 text-navy flex items-center justify-center">
            <KeyRound className="h-7 w-7" />
          </div>
          <div className="mt-4 text-[16px] font-bold text-navy">Vous avez été désigné</div>
          <p className="mt-1.5 text-[12.5px] text-slate-500 px-2">
            Un membre du Conseil vous a désigné pour le représenter. Accédez à votre espace pour
            créer votre mot de passe personnel.
          </p>
          {email && (
            <div className="mt-3 text-[12px] text-slate-400 font-mono truncate max-w-full">
              {email}
            </div>
          )}
          <button
            onClick={accederEspace}
            disabled={loading}
            className="mt-6 w-full bg-navy text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Vérification…" : "Accéder à mon espace invité"}
          </button>
        </div>
      )}

      {etape === "connexion" && (
        <div className="flex-1 flex flex-col">
          <div className="h-12 w-12 rounded-2xl bg-navy/5 text-navy flex items-center justify-center mx-auto">
            <UserCheck className="h-6 w-6" />
          </div>
          <div className="mt-3 text-center text-[15px] font-bold text-navy">Connexion invité</div>
          <p className="mt-1 text-center text-[12px] text-slate-500">
            Utilisez l'email et le mot de passe que vous avez créés.
          </p>
          {erreur && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-center text-[12px] text-red-700">
              {erreur}
            </div>
          )}
          <form onSubmit={soumettreConnexion} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Email
              </span>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Mot de passe
              </span>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Connexion…" : "Continuer"}
            </button>
          </form>
        </div>
      )}

      {etape === "creer-mdp" && (
        <div className="flex-1 flex flex-col">
          <div className="h-12 w-12 rounded-2xl bg-navy/5 text-navy flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <div className="mt-3 text-center text-[15px] font-bold text-navy">
            Créez votre mot de passe
          </div>
          <p className="mt-1 text-center text-[12px] text-slate-500">
            Ce mot de passe personnel vous servira pour vos prochaines connexions.
          </p>
          <form onSubmit={soumettreNouveauMdp} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Mot de passe
              </span>
              <div className="relative mt-1">
                <input
                  type={showNewPwd ? "text" : "password"}
                  autoFocus
                  autoComplete="new-password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 pl-3 pr-9 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showNewPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Confirmer mot de passe
              </span>
              <div className="relative mt-1">
                <input
                  type={showNewPwd2 ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPwd2}
                  onChange={(e) => setNewPwd2(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 pl-3 pr-9 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd2((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showNewPwd2 ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showNewPwd2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5">
              {criteres.map((c) => (
                <div
                  key={c.label}
                  className={`flex items-center gap-2 text-[11px] ${c.ok ? "text-emerald-600" : "text-slate-400"}`}
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
              className="w-full bg-gold text-gold-foreground rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {loading ? "Enregistrement…" : "Enregistrer et continuer"}
            </button>
          </form>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy-light to-slate-800 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-6">
        <div className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
          <button
            onClick={() => choisirAppareil("telephone")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              appareil === "telephone" ? "bg-gold text-navy" : "text-white/70 hover:text-white"
            }`}
          >
            <Smartphone className="h-4 w-4" /> Téléphone
          </button>
          <button
            onClick={() => choisirAppareil("tablette")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              appareil === "tablette" ? "bg-gold text-navy" : "text-white/70 hover:text-white"
            }`}
          >
            <Tablet className="h-4 w-4" /> Tablette
          </button>
        </div>

        {/* Les cadres téléphone/tablette de démonstration ont été retirés (app
            réellement responsive) : le sélecteur ne borne plus que la largeur. */}
        <div className="flex justify-center w-full">
          <div
            className={`w-full ${appareil === "telephone" ? "max-w-[460px]" : "max-w-[860px]"}`}
          >
            {contenu}
          </div>
        </div>

        <Link
          to="/auth"
          className="flex items-center justify-center gap-1.5 text-xs text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Autre profil
        </Link>
      </div>
    </div>
  );
}
