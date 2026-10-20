import { Icone } from "@/components/icones";
import { CATEGORY_LABELS, WEBHOOK_CATEGORIES, WEBHOOK_CHANNELS } from "@/lib/constantes";
import { carteContext } from "@/modules/connecteurs/server";
import { CarteApi } from "@/modules/connecteurs/vues";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { contextePage } from "@/server/page";

export const metadata = { title: "Connecteurs - Sentinelle" };

/** connectors/index.html */
export default async function Connecteurs() {
  const page = await contextePage();
  const admin = await requireAdmin();
  const cfg = admin.settings;
  const { csrf, nonce } = page;
  const [sesame, chatia, categoryWebhooks] = await Promise.all([
    carteContext(cfg, "sesame"),
    carteContext(cfg, "chatia"),
    prisma.webhook.findMany({ orderBy: [{ category: "asc" }, { channel: "asc" }] }),
  ]);
  const webhooks = {
    teams: cfg.TEAMS_WEBHOOK_URL || "",
    slack: cfg.SLACK_WEBHOOK_URL || "",
    discord: cfg.DISCORD_WEBHOOK_URL || "",
  };
  const configure = Boolean(
    webhooks.teams || webhooks.slack || webhooks.discord || categoryWebhooks.length,
  );
  const libelle = (cat: string) => (CATEGORY_LABELS as Record<string, string>)[cat] ?? cat;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="page-title">Connecteurs</h1>
          <p className="page-subtitle">Intégrations de Sentinelle avec des outils externes</p>
        </div>
      </div>

      <CarteApi
        prefixe="sesame"
        titre="Sesame"
        icone="bi-plug"
        description={
          <>
            Expose la liste des applications (logiciels métiers) à l'outil <strong>Sesame</strong>{" "}
            pour éviter la double saisie. Sesame l'importe via une requête authentifiée par clé.
          </>
        }
        urlAction="/connecteurs/sesame"
        champSwitch="sesame_enabled"
        ctx={sesame}
        endpointNote="/api/assets"
        reponse="{ id, name, description, is_active, responsible, responsible_email }"
        csrf={csrf}
        nonce={nonce}
      />

      <CarteApi
        prefixe="chatia"
        titre="chatIA"
        icone="bi-stars"
        description={
          <>
            Permet à l'assistant <strong>chatIA</strong> de la Ville de répondre aux questions de la
            DSI sur les échéances suivies ici : mots de passe à renouveler, certificats, noms de
            domaine, sauvegardes non vérifiées, tests, revues de droits, mises à jour, contrats.{" "}
            <strong>Lecture seule</strong> : aucun mot de passe, aucune clé ni aucun texte libre
            (description, notes) dans les réponses.
          </>
        }
        urlAction="/connecteurs/chatia"
        champSwitch="chatia_enabled"
        ctx={chatia}
        endpointNote="/api/chatia/…"
        reponse="echeances?dans=30&type=certificat · alertes · synthese · recherche?q=…"
        libelleUrl="Adresse de Sentinelle (à saisir dans chatIA : Administration › Applications › Sentinelle)"
        libelleReponse="Lectures (GET, objets JSON) :"
        csrf={csrf}
        nonce={nonce}
      />

      <div className="data-card mb-3">
        <div className="card-header-custom d-flex justify-content-between align-items-center">
          <h6 className="fw-bold mb-0">
            <Icone bi="bi-bell" taille="1em" classes="me-2 text-primary" />
            Notifications (webhooks)
          </h6>
          {configure ? (
            <span className="badge bg-success">
              <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
              Configuré
            </span>
          ) : (
            <span className="badge bg-secondary">Non configuré</span>
          )}
        </div>
        <div className="p-3">
          <p className="text-muted small mb-2">
            Poste les alertes dans Microsoft Teams, Slack et/ou Discord, en plus du mail.
          </p>
          <form method="POST" action="/connecteurs/webhooks">
            <input type="hidden" name="csrf_token" value={csrf} />
            <div className="row g-2">
              {(
                [
                  [
                    "teams",
                    "bi-microsoft-teams",
                    "Microsoft Teams",
                    "https://...webhook.office.com/...",
                  ],
                  ["slack", "bi-slack", "Slack", "https://hooks.slack.com/services/..."],
                  ["discord", "bi-discord", "Discord", "https://discord.com/api/webhooks/..."],
                ] as const
              ).map(([canal, bi, nom, placeholder]) => (
                <div key={canal} className="col-12 row g-2 m-0 p-0">
                  <div className="col-md-9">
                    <label className="form-label small" htmlFor={`${canal}Webhook`}>
                      <Icone bi={bi} taille="1em" classes="me-1" />
                      {nom}{" "}
                      {webhooks[canal] ? <span className="text-success">— configuré</span> : null}
                    </label>
                    <input
                      type="url"
                      name={`${canal}_webhook`}
                      id={`${canal}Webhook`}
                      className="form-control form-control-sm"
                      defaultValue={webhooks[canal]}
                      placeholder={placeholder}
                    />
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <button
                      type="submit"
                      name="action"
                      value={`test_${canal}`}
                      className="btn btn-sm btn-outline-primary w-100"
                      disabled={!webhooks[canal]}
                    >
                      <Icone bi="bi-send" taille="1em" classes="me-1" /> Tester
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="submit"
              name="action"
              value="save_webhooks"
              className="btn btn-sm btn-primary mt-2"
            >
              <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> Enregistrer les notifications
            </button>
            <small className="text-muted d-block mt-1">
              Les alertes sont postées dans tous les canaux renseignés, en plus du mail.
            </small>
          </form>

          <hr className="my-3" />
          <h6 className="fw-bold mb-1">
            <Icone bi="bi-diagram-2" taille="1em" classes="me-2 text-primary" />
            Webhooks par catégorie
          </h6>
          <p className="text-muted small mb-2">
            Ajoutez autant de webhooks que nécessaire, ciblés sur une catégorie de gestion (ou «
            Toutes »). Une alerte d'une catégorie est postée sur ses webhooks (plus ceux « Toutes »
            et les webhooks globaux ci-dessus).
          </p>

          <form
            method="POST"
            action="/connecteurs/webhooks"
            className="row g-2 align-items-end mb-2"
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <input type="hidden" name="action" value="add_webhook" />
            <div className="col-md-3">
              <label className="form-label small" htmlFor="whCategory">
                Catégorie
              </label>
              <select
                name="wh_category"
                id="whCategory"
                className="form-select form-select-sm"
                defaultValue="all"
              >
                <option value="all">Toutes</option>
                {WEBHOOK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {libelle(cat)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small" htmlFor="whChannel">
                Canal
              </label>
              <select name="wh_channel" id="whChannel" className="form-select form-select-sm">
                {Object.entries(WEBHOOK_CHANNELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-5">
              <label className="form-label small" htmlFor="whUrl">
                URL du webhook
              </label>
              <input
                type="url"
                name="wh_url"
                id="whUrl"
                className="form-control form-control-sm"
                required
                placeholder="https://..."
              />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-sm btn-primary w-100">
                <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Ajouter
              </button>
            </div>
            <div className="col-md-5">
              <input
                type="text"
                name="wh_label"
                className="form-control form-control-sm"
                placeholder="Libellé (optionnel)"
                aria-label="Libellé"
              />
            </div>
          </form>

          {categoryWebhooks.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Catégorie</th>
                    <th>Canal</th>
                    <th>URL</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {categoryWebhooks.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <span className={`badge bg-${w.category === "all" ? "secondary" : "info"}`}>
                          {w.category === "all" ? "Toutes" : libelle(w.category)}
                        </span>
                      </td>
                      <td>{WEBHOOK_CHANNELS[w.channel] ?? w.channel}</td>
                      <td className="text-muted small text-truncate" style={{ maxWidth: 280 }}>
                        {w.label || w.url}
                      </td>
                      <td className="text-end text-nowrap">
                        <form method="POST" action="/connecteurs/webhooks" className="d-inline">
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <input type="hidden" name="action" value="test_webhook" />
                          <input type="hidden" name="wh_id" value={w.id} />
                          <button
                            type="submit"
                            className="btn btn-sm btn-outline-primary py-0 px-1"
                            title="Tester"
                            aria-label="Tester"
                          >
                            <Icone bi="bi-send" taille="1em" />
                          </button>
                        </form>{" "}
                        <form method="POST" action="/connecteurs/webhooks" className="d-inline">
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <input type="hidden" name="action" value="delete_webhook" />
                          <input type="hidden" name="wh_id" value={w.id} />
                          <button
                            type="submit"
                            className="btn btn-sm btn-outline-danger py-0 px-1"
                            title="Supprimer"
                            aria-label="Supprimer"
                            data-confirm="Supprimer ce webhook ?"
                          >
                            <Icone bi="bi-trash" taille="1em" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted small mb-0">Aucun webhook par catégorie pour le moment.</p>
          )}
        </div>
      </div>

      <div className="data-card">
        <div className="p-4 text-center text-muted">
          <Icone bi="bi-plugin" taille="1em" style="font-size: 1.6rem;" />
          <p className="mb-0 mt-2 small">D'autres connecteurs viendront s'ajouter ici.</p>
        </div>
      </div>
    </>
  );
}
