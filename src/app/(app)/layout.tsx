import { Shell } from "@/components/shell";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contextePage } from "@/server/page";

/**
 * Enveloppe des pages connectées (base.html). Applique aussi `_enforce_admin_2fa` :
 * si REQUIRE_2FA_ADMIN est actif, un administrateur sans second facteur n'est
 * admis que sur son profil (pour l'activer).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const page = await contextePage();
  const { user } = page;
  if (user.settings.REQUIRE_2FA_ADMIN && user.isAdmin && !user.hasTwoFactor) {
    const allowed = ["/profile", "/logout", "/2fa", "/login"];
    if (!allowed.includes(page.pathname)) {
      redirigerAvecFlashDepuisRendu(
        "/profile",
        "Sécurité : activez la double authentification pour continuer (obligatoire pour les comptes administrateur).",
        "warning",
      );
    }
  }
  return (
    <Shell
      user={user}
      counts={page.counts}
      pathname={page.pathname}
      flashes={page.flashes}
      csrf={page.csrf}
      nonce={page.nonce}
    >
      {children}
    </Shell>
  );
}
