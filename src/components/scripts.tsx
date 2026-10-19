import { Icone } from "@/components/icones";

/** Les scripts de base.html, dans le même ordre, avec le nonce CSP. */
export function ScriptsPage({ nonce, extra }: { nonce?: string; extra?: React.ReactNode }) {
  const fichiers = [
    "/vendor/bootstrap.bundle.min.js",
    "/js/dom-actions.js",
    "/js/theme.js",
    "/js/quick-add.js",
    "/js/onglets.js",
    "/js/directory-autocomplete.js",
    "/js/filtres-colonnes.js",
    "/js/formulaire.js",
    "/js/formulaire-inline.js",
    "/js/edition.js",
    "/js/texte-tronque.js",
    "/js/synthese.js",
  ];
  return (
    <>
      {fichiers.map((src) => (
        <script key={src} src={src} nonce={nonce} />
      ))}
      {extra}
    </>
  );
}

/** _confirm_modal.html : modal de confirmation réutilisable (data-confirm). */
export function ConfirmModal({ csrf, nonce }: { csrf: string; nonce?: string }) {
  return (
    <>
      <form method="POST" id="form-supprimer" className="d-none" aria-hidden="true">
        <input type="hidden" name="csrf_token" value={csrf} />
      </form>
      <div className="modal fade" id="confirmModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header border-0 pb-0">
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body text-center py-2 px-4">
              <Icone bi="bi-exclamation-triangle-fill" taille="1em" classes="text-warning fs-1 d-block mb-3" />
              <p id="confirmModalText" className="mb-0 fs-6" />
            </div>
            <div className="modal-footer border-0 pt-0 justify-content-center gap-2">
              <button type="button" className="btn btn-warn" data-bs-dismiss="modal">
                Annuler
              </button>
              <button type="button" className="btn btn-danger" id="confirmModalOk">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      </div>
      <script src="/js/confirm-modal.js" nonce={nonce} />
    </>
  );
}

/** _toast_notifications.html : toast quand le nombre d'alertes critiques augmente. */
export function ToastNotifications({ nonce }: { nonce?: string }) {
  return (
    <>
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
        <div id="alertToast" className="toast align-items-center text-bg-danger border-0" role="alert" aria-live="assertive">
          <div className="d-flex">
            <div className="toast-body" id="alertToastBody">
              <Icone bi="bi-exclamation-triangle-fill" taille="1em" classes="me-2" />
              <span id="alertToastText" />
            </div>
            <button type="button" className="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" />
          </div>
        </div>
      </div>
      <script src="/js/toast-notifications.js" nonce={nonce} />
    </>
  );
}
