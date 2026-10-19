// Modal de confirmation réutilisable (_confirm_modal.html).
//   <button data-confirm="Message ?" data-confirm-form="#form-id" data-confirm-action="/url">
(function () {
  var modal, okBtn, textEl, pendingForm;
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('confirmModal');
    if (!el || !window.bootstrap) return;
    modal = new bootstrap.Modal(el);
    okBtn = document.getElementById('confirmModalOk');
    textEl = document.getElementById('confirmModalText');
    okBtn.addEventListener('click', function () {
      modal.hide();
      if (pendingForm) pendingForm.submit();
    });
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-confirm]');
      if (!btn) return;
      var msg = btn.dataset.confirm;
      var formSel = btn.dataset.confirmForm;
      pendingForm = formSel ? document.querySelector(formSel) : btn.closest('form');
      if (!pendingForm) return;
      e.preventDefault();
      if (btn.dataset.confirmAction) pendingForm.action = btn.dataset.confirmAction;
      textEl.textContent = msg;
      modal.show();
    });
  });
})();
