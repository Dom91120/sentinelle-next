import { redirect } from "next/navigation";
import { Icone } from "@/components/icones";
import { ScriptsPage } from "@/components/scripts";
import { getCurrentUser } from "@/server/guards";
import { contexteAnonyme } from "@/server/page";
import { pending2fa } from "@/server/session-2fa";

export const metadata = { title: "Vérification - Sentinelle" };

/** auth/two_factor.html : saisie du code après le mot de passe. */
export default async function TwoFactorPage() {
  // Depuis le menu utilisateur (« Sécurité »), un utilisateur connecté arrive ici : le
  // réglage du second facteur vit sur le profil.
  if (await getCurrentUser()) redirect("/profile");
  const pending = await pending2fa();
  if (!pending) redirect("/login");
  const { nonce, csrf, flashes } = await contexteAnonyme();
  return (
    <>
      <div className="login-container">
        <div className="login-card">
          <div className="text-center mb-4">
            <img src="/img/logo.svg" alt="Sentinelle" className="login-logo mb-2" />
            <h3 className="fw-bold">Vérification en deux étapes</h3>
            <p className="text-muted">Saisissez le code de votre application d'authentification</p>
          </div>
          {flashes.map(([category, message], i) => (
            <div key={i} className={`alert alert-${category} py-2 small mb-3`}>
              {message}
            </div>
          ))}
          {flashes.length ? <script src="/js/flash-clear.js" nonce={nonce} /> : null}
          <form method="POST" action="/2fa">
            <input type="hidden" name="csrf_token" value={csrf} />
            <div className="mb-3">
              <input
                type="text"
                name="code"
                className="form-control form-control-lg text-center"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                required
                autoFocus
                style={{ letterSpacing: ".3em" }}
              />
            </div>
            <button type="submit" className="btn btn-primary w-100 py-2">
              <Icone bi="bi-shield-check" taille="1em" classes="me-1" /> Vérifier
            </button>
          </form>
          <div className="text-center mt-3">
            <a href="/login" className="small text-muted">
              Annuler
            </a>
          </div>
        </div>
      </div>
      <ScriptsPage nonce={nonce} />
    </>
  );
}
