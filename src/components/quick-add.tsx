/** Composant « ajout rapide » (port de _quick_add.html). Cf. public/js/quick-add.js. */
import { Icone } from "@/components/icones";
import { EQUIPMENT_KIND_LABELS } from "@/lib/constantes";

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

function Modal({
  id,
  endpoint,
  titre,
  icone,
  csrf,
  children,
  footer,
  large,
}: {
  id: string;
  endpoint: string;
  titre: string;
  icone: string;
  csrf: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  large?: boolean;
}) {
  return (
    <div
      className="modal fade"
      id={id}
      tabIndex={-1}
      aria-hidden="true"
      data-qa-endpoint={endpoint}
    >
      <div className={`modal-dialog${large ? " modal-lg" : ""}`}>
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
                  Créer
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
    <Modal
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
    </Modal>
  );
}

export function QaModalContract({ csrf }: { csrf: string }) {
  return (
    <Modal
      id="qaModalContract"
      endpoint="/contracts/quick-create"
      titre="Nouveau contrat"
      icone="bi-file-earmark-text"
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
      <div className="mb-2">
        <label className="form-label small">Échéance</label>
        <input type="date" data-qa-field="end_date" className="form-control form-control-sm" />
      </div>
      <div className="form-text">
        Détails (type, préavis, coût…) à compléter ensuite sur la fiche.
      </div>
    </Modal>
  );
}

export function QaModalSoftware({ csrf }: { csrf: string }) {
  return (
    <Modal
      id="qaModalSoftware"
      endpoint="/inventory/logiciels/quick-create"
      titre="Nouvelle application"
      icone="bi-window-stack"
      csrf={csrf}
    >
      <div className="mb-2">
        <label className="form-label small">Nom *</label>
        <input
          type="text"
          data-qa-field="name"
          data-qa-required
          className="form-control form-control-sm"
          placeholder="ex: SIRH, GLPI, Office 365…"
        />
      </div>
      <div className="form-text">
        Détails (éditeur, serveurs, contrat…) à compléter ensuite sur la fiche du logiciel.
      </div>
    </Modal>
  );
}

export function QaModalEquipment({ csrf }: { csrf: string }) {
  return (
    <Modal
      id="qaModalEquipment"
      endpoint="/inventory/quick-create"
      titre="Nouvel équipement"
      icone="bi-hdd-stack"
      csrf={csrf}
    >
      <div className="row g-2">
        <div className="col-md-7">
          <label className="form-label small">Nom *</label>
          <input
            type="text"
            data-qa-field="name"
            data-qa-required
            className="form-control form-control-sm"
            placeholder="ex: SRV-APP01"
          />
        </div>
        <div className="col-md-5">
          <label className="form-label small">Type</label>
          <select data-qa-field="kind" className="form-select form-select-sm">
            {Object.entries(EQUIPMENT_KIND_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-text">
        Détails (OS, réseau, garantie…) à compléter ensuite sur la fiche.
      </div>
    </Modal>
  );
}

/** La modale « Nouveau serveur » de SoftInventory. */
export function QaModalServer({ csrf }: { csrf: string }) {
  return (
    <Modal
      id="qaModalServer"
      endpoint="/inventory/quick-create"
      titre="Nouveau serveur"
      icone="bi-hdd-stack"
      csrf={csrf}
      large
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
    </Modal>
  );
}
