import { Icone } from "@/components/icones";
import { StatusBadge } from "@/components/macros";
import { delai, diffJours } from "@/lib/libelles";
import { testComputedStatus } from "@/lib/statuts";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Tests — Kanban - Sentinelle" };

const COLS: Record<string, { label: string; icon: string; color: string }> = {
  pending: { label: "À faire", icon: "bi-clock", color: "secondary" },
  success: { label: "Réussi", icon: "bi-check-circle", color: "success" },
  failed: { label: "En échec", icon: "bi-x-circle", color: "danger" },
};

const ACTIONS: [string, string][] = [
  ["success", "Réussi"],
  ["failed", "Échec"],
  ["pending", "Pending"],
];

/** tests/kanban.html */
export default async function TestsKanban() {
  const page = await contexteModule("tests");
  const { user, csrf } = page;
  const seuils = seuilsDe(user.settings);
  const tests = (await prisma.testTask.findMany({ where: { isActive: true } })).map((t) => ({ ...t, statut: testComputedStatus(t, seuils) }));
  const items: Record<string, typeof tests> = { pending: [], success: [], failed: [] };
  for (const t of tests) {
    const status = t.status || "pending";
    items[status in COLS ? status : "pending"].push(t);
  }
  const jours = (t: { nextDue: Date | null }) => (t.nextDue ? diffJours(t.nextDue) : 9999);
  for (const liste of Object.values(items)) liste.sort((a, b) => jours(a) - jours(b));
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">Tests — Vue Kanban</h1>
          <p className="page-subtitle">Glisser pour changer le statut</p>
        </div>
        <div className="d-flex gap-2">
          <a href="/tests" className="btn btn-outline-secondary">
            <Icone bi="bi-list-ul" taille="1em" classes="me-1" /> Vue liste
          </a>
          {user.canEdit("tests") ? (
            <a href="/tests/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Ajouter
            </a>
          ) : null}
        </div>
      </div>

      <div className="row g-3 kanban-board">
        {Object.entries(COLS).map(([key, col]) => (
          <div className="col-md-4" key={key}>
            <div className="kanban-column h-100" data-status={key}>
              <div className="kanban-col-header d-flex align-items-center gap-2 mb-3">
                <Icone bi={col.icon} taille="1em" classes={`text-${col.color}`} />
                <span className="fw-semibold">{col.label}</span>
                <span className={`badge bg-${col.color} rounded-pill ms-auto`}>{items[key].length}</span>
              </div>
              <div className="kanban-cards d-flex flex-column gap-2" id={`col-${key}`}>
                {items[key].length ? (
                  items[key].map((test) => {
                    const days = test.nextDue ? diffJours(test.nextDue) : null;
                    return (
                      <div className="kanban-card data-card p-3" data-id={test.id} key={test.id}>
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <a href={`/tests/${test.id}`} className="fw-medium text-decoration-none text-truncate me-2">
                            {test.name}
                          </a>
                          <StatusBadge status={test.statut} />
                        </div>
                        {test.testType ? (
                          <small className="text-muted d-block mb-1">
                            <Icone bi="bi-tag" taille="1em" classes="me-1" />
                            {test.testType}
                          </small>
                        ) : null}
                        {days !== null ? (
                          <small className={days < 0 ? "text-danger" : days <= 7 ? "text-warning" : "text-muted"}>
                            <Icone bi="bi-calendar" taille="1em" classes="me-1" />
                            {delai(days)}
                          </small>
                        ) : null}
                        {user.canEdit("tests") ? (
                          <div className="mt-2 d-flex gap-1 kanban-actions">
                            {ACTIONS.filter(([s]) => s !== key).map(([s, label]) => (
                              <form method="POST" action={`/tests/${test.id}/set-status`} className="d-inline" key={s}>
                                <input type="hidden" name="csrf_token" value={csrf} />
                                <input type="hidden" name="status" value={s} />
                                <button type="submit" className={`btn btn-xs btn-outline-${s === "success" ? "success" : s === "failed" ? "danger" : "secondary"}`} title={label}>
                                  {label}
                                </button>
                              </form>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-muted py-4">
                    <Icone bi="bi-inbox" taille="1em" classes="d-block fs-4 mb-1" />
                    <small>Aucun test</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
