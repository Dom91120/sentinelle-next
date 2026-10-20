import { notFound } from "next/navigation";
import { Icone } from "@/components/icones";
import { STATUS_LABELS } from "@/lib/libelles";
import { certificateLabel } from "@/lib/statuts";
import { chargerTout } from "@/server/donnees";
import { contextePage } from "@/server/page";

/** by_status.html : vue transversale par statut (/etat/<status>). */
export default async function ByStatus({ params }: { params: Promise<{ status: string }> }) {
  const page = await contextePage();
  const { status } = await params;
  if (!(status in STATUS_LABELS)) notFound();
  const label = STATUS_LABELS[status];
  const tout = await chargerTout();
  const { user } = page;
  const sources: [string, string, { id: number; status: string; nom: string }[], string][] = [
    [
      "accounts",
      "Comptes",
      tout.accounts.map((o) => ({
        id: o.id,
        status: o.status,
        nom: `${o.serviceName} (${o.username})`,
      })),
      "accounts",
    ],
    [
      "certificates",
      "Certificats",
      tout.certificates.map((o) => ({ id: o.id, status: o.status, nom: certificateLabel(o) })),
      "certificates",
    ],
    [
      "domains",
      "Domaines",
      tout.domains.map((o) => ({ id: o.id, status: o.status, nom: o.name })),
      "domains",
    ],
    [
      "backups",
      "Sauvegardes",
      tout.backups.map((o) => ({ id: o.id, status: o.status, nom: o.serviceName })),
      "backups",
    ],
    [
      "tests",
      "Tests",
      tout.tests.map((o) => ({ id: o.id, status: o.status, nom: o.name })),
      "tests",
    ],
    [
      "reviews",
      "Revue de droits",
      tout.reviews.map((o) => ({ id: o.id, status: o.status, nom: o.application })),
      "reviews",
    ],
    [
      "updates",
      "Mises à jour",
      tout.updates.map((o) => ({ id: o.id, status: o.status, nom: o.name })),
      "updates",
    ],
    [
      "inventory",
      "Matériel",
      tout.equipments.map((o) => ({ id: o.id, status: o.status, nom: o.name })),
      "inventory",
    ],
    [
      "software",
      "Logiciels",
      tout.software.map((o) => ({ id: o.id, status: o.status, nom: o.name })),
      "inventory/logiciels",
    ],
  ];
  const items: { cat: string; name: string; url: string }[] = [];
  for (const [cat, lbl, rows, prefix] of sources) {
    if (!user.canView(cat)) continue;
    for (const o of rows)
      if (o.status === status) items.push({ cat: lbl, name: o.nom, url: `/${prefix}/${o.id}` });
  }
  items.sort((a, b) => a.cat.localeCompare(b.cat));
  return (
    <>
      <title>{`${label} - Sentinelle`}</title>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">
            <span className={`badge-status badge-${status} me-2`}>{label}</span> {items.length}{" "}
            élément(s)
          </h1>
          <p className="page-subtitle">Vue transversale par statut</p>
        </div>
        <a href="/" className="btn btn-outline-secondary">
          <Icone bi="bi-grid-1x2" taille="1em" classes="me-1" /> Tableau de bord
        </a>
      </div>

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Élément</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((it) => (
                  <tr key={it.url} className={`row-${status}`}>
                    <td style={{ width: 180 }}>
                      <span className="badge bg-light text-dark border">{it.cat}</span>
                    </td>
                    <td>
                      <a href={it.url} className="text-decoration-none fw-medium">
                        {it.name}
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="text-center py-4 text-muted">
                    Aucun élément dans cet état.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
