/* Rentabilité : CA - coût des marchandises - sorties de caisse - charges fixes = bénéfice net */
'use strict';
(function () {
  var H = window.escHtml, FIX = 'samassa_charges_fixes';
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function money(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function pct(n) { return (isFinite(n) ? Math.round(n * 10) / 10 : 0) + ' %'; }
  function moisDe(d) { return String(d || '').slice(0, 7); }
  function decaler(m, k) { var p = m.split('-'), d = new Date(+p[0], +p[1] - 1 + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function libelle(m) { var p = m.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); }

  /* Calcul pur, testable */
  function calculer(mois, data) {
    var caisse = data.caisse || [], stock = data.stock || [], mvts = data.mvts || [], fixes = data.fixes || [];
    var entrees = caisse.filter(function (m) { return m.type === 'entree' && moisDe(m.date) === mois; });
    /* les achats de stock ne sont pas des charges : leur coût est compté à la vente (coût des marchandises) */
    var sorties = caisse.filter(function (m) { return m.type === 'sortie' && moisDe(m.date) === mois && m.cat !== 'Achat stock'; });
    var ca = entrees.reduce(function (s, m) { return s + (Number(m.amount) || 0); }, 0);
    var parCat = {};
    entrees.forEach(function (m) { var c = m.cat || 'Autres'; parCat[c] = (parCat[c] || 0) + (Number(m.amount) || 0); });
    var pa = {}; stock.forEach(function (a) { pa[a.id] = Number(a.pa) || 0; });
    var prod = {}, cout = 0, caVente = 0;
    mvts.filter(function (m) { return m.type === 'sortie' && moisDe(m.date) === mois && /vente/i.test(m.motif || ''); }).forEach(function (m) {
      var q = Number(m.qty) || 0, c = q * (pa[m.articleId] || 0), v = q * (Number(m.prix) || 0);
      cout += c; caVente += v;
      var p = prod[m.name || '?'] || (prod[m.name || '?'] = { nom: m.name || '?', qte: 0, ca: 0, marge: 0 });
      p.qte += q; p.ca += v; p.marge += v - c;
    });
    var depenses = sorties.reduce(function (s, m) { return s + (Number(m.amount) || 0); }, 0);
    var chargesFixes = fixes.reduce(function (s, f) { return s + (Number(f.montant) || 0); }, 0);
    var margeBrute = ca - cout;
    var net = margeBrute - depenses - chargesFixes;
    var taux = ca > 0 ? margeBrute / ca : 0;
    var charges = depenses + chargesFixes;
    var pointMort = taux > 0 ? charges / taux : 0;
    return { ca: ca, parCat: parCat, cout: cout, caVente: caVente, margeBrute: margeBrute, depenses: depenses, chargesFixes: chargesFixes, net: net, tauxMarge: taux * 100, pointMort: pointMort, produits: Object.keys(prod).map(function (k) { return prod[k]; }).sort(function (a, b) { return b.marge - a.marge; }) };
  }
  function donnees() { return { caisse: lire('samassa_mouvements'), stock: lire('samassa_stock_v2'), mvts: lire('samassa_stock_mouvements'), fixes: lire(FIX) }; }

  var mois = new Date().toISOString().slice(0, 7);
  function rendre() {
    var d = donnees(), r = calculer(mois, d), av = calculer(decaler(mois, -1), d);
    document.getElementById('mois').value = mois;
    function delta(a, b) { if (!b) return ''; var v = (a - b) / Math.abs(b) * 100; return '<small class="' + (v >= 0 ? 'pos' : 'neg') + '">' + (v >= 0 ? '▲ ' : '▼ ') + pct(Math.abs(v)) + ' vs mois précédent</small>'; }
    document.getElementById('kpis').innerHTML =
      '<div class="kpi"><span>Chiffre d\'affaires</span><b>' + money(r.ca) + '</b>' + delta(r.ca, av.ca) + '</div>' +
      '<div class="kpi"><span>Marge brute</span><b>' + money(r.margeBrute) + '</b><small>' + pct(r.tauxMarge) + ' du CA</small></div>' +
      '<div class="kpi"><span>Charges (sorties + fixes)</span><b>' + money(r.depenses + r.chargesFixes) + '</b></div>' +
      '<div class="kpi big ' + (r.net < 0 ? 'neg-b' : '') + '"><span>Bénéfice net</span><b class="' + (r.net >= 0 ? 'pos' : 'neg') + '">' + money(r.net) + '</b>' + delta(r.net, av.net) + '</div>' +
      '<div class="kpi"><span>Seuil de rentabilité</span><b>' + (r.pointMort ? money(r.pointMort) : '—') + '</b><small style="color:#64748B">CA à atteindre pour couvrir les charges</small></div>';
    var cats = Object.keys(r.parCat).sort(function (a, b) { return r.parCat[b] - r.parCat[a]; });
    document.getElementById('detail').innerHTML = '<table><tr><th>Poste</th><th class="r">Montant</th><th class="r">Part du CA</th></tr>' +
      (cats.length ? cats.map(function (c) { return '<tr><td>' + H(c) + '</td><td class="r">' + money(r.parCat[c]) + '</td><td class="r">' + pct(r.ca ? r.parCat[c] / r.ca * 100 : 0) + '</td></tr>'; }).join('') : '<tr><td colspan="3" class="empty">Aucune entrée de caisse ce mois-ci.</td></tr>') +
      '<tr><td><b>Chiffre d\'affaires</b></td><td class="r"><b>' + money(r.ca) + '</b></td><td></td></tr>' +
      '<tr><td>− Coût des marchandises vendues</td><td class="r">' + money(r.cout) + '</td><td></td></tr>' +
      '<tr><td>− Sorties de caisse (dépenses)</td><td class="r">' + money(r.depenses) + '</td><td></td></tr>' +
      '<tr><td>− Charges fixes</td><td class="r">' + money(r.chargesFixes) + '</td><td></td></tr>' +
      '<tr><td><b>= Bénéfice net</b></td><td class="r"><b class="' + (r.net >= 0 ? 'pos' : 'neg') + '">' + money(r.net) + '</b></td><td></td></tr></table>';
    document.getElementById('fixes').innerHTML = d.fixes.length ? '<table>' + d.fixes.map(function (f) { return '<tr><td>' + H(f.label) + '</td><td class="r">' + money(f.montant) + '</td><td class="r"><button class="x" data-del="' + H(f.id) + '" aria-label="Supprimer">✕</button></td></tr>'; }).join('') + '</table>' : '<div class="empty">Aucune charge fixe enregistrée.</div>';
    var maxM = r.produits.length ? Math.max.apply(null, r.produits.map(function (p) { return Math.abs(p.marge); })) || 1 : 1;
    document.getElementById('produits').innerHTML = r.produits.length ? '<table><tr><th>Produit</th><th class="r">Qté</th><th class="r">CA</th><th class="r">Marge</th><th style="width:25%"></th></tr>' + r.produits.slice(0, 10).map(function (p) { return '<tr><td>' + H(p.nom) + '</td><td class="r">' + p.qte + '</td><td class="r">' + money(p.ca) + '</td><td class="r ' + (p.marge >= 0 ? 'pos' : 'neg') + '">' + money(p.marge) + '</td><td><div class="barw"><i style="width:' + Math.max(0, Math.round(Math.abs(p.marge) / maxM * 100)) + '%"></i></div></td></tr>'; }).join('') + '</table>' : '<div class="empty">Aucune vente de stock ce mois-ci.</div>';
  }
  function exporter() {
    var r = calculer(mois, donnees());
    var lignes = [['Mois', libelle(mois)], ['Chiffre d\'affaires', r.ca], ['Coût des marchandises', r.cout], ['Marge brute', r.margeBrute], ['Sorties de caisse', r.depenses], ['Charges fixes', r.chargesFixes], ['Bénéfice net', r.net]];
    Object.keys(r.parCat).forEach(function (c) { lignes.push(['CA - ' + c, r.parCat[c]]); });
    var csv = lignes.map(function (l) { return l.map(function (v) { v = String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'rentabilite-' + mois + '.csv'; a.click();
  }
  window.Rentabilite = { calculer: calculer };
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('prev').onclick = function () { mois = decaler(mois, -1); rendre(); };
    document.getElementById('next').onclick = function () { mois = decaler(mois, 1); rendre(); };
    document.getElementById('mois').onchange = function () { if (this.value) { mois = this.value; rendre(); } };
    document.getElementById('csv').onclick = exporter;
    document.getElementById('fadd').onclick = function () {
      var l = document.getElementById('fl').value.trim().slice(0, 60), m = parseFloat(document.getElementById('fm').value);
      if (!l || !(m > 0)) { alert('Indiquez un libellé et un montant.'); return; }
      var f = lire(FIX); f.push({ id: String(Date.now()), label: l, montant: m }); localStorage.setItem(FIX, JSON.stringify(f));
      document.getElementById('fl').value = ''; document.getElementById('fm').value = ''; rendre();
    };
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; localStorage.setItem(FIX, JSON.stringify(lire(FIX).filter(function (f) { return String(f.id) !== b.dataset.del; }))); rendre(); });
    rendre();
  });
})();
