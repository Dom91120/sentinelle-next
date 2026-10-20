import { Icone } from "@/components/icones";
import { PaginationBar } from "@/components/liste";
import { dateHeure } from "@/lib/libelles";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { contextePage } from "@/server/page";
import { paginate, resolvePerPage } from "@/server/paging";

export const metadata = { title: "Journal d'audit - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;
type Ligne = {
  when: Date;
  cat: string;
  action: string;
  comment: string | null;
  by: string | null;
  url: string | null;
};

const CAP = 3000;

/** users/audit.html */
export default async function Audit({ searchParams }: { searchParams: Params }) {
  const page = await contextePage();
  await requireAdmin();
  const params = await searchParams;
  const rows: Ligne[] = [];
  const prendre =
    (cat: string, prefix: string) =>
    (
      h: { performedAt: Date; action: string; comment: string | null; performedBy: string | null },
      fk: number,
    ) =>
      rows.push({
        when: h.performedAt,
        cat,
        action: h.action,
        comment: h.comment,
        by: h.performedBy,
        url: `/${prefix}/${fk}`,
      });
  const [a, c, d, b, t, r, u, logs] = await Promise.all([
    prisma.accountHistory.findMany({ orderBy: { performedAt: "desc" }, take: CAP }),
    prisma.certificateHistory.findMany({ orderBy: { performedAt: "desc" }, take: CAP }),
    prisma.domainHistory.findMany({ orderBy: { performedAt: "desc" }, take: CAP }),
    prisma.backupHistory.findMany({ orderBy: { performedAt: "desc" }, take: CAP }),
    prisma.testHistory.findMany({ orderBy: { performedAt: "desc" }, take: CAP }),
    prisma.reviewHistory.findMany({ orderBy: { performedAt: "desc" }, take: CAP }),
    prisma.updateHistory.findMany({ orderBy: { performedAt: "desc" }, take: CAP }),
    prisma.actionLog.findMany({ orderBy: { performedAt: "desc" }, take: CAP }),
  ]);
  for (const h of a) prendre("Compte", "accounts")(h, h.accountId);
  for (const h of c) prendre("Certificat", "certificates")(h, h.certificateId);
  for (const h of d) prendre("Domaine", "domains")(h, h.domainId);
  for (const h of b) prendre("Backup", "backups")(h, h.backupId);
  for (const h of t) prendre("Test", "tests")(h, h.testId);
  for (const h of r) prendre("Revue", "reviews")(h, h.reviewId);
  for (const h of u) prendre("Mise a jour", "updates")(h, h.updateId);
  for (const l of logs)
    rows.push({
      when: l.performedAt,
      cat: l.category || "Système",
      action: l.action,
      comment: l.detail,
      by: l.username,
      url: null,
    });

  const q = String(params.q ?? "").trim();
  let lignes = rows;
  if (q) {
    const ql = q.toLowerCase();
    lignes = rows.filter((x) =>
      [x.action, x.comment, x.by, x.cat]
        .map((v) => v ?? "")
        .join(" ")
        .toLowerCase()
        .includes(ql),
    );
  }
  lignes.sort((x, y) => y.when.getTime() - x.when.getTime());
  const perPage = await resolvePerPage(params, page.user, "users.audit");
  const [pageRows, p] = paginate(lignes, params, perPage);
  const perPageParam = page.search.get("per_page");
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">Journal d'audit</h1>
          <p className="page-subtitle">
            Qui a fait quoi, et quand — {p.total} action(s){q ? ` pour « ${q} »` : ""}
          </p>
        </div>
        <a href="/users" className="btn btn-outline-secondary">
          <Icone bi="bi-people" taille="1em" classes="me-1" /> Utilisateurs
        </a>
      </div>

      <form method="GET" action="/users/audit" className="mb-3">
        <div className="input-group" style={{ maxWidth: 480 }}>
          <span className="input-group-text">
            <Icone bi="bi-search" taille="1em" />
          </span>
          {perPageParam ? <input type="hidden" name="per_page" value={perPageParam} /> : null}
          <input
            type="text"
            name="q"
            defaultValue={q}
            className="form-control"
            placeholder="Rechercher (action, détail, utilisateur, catégorie)..."
          />
          <button type="submit" className="btn btn-primary">
            Rechercher
          </button>
          {q ? (
            <a href="/users/audit" className="btn btn-outline-secondary">
              Effacer
            </a>
          ) : null}
        </div>
      </form>

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Catégorie</th>
                <th>Action</th>
                <th>Commentaire</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? (
                pageRows.map((x, i) => (
                  <tr key={`${x.when.getTime()}-${i}`}>
                    <td style={{ width: 150, whiteSpace: "nowrap" }}>{dateHeure(x.when)}</td>
                    <td>
                      {x.url ? (
                        <a
                          href={x.url}
                          className="badge bg-light text-dark border text-decoration-none"
                        >
                          {x.cat}
                        </a>
                      ) : (
                        <span className="badge bg-light text-dark border">{x.cat}</span>
                      )}
                    </td>
                    <td>
                      <span className="fw-medium">{x.action}</span>
                    </td>
                    <td className="text-muted">{x.comment || "-"}</td>
                    <td>{x.by || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">
                    Aucune action enregistrée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
