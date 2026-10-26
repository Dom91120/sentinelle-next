/* Fiche equipement : les blocs .kind-section (data-kinds="vm physical ...") ne
   s'affichent que pour le type choisi. Un corps de champs [data-eq-corps] porte
   son propre select Type (name="kind" dans un formulaire, data-qa-field="kind"
   dans la modale d'ajout rapide) : chaque corps se gere seul, la page peut en
   avoir plusieurs (formulaire + modale). */
(function () {
    'use strict';

    function preparer(corps) {
        if (corps.dataset.kindPret) return;
        corps.dataset.kindPret = '1';
        var kindSel = corps.querySelector('select[name="kind"], select[data-qa-field="kind"]');
        if (!kindSel) return;
        function refresh() {
            var k = kindSel.value;
            corps.querySelectorAll('.kind-section').forEach(function (el) {
                var kinds = (el.dataset.kinds || '').split(' ');
                el.style.display = kinds.indexOf(k) === -1 ? 'none' : '';
            });
        }
        kindSel.addEventListener('change', refresh);
        refresh();
    }

    document.querySelectorAll('[data-eq-corps]').forEach(preparer);
})();
