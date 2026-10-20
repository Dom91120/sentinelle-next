import QRCode from "qrcode";
import { Icone } from "@/components/icones";
import { dateCourte } from "@/lib/libelles";
import { roleLabel } from "@/modules/users/server";
import { contextePage } from "@/server/page";
import { pendingEnrolement } from "@/server/two-factor";

export const metadata = { title: "Mon Profil - Sentinelle" };

/** QR code TOTP en <img> data-URI (robuste à l'insertion HTML). */
async function qrDataUri(uri: string): Promise<string> {
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1 });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** auth/profile.html */
export default async function ProfilePage() {
  const { user, csrf } = await contextePage();
  const pending = user.hasTwoFactor ? null : await pendingEnrolement(user.id, user.username);
  const qr = pending ? await qrDataUri(pending.uri) : null;
  const badge = user.role === "admin" ? "danger" : user.role === "editor" ? "warning" : "secondary";
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="page-title">Mon Profil</h1>
      </div>

      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="data-card p-4">
            <h6 className="fw-bold mb-3">
              <Icone bi="bi-person" taille="1em" classes="me-2" />
              Informations
            </h6>
            <table className="table table-borderless">
              <tbody>
                <tr>
                  <td className="text-muted">Utilisateur</td>
                  <td className="fw-medium">{user.username}</td>
                </tr>
                <tr>
                  <td className="text-muted">Email</td>
                  <td className="fw-medium">{user.email}</td>
                </tr>
                <tr>
                  <td className="text-muted">Role</td>
                  <td>
                    <span className={`badge bg-${badge}`}>{roleLabel(user.role)}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-muted">Inscrit le</td>
                  <td className="fw-medium">{dateCourte(user.createdAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="data-card p-4 mt-3">
            <h6 className="fw-bold mb-3">
              <Icone bi="bi-lock" taille="1em" classes="me-2" />
              Changer le mot de passe
            </h6>
            <form method="POST" action="/profile">
              <input type="hidden" name="csrf_token" value={csrf} />
              <input type="hidden" name="action" value="change_password" />
              <div className="mb-3">
                <label className="form-label" htmlFor="oldPassword">
                  Mot de passe actuel
                </label>
                <input
                  type="password"
                  name="old_password"
                  id="oldPassword"
                  className="form-control"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="newPassword">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  name="new_password"
                  id="newPassword"
                  className="form-control"
                  required
                  minLength={8}
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="confirmPassword">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  id="confirmPassword"
                  className="form-control"
                  required
                  minLength={8}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> Enregistrer
              </button>
            </form>
          </div>

          <div className="data-card p-4 mt-3">
            <h6 className="fw-bold mb-3">
              <Icone bi="bi-shield-lock" taille="1em" classes="me-2" />
              Double authentification (2FA)
            </h6>
            {pending && qr ? (
              <>
                <p className="small text-muted mb-2">
                  Scannez ce QR code avec votre application (Google / Microsoft Authenticator,
                  etc.), puis saisissez le code à 6 chiffres pour activer.
                </p>
                <div className="d-flex gap-3 align-items-center flex-wrap mb-2">
                  <div className="qr-box" style={{ width: 160 }}>
                    <img
                      src={qr}
                      alt="QR code 2FA"
                      style={{ width: "100%", height: "auto", display: "block" }}
                    />
                  </div>
                  <div>
                    <small className="text-muted d-block">Clé manuelle :</small>
                    <code style={{ wordBreak: "break-all" }}>{pending.cleManuelle}</code>
                  </div>
                </div>
                <form
                  method="POST"
                  action="/profile"
                  className="d-flex gap-2 align-items-end"
                  style={{ maxWidth: 320 }}
                >
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <input type="hidden" name="action" value="confirm_2fa" />
                  <div className="flex-grow-1">
                    <label className="form-label small" htmlFor="code2fa">
                      Code de vérification
                    </label>
                    <input
                      type="text"
                      name="code"
                      id="code2fa"
                      className="form-control"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      required
                      autoFocus
                    />
                  </div>
                  <button type="submit" className="btn btn-success">
                    <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> Activer
                  </button>
                </form>
                <form method="POST" action="/profile" className="mt-2">
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <input type="hidden" name="action" value="cancel_2fa" />
                  <button type="submit" className="btn btn-link btn-sm text-muted p-0">
                    Annuler l'activation
                  </button>
                </form>
              </>
            ) : user.hasTwoFactor ? (
              <>
                <p className="mb-2">
                  <span className="badge bg-success">
                    <Icone bi="bi-shield-check" taille="1em" classes="me-1" />
                    Activée
                  </span>{" "}
                  Une vérification par code est demandée à chaque connexion.
                </p>
                <form
                  method="POST"
                  action="/profile"
                  className="d-flex gap-2 align-items-end"
                  style={{ maxWidth: 360 }}
                >
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <input type="hidden" name="action" value="disable_2fa" />
                  <div className="flex-grow-1">
                    <label className="form-label small" htmlFor="pwd2fa">
                      Mot de passe pour confirmer
                    </label>
                    <input
                      type="password"
                      name="password"
                      id="pwd2fa"
                      className="form-control"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-outline-danger"
                    data-confirm="Désactiver la double authentification ?"
                  >
                    Désactiver
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="small text-muted mb-2">
                  Renforcez la sécurité de votre compte avec un code à usage unique (TOTP).
                </p>
                <form method="POST" action="/profile">
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <input type="hidden" name="action" value="init_2fa" />
                  <button type="submit" className="btn btn-outline-primary">
                    <Icone bi="bi-shield-plus" taille="1em" classes="me-1" /> Activer la 2FA
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
