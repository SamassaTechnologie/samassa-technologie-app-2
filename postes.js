/* Postes du cybercafé : chronomètre, forfaits, impressions, encaissement en caisse */
'use strict';
(function () {
  var H = window.escHtml, CFG = 'samassa_postes_config', ACT = 'samassa_postes_actifs', SES = 'samassa_sessions_cyber';
  var DEF = { n: 6, tarifHeure: 400, minimum: 100, pas: 5, prixPage: 75 };
  var FORFAITS = [{ minutes: 30, prix: 250, label: '30 min' }, { minutes: 60, prix: 400, label: '1 h' }, { minutes: 120, prix: 750, label: '2 h' }];
  function lire(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function ecrire(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function cfg() { var c = lire(CFG, {}); return { n: +c.n || DEF.n, tarifHeure: c.tarifHeure != null ? +c.tarifHeure : DEF.tarifHeure, minimum: c.minimum != null ? +c.minimum : DEF.minimum, pas: +c.pas || DEF.pas, prixPage: c.prixPage != null ? +c.prixPage : DEF.prixPage }; }
  function money(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function jour() { return new Date().toISOString().slice(0, 10); }
  function hms(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(function (x) { return String(x).padStart(2, '0'); }).join(':'); }

  /* Calcul pur, testable : minutes → montant */
  function montantTemps(minutes, c) {
    if (minutes <= 0) return 0;
    var arrondi = Math.ceil(minutes / c.pas) * c.pas;
    var m = Math.ceil(arrondi / 60 * c.tarifHeure / 25) * 25;
    return Math.max(c.minimum, m);
  }
  function montantSession(s, finMs, pages, c) {
    var minutes = Math.max(0, (finMs - s.debut - (s.pauseTotal || 0)) / 60000);
    var base, extra = 0;
    if (s.forfait) { base = s.forfait.prix; var depasse = minutes - s.forfait.minutes; if (depasse > c.pas) extra = montantTemps(depasse, c); }
    else base = montantTemps(minutes, c);
    var imp = Math.max(0, +pages || 0) * c.prixPage;
    return { minutes: Math.round(minutes), temps: base + extra, impression: imp, total: base + extra + imp };
  }

  var actifs = lire(ACT, {});
  function debuter(id, forfait) {
    if (actifs[id]) return;
    actifs[id] = { debut: Date.now(), forfait: forfait || null }; ecrire(ACT, actifs); rendre();
  }
  var courant = null;
  function terminer(id) {
    var s = actifs[id]; if (!s) return;
    courant = id; var c = cfg();
    document.getElementById('d-t').textContent = 'Poste ' + id + ' — fin de session';
    document.getElementById('d-pages').value = 0;
    maj();
    document.getElementById('dlg').showModal();
  }
  function maj() {
    if (!courant) return; var s = actifs[courant], c = cfg();
    var r = montantSession(s, Date.now(), document.getElementById('d-pages').value, c);
    document.getElementById('d-l').innerHTML = '<div class="l"><span>Durée</span><span>' + r.minutes + ' min' + (s.forfait ? ' (forfait ' + H(s.forfait.label) + ')' : '') + '</span></div><div class="l"><span>Temps</span><span>' + money(r.temps) + '</span></div><div class="l"><span>Impressions</span><span>' + money(r.impression) + '</span></div>';
    document.getElementById('d-tot').textContent = money(r.total);
  }
  function encaisser() {
    var id = courant, s = actifs[id]; if (!s) return; var c = cfg();
    var pages = Math.max(0, +document.getElementById('d-pages').value || 0), pm = document.getElementById('d-pm').value;
    var r = montantSession(s, Date.now(), pages, c);
    var ses = lire(SES, []);
    ses.push({ id: 'SC-' + Date.now(), poste: id, debut: new Date(s.debut).toISOString(), fin: new Date().toISOString(), minutes: r.minutes, forfait: s.forfait ? s.forfait.label : '', pages: pages, montant: r.total, pm: pm, date: jour() });
    ecrire(SES, ses.slice(-2000));
    if (r.total > 0) {
      var caisse = lire('samassa_mouvements', []);
      caisse.push({ id: 'CY-' + Date.now(), date: jour(), type: 'entree', desc: 'Cyber poste ' + id + ' — ' + r.minutes + ' min' + (pages ? ' + ' + pages + ' page(s)' : ''), amount: r.total, pm: pm, cat: 'Cyber Café', auto: true, timestamp: new Date().toISOString() });
      ecrire('samassa_mouvements', caisse);
    }
    delete actifs[id]; ecrire(ACT, actifs);
    document.getElementById('dlg').close(); courant = null; rendre();
    if (window.ST && ST.toast) ST.toast('✅ ' + money(r.total) + ' encaissés (poste ' + id + ')', 'success');
  }
  function annuler(id) { if (confirm('Annuler la session du poste ' + id + ' sans encaisser ?')) { delete actifs[id]; ecrire(ACT, actifs); rendre(); } }

  function rendre() {
    var c = cfg(), now = Date.now(), cartes = '';
    for (var i = 1; i <= c.n; i++) {
      var s = actifs[i], cl = 'pc', st = 'Libre', corps = '<div class="tm">—</div><div class="sub">Choisissez un forfait ou démarrez en temps libre</div>', acts = FORFAITS.map(function (f, k) { return '<button data-a="f" data-i="' + k + '">' + f.label + ' · ' + f.prix + '</button>'; }).join('') + '<button class="go" data-a="libre">▶ Temps libre</button>';
      if (s) {
        var ecoule = now - s.debut, fin = s.forfait ? s.forfait.minutes * 60000 : 0, reste = fin - ecoule;
        cl += s.forfait && reste <= 0 ? ' alert' : ' on'; st = s.forfait && reste <= 0 ? 'Temps écoulé' : 'Occupé';
        corps = '<div class="tm" data-t="' + i + '">' + hms(s.forfait && reste > 0 ? reste : ecoule) + '</div><div class="sub">' + (s.forfait ? 'Forfait ' + H(s.forfait.label) + (reste > 0 ? ' · temps restant' : ' · dépassement ' + hms(-reste)) : 'Temps libre · ' + money(montantSession(s, now, 0, c).total)) + '</div>';
        acts = '<button class="stop" data-a="fin">■ Terminer</button><button data-a="ann">Annuler</button>';
      }
      cartes += '<div class="' + cl + '" data-p="' + i + '"><h3>Poste ' + i + '<span class="st">' + st + '</span></h3>' + corps + '<div class="acts">' + acts + '</div></div>';
    }
    document.getElementById('postes').innerHTML = cartes;
    var ses = lire(SES, []).filter(function (x) { return x.date === jour(); });
    var tot = ses.reduce(function (s, x) { return s + x.montant; }, 0), min = ses.reduce(function (s, x) { return s + x.minutes; }, 0), pg = ses.reduce(function (s, x) { return s + (x.pages || 0); }, 0);
    document.getElementById('kpis').innerHTML = '<div class="kpi"><b>' + Object.keys(actifs).length + ' / ' + c.n + '</b><span>Postes occupés</span></div><div class="kpi"><b>' + money(tot) + '</b><span>Encaissé aujourd\'hui</span></div><div class="kpi"><b>' + ses.length + '</b><span>Sessions terminées</span></div><div class="kpi"><b>' + Math.round(min / 60 * 10) / 10 + ' h</b><span>Temps vendu</span></div><div class="kpi"><b>' + pg + '</b><span>Pages imprimées</span></div>';
    document.getElementById('jour').innerHTML = ses.length ? '<table><tr><th>Poste</th><th>Début</th><th class="r">Durée</th><th class="r">Pages</th><th>Paiement</th><th class="r">Montant</th></tr>' + ses.slice().reverse().map(function (x) { return '<tr><td>' + H(x.poste) + '</td><td>' + new Date(x.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</td><td class="r">' + x.minutes + ' min' + (x.forfait ? ' (' + H(x.forfait) + ')' : '') + '</td><td class="r">' + (x.pages || 0) + '</td><td>' + H(x.pm) + '</td><td class="r"><b>' + money(x.montant) + '</b></td></tr>'; }).join('') + '</table>' : '<div class="empty">Aucune session terminée aujourd\'hui.</div>';
    document.getElementById('c-n').value = c.n; document.getElementById('c-h').value = c.tarifHeure; document.getElementById('c-m').value = c.minimum; document.getElementById('c-p').value = c.pas; document.getElementById('c-pg').value = c.prixPage;
  }
  function tic() {
    var now = Date.now();
    Object.keys(actifs).forEach(function (i) {
      var s = actifs[i], el = document.querySelector('[data-t="' + i + '"]'); if (!el) return;
      var ecoule = now - s.debut, reste = s.forfait ? s.forfait.minutes * 60000 - ecoule : 0;
      if (s.forfait && reste <= 0 && !el.closest('.alert')) { rendre(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); return; }
      el.textContent = hms(s.forfait && reste > 0 ? reste : ecoule);
    });
  }
  window.Postes = { montantTemps: montantTemps, montantSession: montantSession };
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('kpis')) return;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return; var id = b.closest('.pc').dataset.p;
      if (b.dataset.a === 'f') debuter(id, FORFAITS[+b.dataset.i]); else if (b.dataset.a === 'libre') debuter(id, null); else if (b.dataset.a === 'fin') terminer(id); else if (b.dataset.a === 'ann') annuler(id);
    });
    document.getElementById('d-pages').addEventListener('input', maj);
    document.getElementById('d-ok').onclick = encaisser;
    document.getElementById('d-no').onclick = function () { document.getElementById('dlg').close(); courant = null; };
    document.getElementById('c-save').onclick = function () {
      var n = Math.min(40, Math.max(1, +document.getElementById('c-n').value || DEF.n));
      ecrire(CFG, { n: n, tarifHeure: Math.max(0, +document.getElementById('c-h').value || 0), minimum: Math.max(0, +document.getElementById('c-m').value || 0), pas: Math.min(60, Math.max(1, +document.getElementById('c-p').value || DEF.pas)), prixPage: Math.max(0, +document.getElementById('c-pg').value || 0) });
      rendre(); if (window.ST && ST.toast) ST.toast('Réglages enregistrés', 'success');
    };
    rendre(); setInterval(tic, 1000);
    window.addEventListener('storage', function () { actifs = lire(ACT, {}); rendre(); });
  });
})();
