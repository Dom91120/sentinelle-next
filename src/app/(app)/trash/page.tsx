import { Icone } from "@/components/icones";
import { dateHeure } from "@/lib/libelles";
import { listTrashed } from "@/server/corbeille";
import { contextePage } from "@/server/page";

export const metadata = { title: "Corbeille - Sentinelle" };

/** trash.html */
export default async function Trash() {
  const page = await contextePage();
  const groups = await listTrashed(page.user);
  const { csrf } = page;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Corbeille</h1>
          <p className="page-subtitle">Éléments supprimés — restaurables</p>
        </div>
        <div className="d-flex gap-2">
          {groups.some((g) => g.canPurge) ? (
            <form method="POST" action="/trash/purge">
              <input type="hidden" name="csrf_token" value={csrf} />
              <button type="submit" className="btn btn-outline-danger" data-confirm="Vider la corbeille ? Cette suppression est définitive.">
                <Icone bi="bi-trash3" taille="1em" classes="me-1" /> Vider la corbeille
              </button>
            </form>
          ) : null}
          <a href="/" className="btn btn-outline-secondary">
            <Icone bi="bi-grid-1x2" taille="1em" classes="me-1" /> Tableau de bord
          </a>
        </div>
      </div>

      {!groups.length ? (
        <div className="data-card p-5 text-center text-muted">
          <Icone bi="bi-trash3" taille="1em" style="font-size: 2.5rem;" />
          <p className="mt-2 mb-0">La corbeille est vide.</p>
        </div>
      ) : null}

      {groups.map((g) => (
        <div className="data-card mb-3" key={g.etype}>
          <div className="card-header-custom">
            <h6 className="fw-bold mb-0">
              {g.label} <span className="text-muted small">({g.items.length})</span>
            </h6>
          </div>
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <tbody>
                {g.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    <td className="text-muted" style={{ width: 160 }}>
                      {it.date ? dateHeure(it.date) : ""}
                    </td>
                    <td style={{ width: 230 }}>
                      <div className="d-flex gap-1">
                        <form method="POST" action="/trash/restore">
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <input type="hidden" name="entity_type" value={g.etype} />
                          <input type="hidden" name="entity_id" value={it.id} />
                          <button type="submit" className="btn btn-sm btn-outline-success">
                            <Icone bi="bi-arrow-counterclockwise" taille="1em" classes="me-1" /> Restaurer
                          </button>
                        </form>
                        {g.canPurge ? (
                          <form method="POST" action="/trash/purge-one">
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <input type="hidden" name="entity_type" value={g.etype} />
                            <input type="hidden" name="entity_id" value={it.id} />
                            <button type="submit" className="btn btn-sm btn-outline-danger" title="Supprimer définitivement" aria-label="Supprimer définitivement" data-confirm="Supprimer définitivement cet élément ?">
                              <Icone bi="bi-trash" taille="1em" />
                            </button>
                          </form>
                        ) : null}
                      </div>
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
