// La ligne « À compléter » d'une rubrique de Synthèse (_synthese.html) : les
// champs vides laissent un marqueur data-manque, que la rubrique rassemble.
(function () {
  function lucide(nom) {
    var u = document.querySelector('use[href*="lucide.svg"]');
    var base = u ? u.getAttribute('href').split('#')[0] : '/vendor/lucide.svg';
    return '<svg class="lucide lucide-' + nom + '" width="12" height="12" aria-hidden="true"><use href="' + base + '#' + nom + '"></use></svg>';
  }
  document.querySelectorAll('.lu-grille[data-manques]').forEach(function (grille) {
    var manques = Array.prototype.map.call(grille.querySelectorAll('[data-manque]'), function (s) { return s.getAttribute('data-manque'); });
    if (!manques.length) return;
    var div = document.createElement('div');
    div.className = 'lu-manques';
    div.innerHTML = lucide('pencil') + 'À compléter : ' + manques.map(function (m) {
      var span = document.createElement('span'); span.className = 'lu-manque'; span.textContent = m; return span.outerHTML;
    }).join('');
    grille.parentNode.appendChild(div);
  });
})();
