/* Relances & rappels : créances en retard, contrats impayés, stock bas. Encaissement relié à la caisse. */
'use strict';
(function () {
  var H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function ecrire(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function fcfa(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function numWa(t) { var n = String(t || '').replace(/\D/g, ''); if (n.length === 8) n = '223' + n; return n; }
  function jours(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
  function aujourdhui() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* Fonctions pures (testables) */
  function creancesOuvertes(creances, auj) {
    return creances.filter(function (c) { return !c.paid && Number(c.amount) > 0; }).map(function (c) {
      var retard = c.due ? jours(c.due, auj) : 0;
      return { id: c.id, client: c.client || 'Client', phone: c.phone || '', amount: Number(c.amount), due: c.due || '', note: c.note || '', retard: retard, niveau: !c.due ? 'sans' : retard > 0 ? 'retard' : retard >= -3 ? 'proche' : 'ok' };
    }).sort(function (a, b) { return b.retard - a.retard || b.amount - a.amount; });
  }
  function message(c, societe) {
    var base = 'Bonjour ' + c.client + ', ici ' + (societe || 'SAMASSA TECHNOLOGIE') + '. ';
    var reste = 'Il reste ' + fcfa(c.amount) + (c.note ? ' (' + c.note + ')' : '') + ' à régler';
    if (c.niveau === 'retard') return base + reste + ', échéance dépassée de ' + c.retard + ' jour' + (c.retard > 1 ? 's' : '') + '. Merci de passer régler ou de nous contacter. 🙏';
    if (c.niveau === 'proche') return base + 'Petit rappel : ' + reste.toLowerCase() + ' le ' + c.due.split('-').reverse().join('/') + '. Merci ! 🙏';
    return base + reste + '. Merci de nous contacter. 🙏';
  }
  /* Encaissement : réduit la créance ; renvoie {creances, mouvement} */
  function encaisser(creances, id, montant, auj, mode) {
    var l = creances.map(function (c) { return Object.assign({}, c); }), c = l.find(function (x) { return x.id === id; });
    var m = Math.min(Math.max(0, Number(montant) || 0), c ? Number(c.amount) : 0);
    if (!c || m <= 0) return { creances: creances, mouvement: null };
    c.amount = Number(c.amount) - m; if (c.amount <= 0) { c.amount = 0; c.paid = true; }
    var ts = new Date().toISOString();
    return { creances: l, mouvement: { id: 'CR-' + Date.now(), date: auj, type: 'entree', desc: 'Encaissement créance — ' + (c.client || 'Client') + (c.note ? ' (' + c.note + ')' : ''), amount: m, pm: mode || 'Espèces', cat: 'Encaissement créance', auto: true, timestamp: ts } };
  }
  function stockBas(stock) { return stock.filter(function (s) { return Number(s.min) > 0 && Number(s.qty || 0) <= Number(s.min); }).map(function (s) { return { nom: s.name || s.nom || s.ref || 'Article', qty: Number(s.qty || 0), min: Number(s.min) }; }); }
  window.Relances = { creancesOuvertes: creancesOuvertes, message: message, encaisser: encaisser, stockBas: stockBas, numWa: numWa, jours: jours };

  if (typeof document === 'undefined' || !document.getElementById('rl-app')) return;
  function societe() { try { var s = JSON.parse(localStorage.getItem('samassa_settings') || '{}'); return s.companyName || 'SAMASSA TECHNOLOGIE'; } catch (e) { return 'SAMASSA TECHNOLOGIE'; } }
  var filtre = 'toutes';
  function rendre() {
    var auj = aujourdhui(), cr = creancesOuvertes(lire('samassa_creances'), auj), tot = cr.reduce(function (s, c) { return s + c.amount; }, 0);
    var enRetard = cr.filter(function (c) { return c.niveau === 'retard'; }), mRetard = enRetard.reduce(function (s, c) { return s + c.amount; }, 0);
    document.getElementById('rl-kpi').innerHTML = '<div class="k"><b>' + fcfa(tot) + '</b><span>À encaisser (' + cr.length + ')</span></div><div class="k r"><b>' + fcfa(mRetard) + '</b><span>En retard (' + enRetard.length + ')</span></div><div class="k"><b>' + cr.filter(function (c) { return c.niveau === 'proche'; }).length + '</b><span>Échéance sous 3 jours</span></div>';
    var vue = cr.filter(function (c) { return filtre === 'toutes' || c.niveau === filtre; });
    document.getElementById('rl-liste').innerHTML = vue.length ? vue.map(function (c) {
      var badge = c.niveau === 'retard' ? '<span class="p r">' + c.retard + ' j de retard</span>' : c.niveau === 'proche' ? '<span class="p a">bientôt</span>' : c.due ? '<span class="p g">dans les délais</span>' : '<span class="p">sans échéance</span>';
      return '<div class="row" data-id="' + c.id + '"><div class="inf"><b>' + H(c.client) + '</b> ' + badge + '<div class="m">' + fcfa(c.amount) + (c.due ? ' · échéance ' + H(c.due.split('-').reverse().join('/')) : '') + (c.note ? ' · ' + H(c.note) : '') + '</div></div>' +
        '<div class="act"><button class="b wa" data-a="wa">💬 Relancer</button><input type="number" min="1" inputmode="numeric" placeholder="Montant" value="' + c.amount + '" aria-label="Montant encaissé"><button class="b ok" data-a="enc">💰 Encaisser</button></div></div>';
    }).join('') : '<div class="vide">Aucune créance dans cette vue. 🎉</div>';
    var sb = stockBas(lire('samassa_stock_v2'));
    document.getElementById('rl-stock').innerHTML = sb.length ? sb.slice(0, 15).map(function (s) { return '<div class="row"><div class="inf"><b>' + H(s.nom) + '</b><div class="m">Stock ' + s.qty + ' / minimum ' + s.min + '</div></div></div>'; }).join('') : '<div class="vide">Aucune alerte de stock.</div>';
    var ct = '';
    try { var C = window.Contrats; if (C) { lire('samassa_contrats').filter(function (c) { return C.etat(c, auj).cle === 'late'; }).forEach(function (c) { ct += '<div class="row"><div class="inf"><b>' + H(c.client || c.nom || 'Contrat') + '</b><div class="m">Échéance de contrat impayée</div></div></div>'; }); } } catch (e) {}
    document.getElementById('rl-contrats').innerHTML = ct || '<div class="vide">Aucun contrat en retard.</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-a]'); if (b) {
      var row = b.closest('.row'), id = Number(row.dataset.id) || row.dataset.id, auj = aujourdhui(), l = lire('samassa_creances'), c = creancesOuvertes(l, auj).find(function (x) { return String(x.id) === String(id); }); if (!c) return;
      if (b.dataset.a === 'wa') { window.location.href = 'https://wa.me/' + numWa(c.phone) + '?text=' + encodeURIComponent(message(c, societe())); return; }
      var m = Number(row.querySelector('input').value), r = encaisser(l, l.find(function (x) { return String(x.id) === String(id); }).id, m, auj, 'Espèces');
      if (!r.mouvement) { alert('Montant invalide.'); return; }
      ecrire('samassa_creances', r.creances); var cs = lire('samassa_mouvements'); cs.push(r.mouvement); ecrire('samassa_mouvements', cs); rendre();
    }
    var f = e.target.closest && e.target.closest('[data-f]'); if (f) { filtre = f.dataset.f; document.querySelectorAll('[data-f]').forEach(function (x) { x.classList.toggle('on', x === f); }); rendre(); }
  });
  document.addEventListener('DOMContentLoaded', rendre); if (document.readyState !== 'loading') rendre();
})();
