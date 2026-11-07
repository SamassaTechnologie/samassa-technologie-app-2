/* « À faire aujourd'hui » : agrège créances, abonnements, garanties, prospects, stock. Carte du tableau de bord, pastille de l'icône, notification locale (si autorisée). */
'use strict';
(function () {
  function liste(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function mois(iso, n) { var p = iso.split('-').map(Number), y = p[0], m = p[1] - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(Math.min(p[2], new Date(y, m + 1, 0).getDate())).padStart(2, '0'); }
  function plus(iso, j) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + j); return d.toISOString().slice(0, 10); }
  /* Pur */
  function compter(src, auj) {
    var lim = plus(auj, 30), r = [];
    var cr = (src.creances || []).filter(function (c) { return !c.paid && Number(c.amount) > 0 && c.due && c.due < auj; });
    if (cr.length) r.push({ cle: 'creances', n: cr.length, ico: '💰', txt: cr.length + ' créance' + (cr.length > 1 ? 's' : '') + ' en retard (' + Math.round(cr.reduce(function (s, c) { return s + Number(c.amount); }, 0)).toLocaleString('fr-FR') + ' FCFA)', url: 'relances.html' });
    var ab = (src.abonnements || []).filter(function (a) { return a.expiration && a.expiration <= lim; });
    if (ab.length) r.push({ cle: 'abonnements', n: ab.length, ico: '🌐', txt: ab.length + ' abonnement' + (ab.length > 1 ? 's' : '') + ' à renouveler ou expiré' + (ab.length > 1 ? 's' : ''), url: 'abonnements.html' });
    var ga = (src.parc || []).filter(function (e) { if (!e.achat || !(Number(e.garantieMois) > 0)) return false; var f = mois(e.achat, Number(e.garantieMois)); return f >= auj && f <= lim; });
    if (ga.length) r.push({ cle: 'garanties', n: ga.length, ico: '🖥️', txt: ga.length + ' garantie' + (ga.length > 1 ? 's' : '') + ' se termine' + (ga.length > 1 ? 'nt' : '') + ' sous 30 jours', url: 'parc.html' });
    var pr = (src.prospects || []).filter(function (p) { return p.etape !== 'Gagné' && p.etape !== 'Perdu' && p.relance && p.relance <= auj; });
    if (pr.length) r.push({ cle: 'prospects', n: pr.length, ico: '🎯', txt: pr.length + ' prospect' + (pr.length > 1 ? 's' : '') + ' à relancer', url: 'prospects.html' });
    var pj = (src.projets || []).filter(function (p) { var e = p.etapes || []; return e.length && e.some(function (x) { return !x.fait; }) && p.echeance && p.echeance < auj; });
    if (pj.length) r.push({ cle: 'projets', n: pj.length, ico: '🚀', txt: pj.length + ' projet' + (pj.length > 1 ? 's' : '') + ' en retard de livraison', url: 'projets.html' });
    var bas = (src.stock || []).filter(function (a) { return a && Number(a.min) > 0 && Number(a.qty) <= Number(a.min); });
    if (bas.length) r.push({ cle: 'stock', n: bas.length, ico: '📦', txt: bas.length + ' article' + (bas.length > 1 ? 's' : '') + ' à réapprovisionner', url: 'stock.html' });
    var rdv = (src.recus || []).filter(function (x) { return x && !x.retrieved && x.rdvDate && String(x.rdvDate).slice(0, 10) <= auj; });
    if (rdv.length) r.push({ cle: 'rdv', n: rdv.length, ico: '📅', txt: rdv.length + ' rendez-vous / retrait' + (rdv.length > 1 ? 's' : '') + ' aujourd\'hui ou en retard', url: 'index.html#rdv' });
    return r;
  }
  function source() { return { creances: liste('samassa_creances'), abonnements: liste('samassa_abonnements'), parc: liste('samassa_parc'), prospects: liste('samassa_prospects'), projets: liste('samassa_projets'), stock: liste('samassa_stock_v2'), recus: liste('samassa_recus') }; }
  function auj() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  window.RappelsJour = { compter: compter, plus: plus };
  if (typeof document === 'undefined') return;
  var K = 'samassa_notif_jour';
  function carte() {
    var t = compter(source(), auj()), old = document.getElementById('rj-carte'); if (old) old.remove();
    try { if ('setAppBadge' in navigator) (t.length ? navigator.setAppBadge(t.reduce(function (s, x) { return s + x.n; }, 0)) : navigator.clearAppBadge()).catch(function () {}); } catch (e) {}
    var cible = document.querySelector('section.cat'); if (!cible || !t.length) return;
    var c = document.createElement('div'); c.id = 'rj-carte'; c.style.cssText = 'background:#FFFBEB;border:1px solid #FCD34D;border-radius:14px;padding:12px 14px;margin:0 0 14px;font-size:13px;color:#78350F';
    c.innerHTML = '<div style="font-weight:800;margin-bottom:6px">🔔 À faire aujourd\'hui</div>' + t.map(function (x) { return '<a href="' + x.url + '" style="display:block;padding:5px 0;color:inherit;text-decoration:none">' + x.ico + ' ' + x.txt + ' →</a>'; }).join('') +
      ('Notification' in window && Notification.permission === 'default' ? '<button id="rj-notif" style="margin-top:8px;border:0;border-radius:8px;padding:8px 12px;background:#B45309;color:#fff;font-weight:700;cursor:pointer">Activer le rappel du matin</button>' : '');
    cible.parentNode.insertBefore(c, cible);
    var b = document.getElementById('rj-notif'); if (b) b.onclick = function () { Notification.requestPermission().then(function () { carte(); notifier(t); }); };
    notifier(t);
  }
  function notifier(t) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted' || !t.length || localStorage.getItem(K) === auj()) return;
      localStorage.setItem(K, auj());
      var texte = t.map(function (x) { return x.ico + ' ' + x.txt; }).join('\n');
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (reg) { reg.showNotification('SAMASSA PRO — À faire aujourd\'hui', { body: texte, icon: 'icon-192x192.png', tag: 'rappel-jour' }); });
    } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', carte);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) carte(); });
})();
