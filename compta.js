/* Comptabilité simple : bilan mensuel (recettes / dépenses par catégorie et par mode de paiement), TVA estimée, export CSV. */
'use strict';
(function () {
  var H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function fcfa(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function mois(d) { return String(d || '').slice(0, 7); }
  function mt(m) { return Number(m.amount != null ? m.amount : m.montant) || 0; }
  function groupe(l, champ, def) { var o = {}; l.forEach(function (m) { var k = m[champ] || def; o[k] = (o[k] || 0) + mt(m); }); return Object.keys(o).map(function (k) { return { nom: k, total: o[k] }; }).sort(function (a, b) { return b.total - a.total; }); }
  /* Pur : bilan d'un mois. taux = TVA en % ; ttc = les recettes incluent la TVA */
  function bilan(mouv, m, taux, ttc) {
    var l = mouv.filter(function (x) { return mois(x.date) === m; }), e = l.filter(function (x) { return x.type === 'entree'; }), s = l.filter(function (x) { return x.type === 'sortie'; });
    var rec = e.reduce(function (t, x) { return t + mt(x); }, 0), dep = s.reduce(function (t, x) { return t + mt(x); }, 0), r = (Number(taux) || 0) / 100;
    var tva = r > 0 ? (ttc ? rec - rec / (1 + r) : rec * r) : 0;
    return { mois: m, recettes: rec, depenses: dep, resultat: rec - dep, marge: rec > 0 ? Math.round(100 * (rec - dep) / rec) : null, tva: Math.round(tva), recettesHT: Math.round(ttc && r > 0 ? rec / (1 + r) : rec), parCatRecettes: groupe(e, 'cat', 'Autre'), parCatDepenses: groupe(s, 'cat', 'Autre'), parMode: groupe(e, 'pm', 'Espèces'), nb: l.length };
  }
  function evolution(mouv, fin, n) { var out = [], p = fin.split('-').map(Number); for (var i = n - 1; i >= 0; i--) { var d = new Date(p[0], p[1] - 1 - i, 1), m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), b = bilan(mouv, m, 0, false); out.push({ mois: m, recettes: b.recettes, depenses: b.depenses, resultat: b.resultat }); } return out; }
  function csv(mouv, m) {
    var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    return '﻿' + ['Date', 'Type', 'Description', 'Catégorie', 'Mode', 'Montant (FCFA)'].join(';') + '\n' + mouv.filter(function (x) { return mois(x.date) === m; }).sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; }).map(function (x) { return [x.date, x.type === 'entree' ? 'Recette' : 'Dépense', q(x.desc), q(x.cat), q(x.pm), mt(x)].join(';'); }).join('\n');
  }
  window.Compta = { bilan: bilan, evolution: evolution, csv: csv, groupe: groupe };

  if (typeof document === 'undefined' || !document.getElementById('cp-app')) return;
  function $(i) { return document.getElementById(i); }
  function auj() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ligne(t) { return t.length ? t.map(function (x) { return '<div class="row"><span>' + H(x.nom) + '</span><b>' + fcfa(x.total) + '</b></div>'; }).join('') : '<div class="vide">Aucune opération.</div>'; }
  function rendre() {
    var M = $('cp-mois').value || auj().slice(0, 7), taux = Number($('cp-tva').value) || 0, ttc = $('cp-ttc').checked, mv = lire('samassa_mouvements'), b = bilan(mv, M, taux, ttc);
    try { localStorage.setItem('samassa_compta_cfg', JSON.stringify({ taux: taux, ttc: ttc })); } catch (e) {}
    $('cp-kpi').innerHTML = '<div class="k"><b>' + fcfa(b.recettes) + '</b><span>Recettes</span></div><div class="k"><b>' + fcfa(b.depenses) + '</b><span>Dépenses</span></div><div class="k ' + (b.resultat < 0 ? 'r' : 'v') + '"><b>' + fcfa(b.resultat) + '</b><span>Résultat' + (b.marge !== null ? ' · marge ' + b.marge + ' %' : '') + '</span></div><div class="k"><b>' + fcfa(b.tva) + '</b><span>TVA estimée (' + taux + ' %)</span></div>';
    $('cp-rec').innerHTML = ligne(b.parCatRecettes); $('cp-dep').innerHTML = ligne(b.parCatDepenses); $('cp-mode').innerHTML = ligne(b.parMode);
    var ev = evolution(mv, M, 6), max = Math.max.apply(null, ev.map(function (x) { return Math.max(x.recettes, x.depenses); }).concat([1]));
    $('cp-evo').innerHTML = ev.map(function (x) { return '<div class="ev"><div class="bars"><i class="r" style="height:' + Math.round(70 * x.recettes / max) + 'px" title="Recettes ' + fcfa(x.recettes) + '"></i><i class="d" style="height:' + Math.round(70 * x.depenses / max) + 'px" title="Dépenses ' + fcfa(x.depenses) + '"></i></div><span>' + x.mois.slice(5) + '/' + x.mois.slice(2, 4) + '</span></div>'; }).join('');
    $('cp-note').textContent = b.nb ? b.nb + ' opération(s) en caisse sur la période.' : 'Aucune opération en caisse sur ce mois.';
    var cr = lire('samassa_creances').filter(function (c) { return !c.paid; }).reduce(function (s, c) { return s + Number(c.amount || 0); }, 0);
    $('cp-aut').innerHTML = '<div class="row"><span>Créances clients à encaisser</span><b>' + fcfa(cr) + '</b></div><div class="row"><span>Recettes hors TVA (HT)</span><b>' + fcfa(b.recettesHT) + '</b></div>';
    return b;
  }
  function imprimer() {
    var M = $('cp-mois').value, b = rendre();
    var t = function (a) { return a.map(function (x) { return '<tr><td style="border:1px solid #999;padding:6px">' + H(x.nom) + '</td><td style="border:1px solid #999;padding:6px;text-align:right">' + fcfa(x.total) + '</td></tr>'; }).join('') || '<tr><td colspan="2" style="padding:6px">—</td></tr>'; };
    $('cp-imp').innerHTML = '<div style="text-align:center"><img src="logo.png" alt="" style="height:56px"><h2 style="margin:6px 0">BILAN MENSUEL — ' + M.split('-').reverse().join('/') + '</h2><div>SAMASSA TECHNOLOGIE — Kayes, Mali</div></div><h3>Recettes : ' + fcfa(b.recettes) + '</h3><table style="width:100%;border-collapse:collapse">' + t(b.parCatRecettes) + '</table><h3>Dépenses : ' + fcfa(b.depenses) + '</h3><table style="width:100%;border-collapse:collapse">' + t(b.parCatDepenses) + '</table><h2>Résultat : ' + fcfa(b.resultat) + '</h2><p>TVA estimée (' + $('cp-tva').value + ' %) : ' + fcfa(b.tva) + '. Estimation indicative à valider avec votre comptable.</p>';
    if (window.ImpressionMobile && ImpressionMobile.besoin()) { ImpressionMobile.ouvrir({ source: document.getElementById('cp-imp'), titre: 'Bilan mensuel ' + M }); return; }
    document.body.classList.add('imp-cert'); window.print(); setTimeout(function () { document.body.classList.remove('imp-cert'); }, 500);
  }
  document.addEventListener('input', function (e) { if (['cp-mois', 'cp-tva', 'cp-ttc'].indexOf(e.target.id) >= 0) rendre(); });
  document.addEventListener('click', function (e) {
    if (e.target.id === 'cp-imprimer') imprimer();
    if (e.target.id === 'cp-csv') { var M = $('cp-mois').value, a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv(lire('samassa_mouvements'), M)], { type: 'text/csv;charset=utf-8' })); a.download = 'comptabilite-' + M + '.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000); }
  });
  function init() { var c = {}; try { c = JSON.parse(localStorage.getItem('samassa_compta_cfg') || '{}'); } catch (e) {} $('cp-mois').value = auj().slice(0, 7); if (c.taux != null) $('cp-tva').value = c.taux; if (c.ttc === false) $('cp-ttc').checked = false; rendre(); }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
