import { Icone, Lucide } from "@/components/icones";
import { DelaiBadge } from "@/components/macros";
import { ScriptDiffere } from "@/components/scripts";
import { dateCourte } from "@/lib/libelles";
import { agendaItems } from "@/server/agenda";
import { contextePage } from "@/server/page";

export const metadata = { title: "À venir - Sentinelle" };

const COPIE_JS = `document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('icsCopyBtn');
    if (!btn) return;
    var copie = btn.innerHTML;
    btn.addEventListener('click', function () {
        var input = document.getElementById('icsUrl');
        input.select();
        navigator.clipboard.writeText(input.value).then(function () {
            btn.innerHTML = copie.replace('bi-clipboard', 'bi-check-lg').replace('Copier', 'Copié');
            setTimeout(function () { btn.innerHTML = copie; }, 2000);
        });
    });
});`;

/** agenda.html */
export default async function Agenda() {
  const page = await contextePage();
  const { user, csrf, nonce } = page;
  const [, items] = await agendaItems(user);
  const base = (user.settings.APP_BASE_URL ?? "").replace(/\/+$/, "");
  const icsUrl = user.icsToken ? `${base}/agenda.ics?token=${user.icsToken}` : null;
  const buckets: [string, typeof items, string][] = [
    ["En retard", items.filter((i) => i.days < 0), "danger"],
    ["Cette semaine", items.filter((i) => i.days >= 0 && i.days <= 7), "warning"],
    ["Ce mois-ci", items.filter((i) => i.days > 7 && i.days <= 31), "warning"],
    ["Dans les 90 jours", items.filter((i) => i.days > 31 && i.days <= 90), "info"],
  ].filter(([, lst]) => lst.length) as [string, typeof items, string][];
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">À venir</h1>
          <p className="page-subtitle">Échéances des prochaines semaines</p>
        </div>
        <div className="d-flex gap-2">
          <a
            href="/agenda.ics"
            className="btn btn-outline-primary"
            title="Télécharger un instantané des échéances au format iCalendar"
          >
            <Icone bi="bi-download" taille="1em" classes="me-1" /> Télécharger (.ics)
          </a>
          <a href="/" className="btn btn-outline-secondary">
            <Icone bi="bi-grid-1x2" taille="1em" classes="me-1" /> Tableau de bord
          </a>
        </div>
      </div>

      <div className="data-card p-3 mb-4">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Icone bi="bi-calendar-plus" taille="1em" classes="text-primary" />
          <h6 className="fw-bold mb-0">Abonnement calendrier</h6>
        </div>
        {icsUrl ? (
          <>
            <p className="small text-muted mb-2">
              Collez ce lien dans Outlook (
              <em>Ajouter un calendrier → S'abonner à partir du web</em>) ou Thunderbird (
              <em>Nouveau calendrier → Sur le réseau</em>) : votre calendrier se mettra à jour
              automatiquement, sans réexporter. Ce lien est personnel — il donne accès à vos
              échéances sans mot de passe, ne le partagez pas.
            </p>
            <div className="input-group input-group-sm mb-2">
              <input type="text" className="form-control" id="icsUrl" readOnly value={icsUrl} />
              <button type="button" className="btn btn-outline-primary" id="icsCopyBtn">
                <Icone bi="bi-clipboard" taille="1em" classes="me-1" /> Copier
              </button>
            </div>
            <div className="d-flex gap-2">
              <form method="POST" action="/agenda/ics-token">
                <input type="hidden" name="csrf_token" value={csrf} />
                <button
                  type="submit"
                  className="btn btn-outline-secondary btn-sm"
                  data-confirm="Régénérer le lien ? Les calendriers abonnés avec l'ancien lien cesseront de se mettre à jour."
                >
                  <Icone bi="bi-arrow-repeat" taille="1em" classes="me-1" /> Régénérer
                </button>
              </form>
              <form method="POST" action="/agenda/ics-token">
                <input type="hidden" name="csrf_token" value={csrf} />
                <input type="hidden" name="action" value="disable" />
                <button
                  type="submit"
                  className="btn btn-outline-danger btn-sm"
                  data-confirm="Désactiver le lien ? Les calendriers abonnés ne seront plus alimentés."
                >
                  <Icone bi="bi-x-circle" taille="1em" classes="me-1" /> Désactiver
                </button>
              </form>
            </div>
            <ScriptDiffere code={COPIE_JS} nonce={nonce} />
          </>
        ) : (
          <>
            <p className="small text-muted mb-2">
              Créez un lien personnel à coller dans Outlook ou Thunderbird : votre calendrier
              récupérera les échéances automatiquement, sans avoir à réexporter de fichier.
            </p>
            <form method="POST" action="/agenda/ics-token">
              <input type="hidden" name="csrf_token" value={csrf} />
              <button type="submit" className="btn btn-primary btn-sm">
                <Icone bi="bi-link-45deg" taille="1em" classes="me-1" /> Créer le lien d'abonnement
              </button>
            </form>
          </>
        )}
      </div>

      {!buckets.length ? (
        <div className="data-card p-5 text-center text-muted">
          <Icone bi="bi-calendar-check" taille="1em" style="font-size: 2.5rem;" />
          <p className="mt-2 mb-0">Aucune échéance dans les 90 prochains jours.</p>
        </div>
      ) : null}

      {buckets.map(([label, lst, color]) => (
        <div className="data-card mb-3" key={label}>
          <div className="card-header-custom d-flex align-items-center justify-content-between">
            <h6 className="fw-bold mb-0">
              <span className={`badge-status badge-${color} me-2`}>{label}</span>
              <span className="text-muted small">{lst.length} échéance(s)</span>
            </h6>
          </div>
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <tbody>
                {lst.map((i) => (
                  <tr className={`row-${color}`} key={`${i.url}-${i.detail}`}>
                    <td style={{ width: 130 }}>
                      <span className="fw-medium">{dateCourte(i.date)}</span>
                    </td>
                    <td style={{ width: 110 }}>
                      <DelaiBadge days={i.days} status={color} />
                    </td>
                    <td>
                      <Lucide nom={i.icon} taille={14} classes="me-1 text-muted" />
                      <a href={i.url} className="text-decoration-none fw-medium">
                        {i.name}
                      </a>
                      <span className="text-muted small ms-1">— {i.detail}</span>
                    </td>
                    <td style={{ width: 120 }}>
                      <span className="badge bg-light text-dark border">{i.cat}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
