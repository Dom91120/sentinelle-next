import { Icone } from "@/components/icones";
import { ScriptDiffere } from "@/components/scripts";
import type { CarteContext } from "@/modules/connecteurs/server";

/**
 * Carte d'un connecteur machine-à-machine (connectors/_carte_api.html) : interrupteur
 * d'activation, clé API générable, et le rappel de ce qu'il faut configurer en face.
 * UNE carte et non deux copies : les consommateurs de l'API lisent Sentinelle pour des
 * raisons différentes, mais par le même mécanisme.
 */
export function CarteApi({
  prefixe,
  titre,
  icone,
  description,
  urlAction,
  champSwitch,
  ctx,
  endpointNote,
  reponse,
  libelleUrl = "URL",
  libelleReponse = "Réponse : tableau JSON",
  csrf,
  nonce,
}: {
  prefixe: string;
  titre: string;
  icone: string;
  description: React.ReactNode;
  urlAction: string;
  champSwitch: string;
  ctx: CarteContext;
  endpointNote: string;
  reponse: string;
  libelleUrl?: string;
  libelleReponse?: string;
  csrf: string;
  nonce?: string;
}) {
  const copieJs = `(function () {
  var btn = document.getElementById('${prefixe}KeyCopy');
  var inp = document.getElementById('${prefixe}KeyValue');
  if (inp) inp.addEventListener('click', function () { inp.select(); });
  if (btn && inp) {
    btn.addEventListener('click', function () {
      inp.select(); inp.setSelectionRange(0, 99999);
      var full = inp.value;
      var mask = full.length >= 12 ? (full.slice(0, 6) + '…' + full.slice(-4)) : full;
      var done = function () {
        inp.value = mask;
        btn.textContent = 'Copié';
        btn.disabled = true;
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(full).then(done, function () { try { document.execCommand('copy'); done(); } catch (e) {} });
      } else { try { document.execCommand('copy'); done(); } catch (e) {} }
    });
  }
  // La clé n'est affichée qu'une fois : le cookie qui la porte est effacé dès l'affichage.
  try { fetch('/api/connecteurs/cle-vue', { method: 'POST', credentials: 'same-origin', body: '${prefixe}' }).catch(function () {}); } catch (e) {}
  var box = document.getElementById('${prefixe}KeyBox'); if (box) box.scrollIntoView({behavior: 'smooth', block: 'center'});
})();`;
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom d-flex justify-content-between align-items-center">
        <h6 className="fw-bold mb-0">
          <Icone bi={icone} taille="1em" classes="me-2 text-primary" />
          {titre}
        </h6>
        {ctx.enabled ? (
          <span className="badge bg-success">
            <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
            Activé
          </span>
        ) : (
          <span className="badge bg-secondary">Désactivé</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-muted small mb-2">{description}</p>

        <form method="POST" action={urlAction} className="mb-3">
          <input type="hidden" name="csrf_token" value={csrf} />
          <input type="hidden" name="action" value="save" />
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id={`${prefixe}Enabled`}
              name={champSwitch}
              defaultChecked={ctx.enabled}
            />
            <label className="form-check-label fw-medium" htmlFor={`${prefixe}Enabled`}>
              Activer le connecteur {titre}
            </label>
          </div>
          <div className="form-text">
            Désactivé : l'API <code>{endpointNote}</code> renvoie une erreur 503.
          </div>
          <button type="submit" className="btn btn-sm btn-primary mt-2">
            <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> Enregistrer
          </button>
        </form>

        <div className="border-top pt-3">
          <h6 className="fw-bold mb-1">
            <Icone bi="bi-key" taille="1em" classes="me-2 text-primary" />
            Clé API
          </h6>
          <p className="text-muted small mb-2">
            Statut :{" "}
            {ctx.keySet ? (
              <>
                <span className="text-success">clé active</span> <code>{ctx.keyMasked}</code>
              </>
            ) : (
              <span className="text-danger">aucune clé</span>
            )}
            . La clé complète n'est affichée qu'une seule fois, à sa génération (ici tronquée). La
            régénérer invalide l'ancienne.
          </p>
          <form method="POST" action={urlAction}>
            <input type="hidden" name="csrf_token" value={csrf} />
            <input type="hidden" name="action" value="generate_key" />
            <button
              type="submit"
              className="btn btn-sm btn-outline-primary"
              data-confirm={
                ctx.keySet
                  ? "Régénérer la clé ? L'ancienne cessera de fonctionner immédiatement."
                  : `Générer une clé API pour ${titre} ?`
              }
            >
              <Icone bi="bi-arrow-repeat" taille="1em" classes="me-1" />{" "}
              {ctx.keySet ? "Régénérer la clé" : "Générer une clé"}
            </button>
          </form>
          {ctx.newKey ? (
            <>
              <div className="alert alert-success mt-3 mb-0" id={`${prefixe}KeyBox`}>
                <div className="small fw-medium mb-1">
                  <Icone bi="bi-clipboard-check" taille="1em" classes="me-1" />
                  Nouvelle clé — copiez-la maintenant, elle ne sera plus affichée :
                </div>
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    id={`${prefixe}KeyValue`}
                    className="form-control font-monospace"
                    defaultValue={ctx.newKey}
                    readOnly
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    id={`${prefixe}KeyCopy`}
                  >
                    <Icone bi="bi-clipboard" taille="1em" classes="me-1" />
                    Copier
                  </button>
                </div>
              </div>
              <ScriptDiffere code={copieJs} nonce={nonce} />
            </>
          ) : null}
        </div>

        <div className="border-top pt-3 mt-3">
          <h6 className="fw-bold mb-1">
            <Icone bi="bi-link-45deg" taille="1em" classes="me-2 text-primary" />
            Configuration côté {titre}
          </h6>
          <ul className="small mb-0">
            <li>
              {libelleUrl} : <code>{ctx.endpoint}</code>
            </li>
            <li>
              En-tête : <code>Authorization: Bearer &lt;clé&gt;</code>
            </li>
            <li>
              {libelleReponse} <code>{reponse}</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
