/* Tableau de bord par catégories : repli mémorisé, recherche de fonction, masquage des catégories vides (droits). */
'use strict';
(function () {
  var cles = 'samassa_cat_fermees';
  function lire() { try { var v = JSON.parse(localStorage.getItem(cles) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function ecrire(v) { try { localStorage.setItem(cles, JSON.stringify(v)); } catch (e) {} }
  var nrm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  function visibleDroits(a) { return a.style.display !== 'none' && !a.hasAttribute('data-filtre'); }
  function actualiser() {
    var q = nrm((document.getElementById('cat-q') || {}).value).trim(), mots = q.split(/\s+/).filter(Boolean), total = 0;
    document.querySelectorAll('.cat').forEach(function (c) {
      var n = 0, tuiles = c.querySelectorAll('a.qa');
      tuiles.forEach(function (a) {
        var ok = !mots.length || mots.every(function (m) { return nrm(a.dataset.k + ' ' + a.textContent).indexOf(m) >= 0; });
        if (ok) a.removeAttribute('data-filtre'); else a.setAttribute('data-filtre', '1');
        a.style.display = ok ? (a.dataset.cache === '1' ? 'none' : '') : 'none';
        if (ok && a.dataset.cache !== '1') n++;
      });
      var cn = c.querySelector('.cat-n'); if (cn) cn.textContent = n;
      c.style.display = n ? '' : 'none'; total += n;
      c.classList.toggle('closed', !mots.length && lire().indexOf(c.dataset.cat) >= 0);
      c.querySelector('.cat-h').setAttribute('aria-expanded', c.classList.contains('closed') ? 'false' : 'true');
    });
    var none = document.getElementById('cat-none'); if (none) none.style.display = total ? 'none' : 'block';
    var x = document.getElementById('cat-x'); if (x) x.style.display = q ? 'block' : 'none';
  }
  /* Les tuiles masquées par les droits (dashboard-plus.js) restent masquées : on les mémorise avant tout filtrage */
  function memoriserDroits() {
    document.querySelectorAll('.cat a.qa').forEach(function (a) { if (!a.hasAttribute('data-filtre')) a.dataset.cache = a.style.display === 'none' ? '1' : ''; });
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('.cat')) return;
    document.querySelectorAll('.cat-h').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.parentElement, id = c.dataset.cat, l = lire(), i = l.indexOf(id);
        if (c.classList.toggle('closed')) { if (i < 0) l.push(id); } else if (i >= 0) l.splice(i, 1);
        ecrire(l); b.setAttribute('aria-expanded', c.classList.contains('closed') ? 'false' : 'true');
      });
    });
    var q = document.getElementById('cat-q'), x = document.getElementById('cat-x');
    if (q) q.addEventListener('input', function () { if (!q.value.trim()) memoriserDroits(); actualiser(); });
    if (x) x.addEventListener('click', function () { q.value = ''; memoriserDroits(); actualiser(); q.focus(); });
    actualiser();
    /* dashboard-plus.js masque selon le rôle après la connexion : on recompte plusieurs fois */
    [800, 2000, 4500].forEach(function (t) { setTimeout(function () { if (!(q && q.value.trim())) { memoriserDroits(); actualiser(); } }, t); });
  });
})();
