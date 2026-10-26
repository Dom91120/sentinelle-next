/** Composant « ajout rapide » (port de _quick_add.html). Cf. public/js/quick-add.js. */
import { Icone } from "@/components/icones";

/**
 * L'attribut qui relève un champ : `name` dans un formulaire, `data-qa-field` dans une modale
 * d'ajout rapide (quick-add.js), pour que le formulaire hôte ne l'emporte pas.
 */
export function nomChamp(nom: string, rapide?: boolean) {
  return rapide ? { "data-qa-field": nom } : { name: nom };
}

export function QaButton({
  modalId,
  targetId,
  title = "Ajouter",
}: {
  modalId: string;
  targetId: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-outline-primary"
      title={title}
      data-bs-toggle="modal"
      data-bs-target={`#${modalId}`}
      data-qa-open={modalId}
      data-qa-target={targetId}
    >
      <Icone bi="bi-plus-lg" taille="1em" />
    </button>
  );
}

export function QaAddLink({
  modalId,
  targetId,
  text = "Ajouter",
}: {
  modalId: string;
  targetId: string;
  text?: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-primary"
      title={text}
      data-bs-toggle="modal"
      data-bs-target={`#${modalId}`}
      data-qa-open={modalId}
      data-qa-target={targetId}
    >
      <Icone bi="bi-plus-lg" taille="1em" classes="me-1" />
      {text}
    </button>
  );
}

/** La fenêtre d'un ajout rapide : en-tête, corps (jeton, champs, erreur), pied Annuler / Créer. */
export function QaModal({
  id,
  endpoint,
  titre,
  icone,
  csrf,
  children,
  footer,
  taille,
  classes,
  libelle = "Créer",
}: {
  id: string;
  endpoint: string;
  titre: string;
  icone: string;
  csrf: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Largeur Bootstrap (lg, xl) ; une fenêtre xl défile dans son corps. */
  taille?: "lg" | "xl";
  classes?: string;
  /** Le libellé du bouton d'enregistrement. */
  libelle?: string;
}) {
  const dialogue =
    taille === "xl" ? " modal-xl modal-dialog-scrollable" : taille === "lg" ? " modal-lg" : "";
  return (
    <div
      className={`modal fade${classes ? ` ${classes}` : ""}`}
      id={id}
      tabIndex={-1}
      aria-hidden="true"
      data-qa-endpoint={endpoint}
    >
      <div className={`modal-dialog${dialogue}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <Icone bi={icone} taille="1em" classes="me-2" />
              {titre}
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Fermer"
            />
          </div>
          <div className="modal-body">
            <input type="hidden" data-qa-csrf value={csrf} />
            {children}
            <div data-qa-error className="text-danger small mt-2 d-none" />
          </div>
          <div className="modal-footer">
            {footer ?? (
              <>
                <button type="button" className="btn btn-warn btn-sm" data-bs-dismiss="modal">
                  Annuler
                </button>
                <button type="button" className="btn btn-primary btn-sm" data-qa-save>
                  <Icone bi="bi-check-lg" taille="1em" classes="me-1" />
                  {libelle}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function QaModalSupplier({ csrf }: { csrf: string }) {
  return (
    <QaModal
      id="qaModalSupplier"
      endpoint="/suppliers/quick-create"
      titre="Nouveau fournisseur"
      icone="bi-truck"
      csrf={csrf}
    >
      <div className="mb-2">
        <label className="form-label small">Nom *</label>
        <input
          type="text"
          data-qa-field="name"
          data-qa-required
          className="form-control form-control-sm"
        />
      </div>
      <div className="row g-2">
        <div className="col-md-6">
          <label className="form-label small">Contact</label>
          <input
            type="text"
            data-qa-field="contact_name"
            className="form-control form-control-sm"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label small">Téléphone</label>
          <input type="text" data-qa-field="phone" className="form-control form-control-sm" />
        </div>
        <div className="col-12">
          <label className="form-label small">E-mail</label>
          <input type="email" data-qa-field="email" className="form-control form-control-sm" />
        </div>
      </div>
    </QaModal>
  );
}

/** La modale « Nouveau serveur » de SoftInventory. */
export function QaModalServer({ csrf }: { csrf: string }) {
  return (
    <QaModal
      id="qaModalServer"
      endpoint="/inventory/quick-create"
      titre="Nouveau serveur"
      icone="bi-hdd-stack"
      csrf={csrf}
      taille="lg"
      footer={
        <>
          <button type="button" className="btn btn-primary btn-sm" data-qa-save>
            Créer le serveur
          </button>
          <button type="button" className="btn btn-warn btn-sm" data-bs-dismiss="modal">
            Annuler
          </button>
        </>
      }
    >
      <div className="row g-2 align-items-end">
        <div className="col-md-4">
          <label className="form-label small">Nom du serveur *</label>
          <input
            type="text"
            data-qa-field="name"
            data-qa-required
            className="form-control form-control-sm"
            placeholder="Ex : SRV-AFFGE"
            maxLength={120}
          />
        </div>
        <div className="col-auto text-center">
          <label className="form-label small d-block" htmlFor="qaSrvVirtuel">
            Virtuel
          </label>
          <input
            type="checkbox"
            className="form-check-input"
            id="qaSrvVirtuel"
            defaultChecked
            data-virtuel-kind
          />
          <input type="hidden" data-qa-field="kind" defaultValue="vm" />
        </div>
        <div className="col-auto">
          <label className="form-label small">Type</label>
          <select data-qa-field="os_family" className="form-select form-select-sm">
            <option value="">— inconnu —</option>
            <option value="Windows">Windows</option>
            <option value="Linux">Linux</option>
          </select>
        </div>
        <div className="col-md">
          <label className="form-label small">Système</label>
          <input
            type="text"
            data-qa-field="os"
            className="form-control form-control-sm"
            placeholder="Ex : Windows Server 2022"
          />
        </div>
        <div className="col-md-3">
          <label className="form-label small">Emplacement</label>
          <input
            type="text"
            data-qa-field="location"
            className="form-control form-control-sm"
            placeholder="Ex : salle serveur"
          />
        </div>
        <div className="col-12">
          <label className="form-label small">Observations</label>
          <textarea
            data-qa-field="observations"
            className="form-control form-control-sm"
            rows={3}
            placeholder="Informations libres : sauvegarde, exploitant, particularités…"
          />
        </div>
      </div>
    </QaModal>
  );
}
