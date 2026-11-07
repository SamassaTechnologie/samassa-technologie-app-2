/* Thème Auto / Clair / Sombre : appliqué avant l'affichage pour éviter le flash. */
'use strict';
(function () {
  var K = 'samassa_theme', MQ = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var lire = function () { try { var v = localStorage.getItem(K); return v === 'dark' || v === 'auto' ? v : 'light'; } catch (e) { return 'light'; } };
  function appliquer(m) {
    var sombre = m === 'dark' || (m === 'auto' && MQ && MQ.matches);
    document.documentElement.setAttribute('data-theme', sombre ? 'dark' : 'light');
    var t = document.querySelector('meta[name="theme-color"]'); if (t) t.setAttribute('content', sombre ? '#0A121C' : '#0D1B2A');
  }
  appliquer(lire());
  if (MQ && MQ.addEventListener) MQ.addEventListener('change', function () { if (lire() === 'auto') appliquer('auto'); });
  var ICONES = { light: '☀️', dark: '🌙', auto: '🌓' }, NOMS = { light: 'Clair', dark: 'Sombre', auto: 'Automatique' };
  window.Theme = {
    mode: lire,
    suivant: function () { var o = ['light', 'dark', 'auto'], m = o[(o.indexOf(lire()) + 1) % 3]; try { localStorage.setItem(K, m); } catch (e) {} appliquer(m); return m; },
    bouton: function (parent, avant) {
      if (!parent || document.getElementById('theme-btn')) return;
      var b = document.createElement('div'); b.id = 'theme-btn'; b.className = 'theme-btn'; b.setAttribute('role', 'button'); b.tabIndex = 0;
      var maj = function () { var m = lire(); b.textContent = ICONES[m]; b.title = 'Thème : ' + NOMS[m] + ' (toucher pour changer)'; b.setAttribute('aria-label', b.title); };
      b.onclick = function () { window.Theme.suivant(); maj(); }; b.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.onclick(); } };
      maj(); parent.insertBefore(b, avant || parent.firstChild);
    }
  };
  if (!document.querySelector('link[href^="theme-dark.css"]')) document.documentElement.setAttribute('data-dk', 'inv');
  document.addEventListener('DOMContentLoaded', function () {
    var z = document.querySelector('.tb-actions');
    if (z) window.Theme.bouton(z);
    else { window.Theme.bouton(document.body, null); var b = document.getElementById('theme-btn'); if (b) b.classList.add('flottant'); }
  });
})();
