import { Icone } from "@/components/icones";
import { ScriptDiffere } from "@/components/scripts";
import { CATEGORY_LABELS, PERMISSION_CATEGORIES, PERMISSION_LEVELS } from "@/lib/constantes";
import { roleLabel } from "@/modules/users/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { contextePage } from "@/server/page";

export const metadata = { title: "Rôles & permissions - Sentinelle" };

const CAT_ICONS: Record<string, string> = {
  accounts: "bi-key",
  certificates: "bi-award",
  domains: "bi-globe",
  backups: "bi-cloud-arrow-up",
  tests: "bi-clipboard-check",
  reviews: "bi-person-check",
  updates: "bi-arrow-up-circle",
  alerts: "bi-bell",
};
const ROLE_ICONS: Record<string, string> = {
  admin: "bi-shield-lock",
  editor: "bi-pencil-square",
  viewer: "bi-eye",
};
const ROLE_FIXED_COLORS: Record<string, string> = {
  admin: "#ef4444",
  editor: "#6366f1",
  viewer: "#0ea5e9",
};
const ROLE_PALETTE = [
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#3b82f6",
  "#f97316",
  "#a855f7",
];
const DEFAUT = ["admin", "editor", "viewer"];

const LVL_JS = `document.querySelectorAll('.lvl-select').forEach(function (sel) {
    sel.addEventListener('change', function () {
        sel.className = sel.className.replace(/\\blvl-\\d\\b/, 'lvl-' + sel.value);
    });
});`;

/** users/roles.html */
export default async function Roles() {
  const page = await contextePage();
  await requireAdmin();
  const roles = await prisma.role.findMany({ orderBy: { id: "asc" } });
  const counts: Record<string, number> = {};
  for (const r of roles) counts[r.name] = await prisma.user.count({ where: { role: r.name } });
  const { csrf, nonce } = page;
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h1 className="page-title">Rôles & permissions</h1>
          <p className="page-subtitle">
            Définissez les droits de chaque rôle, catégorie par catégorie.
          </p>
        </div>
        <a href="/users" className="btn btn-sm btn-outline-secondary">
          <Icone bi="bi-people" taille="1em" classes="me-1" /> Utilisateurs
        </a>
      </div>

      <div className="data-card p-3 mb-3">
        <div className="perm-legend">
          <strong className="small text-muted me-2">Niveaux :</strong>
          <span>
            <span className="dot" style={{ background: "var(--text-light)" }} /> Aucun
          </span>
          <span>
            <span className="dot" style={{ background: "var(--info)" }} /> Lecture
          </span>
          <span>
            <span className="dot" style={{ background: "var(--warning)" }} /> Écriture
          </span>
          <span>
            <span className="dot" style={{ background: "var(--danger)" }} /> Suppression
          </span>
          <span className="ms-auto">
            <Icone bi="bi-info-circle" taille="1em" classes="me-1" />
            Les niveaux sont cumulatifs (Suppression inclut Écriture et Lecture).
          </span>
        </div>
      </div>

      {roles.map((role, i) => {
        const perms = (role.permissions ?? {}) as Record<string, number>;
        const roleColor = ROLE_FIXED_COLORS[role.name] ?? ROLE_PALETTE[i % ROLE_PALETTE.length];
        const fixe = DEFAUT.includes(role.name);
        return (
          <div
            className="data-card p-4 mb-3 role-card"
            style={{ "--role-color": roleColor } as React.CSSProperties}
            key={role.id}
          >
            <form method="POST" action={`/users/roles/${role.id}/save`}>
              <input type="hidden" name="csrf_token" value={csrf} />
              <div className="role-head mb-3">
                <div className="role-avatar">
                  <Icone bi={ROLE_ICONS[role.name] ?? "bi-person-gear"} taille="1em" />
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                    <h5 className="fw-bold mb-0">{roleLabel(role.name)}</h5>
                    <span className="text-muted small">{role.name}</span>
                    {role.isAdmin ? (
                      <span className="badge bg-danger">
                        <Icone bi="bi-stars" taille="1em" classes="me-1" />
                        Accès total
                      </span>
                    ) : null}
                    <span className="badge-status badge-info">
                      <Icone bi="bi-people" taille="1em" classes="me-1" />
                      {counts[role.name] ?? 0} utilisateur(s)
                    </span>
                  </div>
                  <input
                    type="text"
                    name="description"
                    defaultValue={role.description ?? ""}
                    className="form-control form-control-sm"
                    style={{ maxWidth: 480 }}
                    placeholder="Description du rôle"
                  />
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-sm btn-primary">
                    <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> Enregistrer
                  </button>
                  {!fixe ? (
                    <button
                      type="submit"
                      form={`del-${role.id}`}
                      className="btn btn-sm btn-outline-danger"
                      data-confirm="Supprimer ce rôle ?"
                      data-confirm-form={`#del-${role.id}`}
                      title="Supprimer le rôle"
                      aria-label="Supprimer le rôle"
                    >
                      <Icone bi="bi-trash" taille="1em" />
                    </button>
                  ) : null}
                </div>
              </div>

              {role.isAdmin ? (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-0 py-2">
                  <Icone bi="bi-shield-fill-check" taille="1em" classes="fs-5" />
                  <div className="small">
                    Ce rôle dispose de <strong>tous les droits</strong> sur toutes les catégories,
                    ainsi que de l'accès aux sections d'administration.
                  </div>
                </div>
              ) : (
                <div className="perm-grid">
                  {PERMISSION_CATEGORIES.map((cat) => {
                    const current = Number(perms[cat] ?? 0);
                    return (
                      <div className="perm-tile" key={cat}>
                        <div className="perm-tile-head">
                          <Icone bi={CAT_ICONS[cat] ?? "bi-folder"} taille="1em" />{" "}
                          {CATEGORY_LABELS[cat]}
                        </div>
                        <select
                          name={`perm_${cat}`}
                          className={`form-select form-select-sm lvl-select lvl-${current}`}
                          defaultValue={current}
                        >
                          {Object.entries(PERMISSION_LEVELS).map(([lvl, lbl]) => (
                            <option key={lvl} value={lvl}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </form>
            {!fixe ? (
              <form
                id={`del-${role.id}`}
                method="POST"
                action={`/users/roles/${role.id}/delete`}
                className="d-none"
              >
                <input type="hidden" name="csrf_token" value={csrf} />
              </form>
            ) : null}
          </div>
        );
      })}

      <div className="data-card p-4">
        <h6 className="fw-bold mb-3">
          <Icone bi="bi-plus-circle" taille="1em" classes="me-2 text-primary" />
          Nouveau rôle
        </h6>
        <form method="POST" action="/users/roles/create" className="row g-2 align-items-end">
          <input type="hidden" name="csrf_token" value={csrf} />
          <div className="col-md-4">
            <label className="form-label small">Nom (ex. gestion-backups)</label>
            <input
              type="text"
              name="name"
              className="form-control form-control-sm"
              required
              placeholder="nom-du-role"
            />
          </div>
          <div className="col-md-5">
            <label className="form-label small">Description</label>
            <input
              type="text"
              name="description"
              className="form-control form-control-sm"
              placeholder="À quoi sert ce rôle"
            />
          </div>
          <div className="col-md-3">
            <button type="submit" className="btn btn-sm btn-primary w-100">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Créer le rôle
            </button>
          </div>
        </form>
        <small className="text-muted d-block mt-2">
          Le nouveau rôle démarre sans aucun droit ; ajustez ses permissions puis assignez-le à des
          utilisateurs.
        </small>
      </div>
      <ScriptDiffere code={LVL_JS} nonce={nonce} />
    </>
  );
}
