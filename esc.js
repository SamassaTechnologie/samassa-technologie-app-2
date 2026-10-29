/* Échappement HTML partagé : à utiliser pour toute donnée insérée dans innerHTML */
window.escHtml = window.escHtml || function (v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
};
