/* Projets web / informatique : étapes, avancement, acomptes reliés à la caisse, soldes, retards. */
'use strict';
(function () {
  var KEY = 'samassa_projets';
  var H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var TYPES = ['Site vitrine', 'Boutique en ligne', 'Application', 'Logo / identité', 'Réseau / installation', 'Autre'];
  var ETAPES = ['Cahier des charges', 'Maquette validée', 'Développement', 'Contenu & images', 'Tests', 'Mise en ligne', 'Formation & livraison'];
  function lire() { try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function fcfa(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function fr(d) { return d ? d.split('-').reverse().join('/') : '—'; }
  /* Purs */
  function progression(p) { var e = p.etapes || []; return e.length ? Math.round(100 * e.filter(function (x) { return x.fait; }).length / e.length) : 0; }
  function paye(p) { return (p.paiements || []).reduce(function (s, x) { return s + (Number(x.montant) || 0); }, 0); }
  function solde(p) { return Math.max(0, (Number(p.prix) || 0) - paye(p)); }
  function termine(p) { return progression(p) === 100; }
  function enRetard(p, auj) { return !termine(p) && !!p.echeance && p.echeance < auj; }
  function stats(l, auj) {
    var enCours = l.filter(function (p) { return !termine(p); });
    return { total: l.length, enCours: enCours.length, termines: l.length - enCours.length, retards: l.filter(function (p) { return enRetard(p, auj); }).length, aEncaisser: l.reduce(function (s, p) { return s + solde(p); }, 0), encaisse: l.reduce(function (s, p) { return s + paye(p); }, 0) };
  }
  function ajouterPaiement(p, montant, auj, note) {
    var m = Math.min(Math.max(0, Number(montant) || 0), solde(p)); if (m <= 0) return { projet: p, mouvement: null };
    var n = Object.assign({}, p, { paiements: (p.paiements || []).concat([{ date: auj, montant: m, note: note || '' }]) });
    return { projet: n, mouvement: { id: 'PJ-' + Date.now(), date: auj, type: 'entree', desc: 'Projet « ' + (p.titre || '') + ' » — ' + (p.client || '') + (note ? ' (' + note + ')' : ''), amount: m, pm: 'Espèces', cat: 'Vente service', auto: true, timestamp: new Date().toISOString() } };
  }
  function basculer(p, i, auj) { var e = (p.etapes || []).map(function (x) { return Object.assign({}, x); }); if (e[i]) { e[i].fait = !e[i].fait; e[i].date = e[i].fait ? auj : ''; } return Object.assign({}, p, { etapes: e }); }
  function msgAvancement(p) { var prochaine = (p.etapes || []).find(function (x) { return !x.fait; }); return 'Bonjour ' + String(p.client || '').split(' ')[0] + ', point sur votre projet « ' + p.titre + ' » : avancement ' + progression(p) + ' %' + (prochaine ? ', prochaine étape : ' + prochaine.nom : ' — terminé ✅') + (solde(p) > 0 ? '. Solde restant : ' + fcfa(solde(p)) : '') + '. SAMASSA TECHNOLOGIE 🙏'; }
  window.Projets = { progression: progression, paye: paye, solde: solde, enRetard: enRetard, stats: stats, ajouterPaiement: ajouterPaiement, basculer: basculer, msgAvancement: msgAvancement, ETAPES: ETAPES, TYPES: TYPES };

  if (typeof document === 'undefined' || !document.getElementById('pj-app')) return;
  function $(i) { return document.getElementById(i); }
  function auj() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function numWa(t) { var n = String(t || '').replace(/\D/g, ''); return n.length === 8 ? '223' + n : n; }
  function save(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
  function rendre() {
    var T = auj(), l = lire(), s = stats(l, T);
    $('pj-kpi').innerHTML = '<div class="k"><b>' + s.enCours + '</b><span>Projets en cours</span></div><div class="k"><b>' + s.termines + '</b><span>Terminés</span></div><div class="k"><b>' + fcfa(s.aEncaisser) + '</b><span>Soldes à encaisser</span></div><div class="k r"><b>' + s.retards + '</b><span>En retard</span></div>';
    $('pj-liste').innerHTML = l.length ? l.slice().reverse().map(function (p) {
      var pr = progression(p), so = solde(p);
      return '<div class="pj" data-id="' + p.id + '"><div class="top"><div><b>' + H(p.titre) + '</b> <span class="p">' + H(p.type) + '</span>' + (enRetard(p, T) ? '<span class="p r">en retard</span>' : '') + '<div class="m">' + H(p.client) + ' · livraison ' + fr(p.echeance) + '</div></div><b>' + pr + ' %</b></div>' +
        '<div class="bar"><i style="width:' + pr + '%"></i></div><div class="et">' + (p.etapes || []).map(function (x, i) { return '<label><input type="checkbox" data-e="' + i + '"' + (x.fait ? ' checked' : '') + '> ' + H(x.nom) + '</label>'; }).join('') + '</div>' +
        '<div class="m">Prix ' + fcfa(p.prix) + ' · payé ' + fcfa(paye(p)) + ' · <b>solde ' + fcfa(so) + '</b></div>' +
        '<div class="act">' + (so > 0 ? '<button class="b ok" data-a="pay">💰 Encaisser un acompte</button>' : '') + '<button class="b wa" data-a="wa">💬 Point client</button><button class="b g2" data-a="sup">🗑️</button></div></div>';
    }).join('') : '<div class="vide">Aucun projet. Créez le premier pour suivre les étapes, les acomptes et les soldes.</div>';
  }
  document.addEventListener('change', function (e) { var i = e.target.dataset && e.target.dataset.e; if (i === undefined) return; var id = Number(e.target.closest('.pj').dataset.id); save(lire().map(function (p) { return p.id === id ? basculer(p, Number(i), auj()) : p; })); rendre(); });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'pj-ok') {
      var c = { client: $('pj-client').value.trim(), tel: $('pj-tel').value.trim(), titre: $('pj-titre').value.trim(), type: $('pj-type').value, prix: Number($('pj-prix').value) || 0, echeance: $('pj-ech').value }, ac = Number($('pj-acompte').value) || 0;
      if (!c.client || !c.titre) { alert('Client et titre sont obligatoires.'); return; }
      var p = Object.assign({ id: Date.now(), etapes: ETAPES.map(function (n) { return { nom: n, fait: false, date: '' }; }), paiements: [], created: auj() }, c), mv = null;
      if (ac > 0) { var r = ajouterPaiement(p, ac, auj(), 'Acompte'); p = r.projet; mv = r.mouvement; }
      var l = lire(); l.push(p); save(l); if (mv) { var cs = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]'); cs.push(mv); localStorage.setItem('samassa_mouvements', JSON.stringify(cs)); }
      ['pj-client', 'pj-tel', 'pj-titre', 'pj-prix', 'pj-ech', 'pj-acompte'].forEach(function (i) { $(i).value = ''; }); rendre(); return;
    }
    var b = t.closest && t.closest('[data-a]'); if (!b) return;
    var id = Number(b.closest('.pj').dataset.id), l2 = lire(), p2 = l2.find(function (x) { return x.id === id; }); if (!p2) return; var a = b.dataset.a;
    if (a === 'wa') window.location.href = 'https://wa.me/' + numWa(p2.tel) + '?text=' + encodeURIComponent(msgAvancement(p2));
    else if (a === 'sup') { if (confirm('Supprimer ce projet ?')) { save(l2.filter(function (x) { return x.id !== id; })); rendre(); } }
    else if (a === 'pay') { var m = prompt('Montant encaissé (FCFA) — solde : ' + solde(p2), solde(p2)); if (m === null) return; var r2 = ajouterPaiement(p2, m, auj(), 'Acompte'); if (!r2.mouvement) { alert('Montant invalide.'); return; } save(l2.map(function (x) { return x.id === id ? r2.projet : x; })); var c2 = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]'); c2.push(r2.mouvement); localStorage.setItem('samassa_mouvements', JSON.stringify(c2)); rendre(); }
  });
  function init() { $('pj-type').innerHTML = TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join(''); rendre(); }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
