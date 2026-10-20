import { redirect } from "next/navigation";
import { ScriptsPage } from "@/components/scripts";
import { getCurrentUser } from "@/server/guards";
import { contexteAnonyme } from "@/server/page";

export const metadata = { title: "Connexion - Sentinelle" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Déjà connecté : la page de login n'a pas de sens.
  if (await getCurrentUser()) redirect("/");
  const { nonce, csrf, flashes } = await contexteAnonyme();
  const sp = await searchParams;
  const next = sp.next ?? "";
  return (
    <>
      <div className="login-container">
        <div className="login-wrap">
          <div className="login-brand">
            <img src="/logo.svg" alt="" className="login-logo" />
            <div>
              <div className="login-brand-name">Sentinelle</div>
              <div className="login-brand-tagline">Supervision et inventaire de la DSI</div>
            </div>
          </div>
          <div className="login-card">
            <h1>Connexion</h1>
            {flashes.map(([category, message], i) => (
              <div
                key={i}
                className={`alert alert-${["success", "danger", "warning", "info"].includes(category) ? category : "info"}`}
              >
                {message}
              </div>
            ))}
            {flashes.length ? <script src="/js/flash-clear.js" nonce={nonce} /> : null}
            <form
              method="POST"
              action={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            >
              <input type="hidden" name="csrf_token" value={csrf} />
              <div className="mb-3">
                <label className="form-label" htmlFor="login-username">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  id="login-username"
                  name="username"
                  className="form-control"
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div className="mb-4">
                <label className="form-label" htmlFor="login-password">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="login-password"
                  name="password"
                  className="form-control"
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn btn-primary w-100">
                Se connecter
              </button>
            </form>
          </div>
        </div>
      </div>
      <ScriptsPage nonce={nonce} />
    </>
  );
}
