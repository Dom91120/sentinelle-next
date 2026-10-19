// Gestes déclaratifs, à la place des attributs onclick/onchange inline des gabarits
// Flask (interdits par la CSP à nonce) :
//   [data-action="nom"]            clic → window[nom]()
//   [data-href-select]             changement → location.href = valeur choisie
//   [data-click-prev]              clic → déclenche l'élément précédent (champ fichier caché)
//   [data-fichier-nom]             changement d'un champ fichier → recopie le nom dans
//                                  le champ `filename` du formulaire et l'infobulle du bouton
//   [data-fichier-bouton]          changement d'un champ fichier → infobulle + couleur du bouton
//   [data-virtuel-kind]            case « Virtuel » → champ caché kind = vm | physical
//   [data-ouvrir-onglet="id"]      clic → ouvre l'onglet (bouton #ong-id)
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-action]');
    if (a) {
      var fn = window[a.getAttribute('data-action')];
      if (typeof fn === 'function') { e.preventDefault(); fn.call(a, e); }
      return;
    }
    var p = e.target.closest('[data-click-prev]');
    if (p && p.previousElementSibling) { e.preventDefault(); p.previousElementSibling.click(); return; }
    var o = e.target.closest('[data-ouvrir-onglet]');
    if (o) {
      var b = document.getElementById('ong-' + o.getAttribute('data-ouvrir-onglet'));
      if (b) b.click();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var a = e.target.closest && e.target.closest('[data-action][role="button"]');
    if (!a) return;
    var fn = window[a.getAttribute('data-action')];
    if (typeof fn === 'function') { e.preventDefault(); fn.call(a, e); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.matches('[data-href-select]')) { location.href = t.value; return; }
    if (t.matches('[data-fichier-nom]')) {
      var champ = t.form && t.form.elements.filename;
      if (champ) champ.value = t.files.length ? t.files[0].name : '';
      var btn = t.nextElementSibling;
      if (btn) btn.title = t.files.length ? 'Choisi : ' + t.files[0].name : (btn.dataset.titre || btn.title);
      return;
    }
    if (t.matches('[data-fichier-bouton]')) {
      var b2 = t.nextElementSibling;
      if (!b2) return;
      b2.title = t.files.length ? 'Choisi : ' + t.files[0].name : (b2.dataset.titre || b2.title);
      b2.classList.toggle('btn-primary', !!t.files.length);
      b2.classList.toggle('btn-outline-secondary', !t.files.length);
      return;
    }
    if (t.matches('[data-virtuel-kind]')) {
      var h = t.nextElementSibling;
      if (h) h.value = t.checked ? 'vm' : 'physical';
    }
  });
})();
