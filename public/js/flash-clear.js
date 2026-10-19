// Les messages flash viennent d'un cookie lu au rendu : une fois affichés, on l'efface.
(function () {
  try { fetch('/api/flash', { method: 'POST', credentials: 'same-origin' }).catch(function () {}); } catch (e) {}
})();
