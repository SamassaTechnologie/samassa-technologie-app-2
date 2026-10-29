/* Impression des documents : appel direct dans le geste de l'utilisateur, avec repli fiable
   (page d'impression dédiée) pour iPhone/iPad et applications installées où window.print() ne répond pas. */
'use strict';
(function () {
  function iosOuInstallee() {
    var ua = navigator.userAgent || '', ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    return ios || standalone;
  }
  function copieDocument() {
    var src = document.getElementById('docInner'); if (!src) return null;
    var clone = src.cloneNode(true);
    var cs = src.querySelectorAll('canvas'), cc = clone.querySelectorAll('canvas');
    cs.forEach(function (c, i) { try { var im = document.createElement('img'); im.src = c.toDataURL('image/png'); im.width = c.width; im.height = c.height; im.style.cssText = c.style.cssText; cc[i].replaceWith(im); } catch (e) {} });
    clone.style.display = 'block';
    return clone;
  }
  function ouvrirPageImpression() {
    var clone = copieDocument(); if (!clone) { window.print(); return; }
    var w = window.open('', '_blank'); if (!w) { alert('Autorisez les fenêtres pop-up pour imprimer ce document.'); return; }
    var styles = Array.prototype.map.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) { return '<link rel="stylesheet" href="' + l.href + '">'; }).join('') +
      Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return '<style>' + s.textContent + '</style>'; }).join('');
    w.document.open();
    w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="' + location.href + '"><title>' + (document.title || 'Document').replace(/</g, '') + '</title>' + styles +
      '<style>.pd-bar{position:sticky;top:0;z-index:99;background:#0A1628;color:#fff;padding:10px 14px;display:flex;gap:10px;align-items:center;justify-content:space-between;font:14px system-ui}.pd-bar button{background:#16A34A;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:800;font-size:14px}.doc-inner{display:block!important;margin:0 auto}@media print{.pd-bar{display:none!important}}</style></head><body>' +
      '<div class="pd-bar"><span>Sur iPhone : Imprimer, ou Partager → Imprimer / Enregistrer en PDF</span><button onclick="window.print()">🖨️ Imprimer</button></div>' + clone.outerHTML + '</body></html>');
    w.document.close(); w.focus();
  }
  /* Appelée par chaque bouton « Imprimer » après la génération du document */
  window.SamassaPrint = function () {
    if (iosOuInstallee()) { ouvrirPageImpression(); return; }
    try { window.print(); } catch (e) { ouvrirPageImpression(); }
  };
})();
