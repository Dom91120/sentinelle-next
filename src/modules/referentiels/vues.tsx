/**
 * Référentiels et services utilisateurs, gérés depuis l'onglet Préférences (port de
 * referentials/index.html). Dans l'onglet, une ligne par liste (nom, compteur), sur deux colonnes,
 * et un crayon qui ouvre sa modale ; dans la modale, le tableau des éditeurs de
 * culturesa-next : une barre d'outils avec l'ajout, des en-têtes de colonnes, une
 * ligne par valeur avec ses champs à même la ligne, inertes tant que le crayon n'a pas
 * ouvert l'édition, et ses actions révélées au survol,
 * un pied « Fermer ». Chaque geste est un formulaire ; la page se recharge et le
 * script de la page rouvre la modale.
 */
import { Icone, Lucide } from "@/components/icones";
import { REFERENTIAL_KINDS, REFERENTIAL_SCOPES } from "@/lib/constantes";
import { prisma } from "@/server/db";

function Csrf({ csrf }: { csrf: string }) {
  return <input type="hidden" name="csrf_token" value={csrf} />;
}

/** La ligne d'une liste dans l'onglet : son nom, son compteur, le crayon qui ouvre la modale. */
function Ligne({
  id,
  bi,
  libelle,
  nombre,
}: {
  id: string;
  bi: string;
  libelle: string;
  nombre: number;
}) {
  return (
    <div className="ref-ligne">
      <Icone bi={bi} taille="1em" classes="ref-ligne-ico ico-amber" />
      <span className="fw-medium">{libelle}</span>
      <span className="badge bg-secondary">{nombre}</span>
      <span className="flex-grow-1" />
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-icone"
        data-bs-toggle="modal"
        data-bs-target={`#${id}`}
        title={`Modifier : ${libelle}`}
        aria-label={`Modifier : ${libelle}`}
      >
        <Lucide nom="pencil" taille={16} />
      </button>
    </div>
  );
}

function Modale({
  id,
  bi,
  titre,
  nombre,
  sousTitre,
  large = false,
  children,
}: {
  id: string;
  bi: string;
  titre: string;
  nombre: number;
  sousTitre: string;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal fade ref-modal"
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}Titre`}
      aria-hidden="true"
    >
      <div className={`modal-dialog modal-dialog-scrollable${large ? " modal-xl" : " modal-lg"}`}>
        <div className="modal-content">
          <section className="form-section pref-rubrique">
            <div className="form-section-titre" id={`${id}Titre`}>
              <Icone bi={bi} taille="1em" classes="me-2 ico-amber" />
              {titre}
              <span className="badge bg-secondary ms-2">{nombre}</span>
              <button
                type="button"
                className="btn-close ref-modal-close"
                data-bs-dismiss="modal"
                aria-label="Fermer"
              />
            </div>
            <p className="form-section-aide">{sousTitre}</p>
            <div className="form-section-corps">
              {children}
              <div className="rf-foot">
                <span className="flex-grow-1" />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  data-bs-dismiss="modal"
                >
                  Fermer
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export async function GestionReferentiels({ csrf }: { csrf: string }) {
  const [valeurs, services] = await Promise.all([
    prisma.referential.findMany({ orderBy: [{ position: "asc" }, { label: "asc" }] }),
    prisma.userService.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        software: { where: { software: { isActive: true } }, select: { softwareId: true } },
      },
    }),
  ]);
  const listes = Object.fromEntries(
    Object.keys(REFERENTIAL_KINDS).map((kind) => [kind, valeurs.filter((v) => v.kind === kind)]),
  );
  const actifs = services.filter((s) => s.isActive);
  const GRILLE_SERVICES = "1.2fr 1fr 1.3fr 0.9fr 4.5rem 4.5rem";

  return (
    <div className="ref-lignes">
      {Object.entries(REFERENTIAL_KINDS).map(([kind, label]) => (
        <Ligne
          key={kind}
          id={`refModal-${kind}`}
          bi="bi-list-ul"
          libelle={label}
          nombre={listes[kind].length}
        />
      ))}
      <Ligne
        id="refModal-services"
        bi="bi-people"
        libelle="Services utilisateurs"
        nombre={actifs.length}
      />

      {Object.entries(REFERENTIAL_KINDS).map(([kind, label]) => {
        const portees = REFERENTIAL_SCOPES[kind];
        const items = listes[kind];
        // La colonne du type prend la largeur de son contenu le plus long (auto), pas une largeur fixe.
        const grille = portees ? "minmax(0, 1fr) auto 5.4rem" : "minmax(0, 1fr) 5.4rem";
        return (
          <Modale
            key={kind}
            id={`refModal-${kind}`}
            bi="bi-list-ul"
            titre={label}
            nombre={items.length}
            sousTitre="Les valeurs proposées dans les formulaires. Une valeur retirée reste sur les fiches qui la portent."
          >
            <form method="POST" action="/referentiels/add" className="rf-toolbar">
              <Csrf csrf={csrf} />
              <input type="hidden" name="kind" value={kind} />
              <input
                type="text"
                name="label"
                className="form-control form-control-sm rf-ajout-champ"
                placeholder="Nouvelle valeur"
                aria-label={`Nouvelle valeur pour ${label}`}
                required
              />
              {portees ? (
                <select
                  name="scope"
                  className="form-select form-select-sm w-auto"
                  aria-label="Type de fiche de la nouvelle valeur"
                >
                  {Object.entries(portees).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>
                      {libelle}
                    </option>
                  ))}
                </select>
              ) : null}
              <button type="submit" className="btn btn-sm btn-primary rf-ajout">
                <Lucide nom="plus" taille={14} /> Ajouter
              </button>
            </form>
            <div className="rf-head" style={{ gridTemplateColumns: grille }}>
              <span>Libellé</span>
              {portees ? <span>Type de fiche</span> : null}
              <span />
            </div>
            {items.length ? (
              items.map((item) => (
                <div key={item.id} className="rf-row" style={{ gridTemplateColumns: grille }}>
                  <form method="POST" action={`/referentiels/${item.id}/edit`} id={`ref${item.id}`}>
                    <Csrf csrf={csrf} />
                    <input
                      type="text"
                      name="label"
                      defaultValue={item.label}
                      className="rf-ghost rf-label"
                      aria-label={`Libellé de ${item.label}`}
                      disabled
                      required
                    />
                  </form>
                  {portees ? (
                    <select
                      name="scope"
                      form={`ref${item.id}`}
                      className="form-select form-select-sm rf-ghost"
                      aria-label={`Type de fiche pour ${item.label}`}
                      defaultValue={item.scope || "tous"}
                      disabled
                    >
                      {Object.entries(portees).map(([valeur, libelle]) => (
                        <option key={valeur} value={valeur}>
                          {libelle}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <div className="rf-act">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-icone rf-edit"
                      title="Modifier le libellé"
                      aria-label={`Modifier le libellé de ${item.label}`}
                    >
                      <Lucide nom="pencil" taille={14} />
                    </button>
                    <button
                      type="submit"
                      form={`ref${item.id}`}
                      className="btn btn-sm btn-ghost btn-icone rf-save"
                      title="Enregistrer le libellé"
                      aria-label={`Enregistrer le libellé de ${item.label}`}
                    >
                      <Lucide nom="check" taille={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-icone rf-cancel"
                      title="Annuler la modification"
                      aria-label={`Annuler la modification de ${item.label}`}
                    >
                      <Lucide nom="x" taille={14} />
                    </button>
                    <form
                      method="POST"
                      action={`/referentiels/${item.id}/delete`}
                      className="rf-delete"
                    >
                      <Csrf csrf={csrf} />
                      <button
                        type="submit"
                        className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                        title="Retirer de la liste"
                        aria-label={`Retirer ${item.label} de la liste`}
                        data-confirm={`Retirer « ${item.label} » ? Les fiches qui la portent la gardent.`}
                      >
                        <Lucide nom="trash-2" taille={14} />
                      </button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <div className="rf-empty">Liste vide. Ajoutez une valeur ci-dessus.</div>
            )}
          </Modale>
        );
      })}

      <Modale
        id="refModal-services"
        bi="bi-people"
        titre="Services utilisateurs"
        nombre={actifs.length}
        sousTitre="Les directions de la collectivité et leur référent, proposés sur les fiches logiciel. Un service retiré reste sur les fiches qui le nomment."
        large
      >
        <form method="POST" action="/referentiels/services/add" className="rf-toolbar">
          <Csrf csrf={csrf} />
          <input
            type="text"
            name="name"
            className="form-control form-control-sm rf-ajout-champ"
            required
            placeholder="Nouveau service"
            aria-label="Nom du nouveau service"
          />
          <input
            type="text"
            name="contact_name"
            className="form-control form-control-sm rf-ajout-champ"
            placeholder="Référent"
            aria-label="Référent du nouveau service"
          />
          <input
            type="email"
            name="contact_email"
            className="form-control form-control-sm rf-ajout-champ"
            placeholder="Email"
            aria-label="Email du référent"
          />
          <input
            type="text"
            name="contact_phone"
            className="form-control form-control-sm rf-ajout-champ rf-ajout-champ--court"
            placeholder="Téléphone"
            aria-label="Téléphone du référent"
          />
          <button type="submit" className="btn btn-sm btn-primary rf-ajout">
            <Lucide nom="plus" taille={14} /> Ajouter
          </button>
        </form>
        <div className="rf-head" style={{ gridTemplateColumns: GRILLE_SERVICES }}>
          <span>Service</span>
          <span>Référent</span>
          <span>Email</span>
          <span>Téléphone</span>
          <span className="text-end">Logiciels</span>
          <span />
        </div>
        {services.length ? (
          services.map((sv) => (
            <div
              key={sv.id}
              className={`rf-row${sv.isActive ? "" : " rf-row--retire"}`}
              style={{ gridTemplateColumns: GRILLE_SERVICES }}
            >
              <form
                method="POST"
                action={`/referentiels/services/${sv.id}/edit`}
                id={`svc${sv.id}`}
              >
                <Csrf csrf={csrf} />
                <input
                  type="text"
                  name="name"
                  defaultValue={sv.name}
                  className="rf-ghost fw-semibold"
                  aria-label="Nom du service"
                  disabled
                  required
                />
              </form>
              <input
                type="text"
                name="contact_name"
                form={`svc${sv.id}`}
                defaultValue={sv.contactName || ""}
                className="rf-ghost"
                placeholder="—"
                aria-label="Référent"
                disabled
              />
              <input
                type="email"
                name="contact_email"
                form={`svc${sv.id}`}
                defaultValue={sv.contactEmail || ""}
                className="rf-ghost"
                placeholder="—"
                aria-label="Email du référent"
                disabled
              />
              <input
                type="text"
                name="contact_phone"
                form={`svc${sv.id}`}
                defaultValue={sv.contactPhone || ""}
                className="rf-ghost"
                placeholder="—"
                aria-label="Téléphone du référent"
                disabled
              />
              <span className="rf-muted text-end">
                {sv.isActive ? (
                  sv.software.length
                ) : (
                  <span className="badge bg-secondary">Retiré</span>
                )}
              </span>
              <div className="rf-act">
                <button
                  type="button"
                  className="btn btn-sm btn-ghost btn-icone rf-edit"
                  title="Modifier la ligne"
                  aria-label={`Modifier ${sv.name}`}
                >
                  <Lucide nom="pencil" taille={14} />
                </button>
                <button
                  type="submit"
                  form={`svc${sv.id}`}
                  className="btn btn-sm btn-ghost btn-icone rf-save"
                  title="Enregistrer la ligne"
                  aria-label={`Enregistrer ${sv.name}`}
                >
                  <Lucide nom="check" taille={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost btn-icone rf-cancel"
                  title="Annuler la modification"
                  aria-label={`Annuler la modification de ${sv.name}`}
                >
                  <Lucide nom="x" taille={14} />
                </button>
                {sv.isActive ? (
                  <form
                    method="POST"
                    action={`/referentiels/services/${sv.id}/delete`}
                    className="rf-delete"
                  >
                    <Csrf csrf={csrf} />
                    <button
                      type="submit"
                      className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                      title="Retirer des listes"
                      aria-label={`Retirer ${sv.name} des listes`}
                      data-confirm={`Retirer « ${sv.name} » des listes ? Les fiches qui le nomment continuent de l'afficher.`}
                    >
                      <Lucide nom="trash-2" taille={14} />
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rf-empty">Aucun service. Ajoutez-en un ci-dessus.</div>
        )}
      </Modale>
    </div>
  );
}
