/* Rapprochement Mobile Money : SMS reçus ↔ entrées de caisse */
'use strict';
(function () {
  var KEY = 'samassa_mm_releves', H = window.escHtml, mois = new Date().toISOString().slice(0, 7), brouillon = [];
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function money(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function fr(s) { return s ? new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'; }
  function operateur(t) { t = String(t || '').toLowerCase(); return /wave/.test(t) ? 'Wave' : /orange/.test(t) ? 'Orange Money' : /moov/.test(t) ? 'Moov Money' : ''; }
  function nombre(brut) {
    var s = String(brut).replace(/[\s  ]/g, '');
    if (/[.,]\d{2}$/.test(s) && !/[.,]\d{3}$/.test(s)) s = s.replace(/[.,]\d{2}$/, '');
    s = s.replace(/[.,]/g, ''); var n = parseInt(s, 10); return n > 0 && n < 1e9 ? n : 0;
  }
  function dateDe(t, defaut) {
    var m = String(t).match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
    if (m) { var y = +m[3]; if (y < 100) y += 2000; var mo = +m[2], d = +m[1]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
    return defaut;
  }
  /* Analyse d'un lot de SMS collés */
  function analyserSms(texte, aujourdhui) {
    aujourdhui = aujourdhui || new Date().toISOString().slice(0, 10);
    var blocs = String(texte || '').split(/\n\s*\n/).map(function (b) { return b.trim(); }).filter(Boolean);
    if (blocs.length === 1 && blocs[0].split('\n').length > 1 && blocs[0].split('\n').every(function (l) { return /\d/.test(l); })) blocs = blocs[0].split('\n').map(function (b) { return b.trim(); }).filter(Boolean);
    var ok = [], ignores = 0;
    blocs.forEach(function (b) {
      var entrant = /re[çc]u|received|cr[ée]dit|vous avez re/i.test(b) && !/vous avez (envoy|pay)|transfert effectu|retrait/i.test(b);
      var m = b.match(/(\d[\d\s  .,]*)\s*(?:FCFA|F\s?CFA|XOF|CFA|F(?![A-Za-z0-9]))/i), montant = m ? nombre(m[1]) : 0;
      if (!entrant || !montant) { ignores++; return; }
      var ref = (b.match(/(?:ID|r[ée]f(?:[ée]rence)?|trans(?:action)?\.?(?:\s*id)?)\s*[:#]?\s*([A-Z0-9][A-Z0-9._-]{4,})/i) || [])[1] || '';
      ok.push({ operateur: operateur(b) || 'Autre', montant: montant, date: dateDe(b, aujourdhui), ref: ref.slice(0, 40), brut: b.slice(0, 300) });
    });
    return { retenus: ok, ignores: ignores };
  }
  /* Rapprochement : même opérateur, même montant, date à ±1 jour, chaque ligne utilisée une seule fois */
  function rapprocher(releves, caisse) {
    var mobiles = caisse.filter(function (m) { return m.type === 'entree' && operateur(m.pm); });
    var pris = {}, liens = [], sansCaisse = [];
    function ecart(a, b) { return Math.abs(new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5; }
    releves.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (r) {
      var cand = mobiles.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) { return !pris[x.i] && operateur(x.m.pm) === r.operateur && Math.round(Number(x.m.amount)) === r.montant && ecart(String(x.m.date).slice(0, 10), r.date) <= 1; });
      cand.sort(function (a, b) { return ecart(String(a.m.date).slice(0, 10), r.date) - ecart(String(b.m.date).slice(0, 10), r.date); });
      if (cand[0]) { pris[cand[0].i] = true; liens.push({ releve: r, caisse: cand[0].m }); } else sansCaisse.push(r);
    });
    var sansPaiement = mobiles.filter(function (m, i) { return !pris[i]; });
    return { liens: liens, sansCaisse: sansCaisse, sansPaiement: sansPaiement };
  }

  function ecrire(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
  function tableau(cols, lignes) { return lignes.length ? '<table><tr>' + cols.map(function (c) { return '<th' + (c[1] ? ' class="r"' : '') + '>' + c[0] + '</th>'; }).join('') + '</tr>' + lignes.join('') + '</table>' : '<div class="empty">Rien à signaler.</div>'; }
  function rendre() {
    document.getElementById('mois').value = mois;
    var rel = lire(KEY).filter(function (r) { return String(r.date).slice(0, 7) === mois; });
    var cai = lire('samassa_mouvements').filter(function (m) { return String(m.date).slice(0, 7) === mois; });
    var r = rapprocher(rel, cai);
    var recu = rel.reduce(function (s, x) { return s + x.montant; }, 0), enreg = cai.filter(function (m) { return m.type === 'entree' && operateur(m.pm); }).reduce(function (s, m) { return s + (Number(m.amount) || 0); }, 0);
    document.getElementById('kpis').innerHTML = '<div class="kpi"><b>' + money(recu) + '</b><span>Reçu sur le téléphone</span></div><div class="kpi"><b>' + money(enreg) + '</b><span>Enregistré en caisse (mobile)</span></div><div class="kpi ' + (r.sansPaiement.length ? 'warn' : 'good') + '"><b>' + r.sansPaiement.length + '</b><span>Reçus sans paiement</span></div><div class="kpi ' + (r.sansCaisse.length ? 'warn' : 'good') + '"><b>' + r.sansCaisse.length + '</b><span>Paiements hors caisse</span></div><div class="kpi good"><b>' + r.liens.length + '</b><span>Rapprochés</span></div>';
    document.getElementById('sans-paiement').innerHTML = tableau([['Date'], ['Description'], ['Mode'], ['Montant', 1]], r.sansPaiement.map(function (m) { return '<tr><td>' + fr(m.date) + '</td><td>' + H(m.desc) + '</td><td><span class="tag o">' + H(m.pm) + '</span></td><td class="r"><b>' + money(m.amount) + '</b></td></tr>'; }));
    document.getElementById('sans-caisse').innerHTML = tableau([['Date'], ['Opérateur'], ['Référence'], ['Montant', 1], ['', 1]], r.sansCaisse.map(function (x) { return '<tr><td>' + fr(x.date) + '</td><td><span class="tag o">' + H(x.operateur) + '</span></td><td>' + H(x.ref || '—') + '</td><td class="r"><b>' + money(x.montant) + '</b></td><td class="r"><button class="btn s" data-del="' + H(x.id) + '" aria-label="Retirer">✕</button></td></tr>'; }));
    document.getElementById('ok').innerHTML = tableau([['Date'], ['Opérateur'], ['Caisse'], ['Montant', 1]], r.liens.map(function (l) { return '<tr><td>' + fr(l.releve.date) + '</td><td><span class="tag">' + H(l.releve.operateur) + '</span></td><td>' + H(l.caisse.desc) + '</td><td class="r">' + money(l.releve.montant) + '</td></tr>'; }));
  }
  function apercu() {
    var z = document.getElementById('apercu');
    if (!brouillon.length) { z.innerHTML = ''; return; }
    z.innerHTML = '<div style="margin-top:10px"><b style="font-size:13px">' + brouillon.length + ' paiement(s) détecté(s)</b>' + tableau([['Date'], ['Opérateur'], ['Référence'], ['Montant', 1]], brouillon.map(function (x) { return '<tr><td>' + fr(x.date) + '</td><td>' + H(x.operateur) + '</td><td>' + H(x.ref || '—') + '</td><td class="r"><b>' + money(x.montant) + '</b></td></tr>'; })) + '<div class="row"><button class="btn" id="imp">Importer ces paiements</button><button class="btn s" id="ann">Annuler</button></div></div>';
    document.getElementById('imp').onclick = function () {
      var l = lire(KEY), vus = {}; l.forEach(function (x) { if (x.ref) vus[x.operateur + '|' + x.ref] = 1; });
      var neufs = brouillon.filter(function (x) { return !(x.ref && vus[x.operateur + '|' + x.ref]); }), doublons = brouillon.length - neufs.length;
      neufs.forEach(function (x, i) { l.push(Object.assign({ id: 'MM-' + Date.now() + '-' + i }, x)); }); ecrire(l);
      brouillon = []; document.getElementById('brut').value = ''; apercu(); rendre();
      if (window.ST && ST.toast) ST.toast(neufs.length + ' importé(s)' + (doublons ? ', ' + doublons + ' doublon(s) ignoré(s)' : ''), 'success');
    };
    document.getElementById('ann').onclick = function () { brouillon = []; apercu(); };
  }
  window.Rapprochement = { analyserSms: analyserSms, rapprocher: rapprocher, nombre: nombre };
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('kpis')) return;
    document.getElementById('m-dt').value = new Date().toISOString().slice(0, 10);
    document.getElementById('analyser').onclick = function () {
      var r = analyserSms(document.getElementById('brut').value); brouillon = r.retenus; apercu();
      if (!r.retenus.length) document.getElementById('apercu').innerHTML = '<div class="empty" style="margin-top:10px">Aucun paiement reçu détecté' + (r.ignores ? ' (' + r.ignores + ' message(s) ignoré(s))' : '') + '. Vérifiez que les SMS contiennent « reçu » et le montant en FCFA.</div>';
    };
    document.getElementById('m-add').onclick = function () {
      var mt = Math.round(+document.getElementById('m-mt').value), dt = document.getElementById('m-dt').value;
      if (!(mt > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) { alert('Indiquez un montant et une date.'); return; }
      var l = lire(KEY); l.push({ id: 'MM-' + Date.now(), operateur: document.getElementById('m-op').value, montant: mt, date: dt, ref: document.getElementById('m-ref').value.trim().slice(0, 40), brut: '' });
      ecrire(l); document.getElementById('m-mt').value = ''; document.getElementById('m-ref').value = ''; rendre();
    };
    document.getElementById('mois').onchange = function () { if (this.value) { mois = this.value; rendre(); } };
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (b) { ecrire(lire(KEY).filter(function (x) { return x.id !== b.dataset.del; })); rendre(); } });
    window.addEventListener('storage', rendre); rendre();
  });
})();
