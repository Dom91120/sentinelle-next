// Modal de confirmation réutilisable (_confirm_modal.html).
//   <button data-confirm="Message ?" data-confirm-form="#form-id" data-confirm-action="/url">
// Depuis un script : window.confirmerModal('Message ?', function () { ... }) ; rend false si la
// modale n'est pas disponible (l'appelant se rabat alors sur confirm()).
(function () {
  var modal, okBtn, textEl, enAttente;
  window.confirmerModal = function (msg, suite) {
    if (!modal) return false;
    enAttente = suite;
    textEl.textContent = msg;
    modal.show();
    return true;
  };
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('confirmModal');
    if (!el || !window.bootstrap) return;
    modal = new bootstrap.Modal(el);
    okBtn = document.getElementById('confirmModalOk');
    textEl = document.getElementById('confirmModalText');
    okBtn.addEventListener('click', function () {
      modal.hide();
      var action = enAttente;
      enAttente = null;
      if (!action) return;
      if (typeof action === 'function') { action(); return; }
      // requestSubmit() et non submit() : seul le premier declenche l'evenement
      // « submit », celui que onglets.js ecoute pour emporter l'onglet ouvert
      // dans l'ancre. Avec submit(), supprimer une piece jointe depuis l'onglet
      // Documents ramenait sur la Synthese.
      if (action.requestSubmit) action.requestSubmit();
      else action.submit();
    });
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-confirm]');
      if (!btn) return;
      var msg = btn.dataset.confirm;
      var formSel = btn.dataset.confirmForm;
      var form = formSel ? document.querySelector(formSel) : btn.closest('form');
      if (!form) return;
      e.preventDefault();
      if (btn.dataset.confirmAction) form.action = btn.dataset.confirmAction;
      window.confirmerModal(msg, form);
    });
  });
})();
