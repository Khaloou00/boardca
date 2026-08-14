// Bouton de déconnexion des espaces bureau (Secrétariat, Super Admin).
//
// Ces deux espaces n'en avaient plus AUCUN : c'est le `RoleSwitcher` — supprimé
// parce qu'il permettait de basculer sur le compte super-administrateur avec un
// mot de passe en dur — qui portait jusqu'ici la déconnexion. Les utilisateurs
// se retrouvaient donc sans moyen de quitter leur session autrement qu'en
// vidant les données du navigateur.
//
// Confirmation obligatoire : ces écrans hébergent la rédaction du PV et la
// création de séance, où un clic malheureux ferait perdre une saisie en cours.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Loader2 } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { toast } from "sonner";

export function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  const logout = useBoardStore((s) => s.logout);
  const profile = useBoardStore((s) => s.profile);
  const navigate = useNavigate();
  const [confirme, setConfirme] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const partir = async () => {
    setOccupe(true);
    try {
      // `logout` du store désabonne aussi cet appareil des notifications push :
      // sans ça, le prochain utilisateur de la machine verrait passer les
      // convocations et les PV du précédent.
      await logout();
      navigate({ to: "/auth" });
    } catch {
      toast.error("Déconnexion impossible", { description: "Réessayez." });
      setOccupe(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setConfirme(true)}
        title="Se déconnecter"
        aria-label="Se déconnecter"
        className={`flex items-center gap-2 rounded-lg text-navy-foreground/70 hover:bg-white/10 hover:text-white transition ${
          collapsed ? "h-9 w-9 justify-center mx-auto" : "w-full px-3 py-2 text-[14px]"
        }`}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!collapsed && <span>Se déconnecter</span>}
      </button>

      {confirme && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
              onClick={() => !occupe && setConfirme(false)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-red-50 flex items-center justify-center">
                    <LogOut className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-navy">Quitter votre session ?</div>
                    <div className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                      Vous êtes connecté en tant que{" "}
                      <span className="font-medium text-navy">{profile?.nom ?? "—"}</span>. Toute saisie
                      en cours et non enregistrée sera perdue.
                    </div>
                  </div>
                </div>
                {/* `whitespace-nowrap` : sans lui « Se déconnecter » se coupait en deux
                    lignes dans un bouton à moitié de largeur. */}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setConfirme(false)}
                    disabled={occupe}
                    className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={partir}
                    disabled={occupe}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {occupe ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4 shrink-0" />
                    )}
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/**
 * Même déconnexion, sur fond CLAIR : les écrans « Espace réservé » sont blancs,
 * et la variante de la barre latérale (texte pâle sur navy) y serait illisible.
 *
 * Sans elle, quelqu'un connecté avec le mauvais rôle n'a aucune sortie : le
 * bouton « Se connecter en… » de ces écrans mène à /auth mais laisse sa session
 * ouverte, et il revient donc au même refus.
 */
export function LogoutButtonClair() {
  return (
    <div className="[&_button:first-child]:text-slate-500 [&_button:first-child]:hover:bg-slate-100 [&_button:first-child]:hover:text-navy [&_button:first-child]:w-auto">
      <LogoutButton />
    </div>
  );
}
