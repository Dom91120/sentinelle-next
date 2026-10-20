import { Icone } from "@/components/icones";
import { Actions } from "@/components/liste";
import { dateCourte } from "@/lib/libelles";
import { roleLabel } from "@/modules/users/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { contextePage } from "@/server/page";

export const metadata = { title: "Utilisateurs - Sentinelle" };

/** users/list.html */
export default async function UsersList() {
  const page = await contextePage();
  await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, include: { twofactor: { select: { verified: true } } } });
  const { user: moi, csrf } = page;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Utilisateurs <span className="page-count">{users.length}</span>
          </h1>
          <p className="page-subtitle">Qui se connecte à Sentinelle, avec quel rôle</p>
        </div>
        <div className="page-actions">
          <a href="/users/roles" className="btn btn-outline-secondary">
            <Icone bi="bi-shield-lock" taille="1em" classes="me-1" /> Rôles & permissions
          </a>
          <a href="/users/create" className="btn btn-primary">
            <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouvel utilisateur
          </a>
        </div>
      </div>

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Role</th>
                <th>Type</th>
                <th>2FA</th>
                <th>Cree le</th>
                <th className="col-actions">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const has2fa = u.twoFactorEnabled && u.twofactor.some((t) => t.verified);
                return (
                  <tr key={u.id}>
                    <td className="fw-medium">
                      <Icone bi="bi-person-circle" taille="1em" classes="me-1" /> {u.username}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge bg-${u.role === "admin" ? "danger" : u.role === "editor" ? "warning" : "secondary"}`}>{roleLabel(u.role)}</span>
                    </td>
                    <td>
                      {u.authSource === "ldap" ? (
                        <span className="badge bg-info">
                          <Icone bi="bi-diagram-3" taille="1em" classes="me-1" />
                          AD
                        </span>
                      ) : (
                        <span className="badge bg-secondary">
                          <Icone bi="bi-hdd" taille="1em" classes="me-1" />
                          Local
                        </span>
                      )}
                    </td>
                    <td>
                      {has2fa ? (
                        <span className="badge-status badge-success">
                          <Icone bi="bi-shield-check" taille="1em" classes="me-1" />
                          Activée
                        </span>
                      ) : (
                        <span className="badge-status badge-info">
                          <Icone bi="bi-shield-slash" taille="1em" classes="me-1" />
                          Non
                        </span>
                      )}
                    </td>
                    <td>{dateCourte(u.createdAt)}</td>
                    <td className="col-actions">
                      <Actions>
                        <a href={`/users/${u.id}/edit`} className="btn btn-sm btn-outline-secondary btn-icon" title="Modifier" aria-label="Modifier">
                          <Icone bi="bi-pencil" taille="1em" />
                        </a>
                        {has2fa ? (
                          <form method="POST" action={`/users/${u.id}/reset-2fa`}>
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <button type="submit" className="btn btn-sm btn-outline-warning" title="Réinitialiser la 2FA" aria-label="Réinitialiser la 2FA" data-confirm={`Désactiver la 2FA de ${u.username} ? Il devra la reconfigurer.`}>
                              <Icone bi="bi-shield-x" taille="1em" />
                            </button>
                          </form>
                        ) : null}
                        {u.username !== "admin" && u.id !== moi.id ? (
                          <form method="POST" action={`/users/${u.id}/delete`}>
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <button type="submit" className="btn btn-sm btn-outline-danger btn-icon" title="Supprimer" aria-label="Supprimer" data-confirm="Supprimer cet utilisateur ?">
                              <Icone bi="bi-trash" taille="1em" />
                            </button>
                          </form>
                        ) : null}
                      </Actions>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
