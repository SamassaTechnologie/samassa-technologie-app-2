/* Employés & paie : salaire de base, absences, primes, avances, bulletin du mois, paiement relié à la caisse (sortie). */
'use strict';
(function () {
  var KEY = 'samassa_employes', JOURS = 26;
  var H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lire() { try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function fcfa(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function moisCle(d) { return String(d).slice(0, 7); }
  /* Purs */
  function mouvements(e, mois, type) { return (e.lignes || []).filter(function (l) { return l.mois === mois && l.type === type; }); }
  function somme(e, mois, type, champ) { return mouvements(e, mois, type).reduce(function (s, l) { return s + (Number(l[champ || 'montant']) || 0); }, 0); }
  function bulletin(e, mois) {
    var base = Number(e.salaire) || 0, abs = somme(e, mois, 'absence', 'jours'), retenue = Math.round(base / JOURS * abs), primes = somme(e, mois, 'prime'), avances = somme(e, mois, 'avance');
    var net = Math.max(0, base - retenue + primes - avances), paye = mouvements(e, mois, 'paie').reduce(function (s, l) { return s + (Number(l.montant) || 0); }, 0);
    return { base: base, absences: abs, retenue: retenue, primes: primes, avances: avances, net: net, paye: paye, reste: Math.max(0, net - paye) };
  }
  function ajouter(e, mois, type, valeur, note, auj) {
    var l = { mois: mois, type: type, date: auj, note: note || '' }; if (type === 'absence') l.jours = Number(valeur) || 0; else l.montant = Number(valeur) || 0;
    return Object.assign({}, e, { lignes: (e.lignes || []).concat([l]) });
  }
  /* Une avance ou un paiement de salaire sort de la caisse */
  function sortieCaisse(e, type, montant, auj, note) {
    return { id: (type === 'paie' ? 'SAL-' : 'AVA-') + Date.now(), date: auj, type: 'sortie', desc: (type === 'paie' ? 'Salaire ' : 'Avance sur salaire ') + e.nom + (note ? ' (' + note + ')' : ''), amount: Number(montant), pm: 'Espèces', cat: 'Salaires', auto: true, timestamp: new Date().toISOString() };
  }
  function totalMois(l, mois) { return l.reduce(function (s, e) { var b = bulletin(e, mois); return { net: s.net + b.net, paye: s.paye + b.paye, reste: s.reste + b.reste }; }, { net: 0, paye: 0, reste: 0 }); }
  window.Employes = { bulletin: bulletin, ajouter: ajouter, sortieCaisse: sortieCaisse, totalMois: totalMois, JOURS: JOURS };

  if (typeof document === 'undefined' || !document.getElementById('em-app')) return;
  function $(i) { return document.getElementById(i); }
  function auj() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function save(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
  function caisse(m) { var c = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]'); c.push(m); localStorage.setItem('samassa_mouvements', JSON.stringify(c)); }
  function rendre() {
    var M = $('em-mois').value || moisCle(auj()), l = lire(), t = totalMois(l, M);
    $('em-kpi').innerHTML = '<div class="k"><b>' + l.length + '</b><span>Employés</span></div><div class="k"><b>' + fcfa(t.net) + '</b><span>Masse salariale (net) ' + M + '</span></div><div class="k"><b>' + fcfa(t.paye) + '</b><span>Déjà payé</span></div><div class="k r"><b>' + fcfa(t.reste) + '</b><span>Reste à payer</span></div>';
    $('em-liste').innerHTML = l.length ? l.map(function (e) {
      var b = bulletin(e, M);
      return '<div class="pj" data-id="' + e.id + '"><div class="top"><div><b>' + H(e.nom) + '</b> <span class="p">' + H(e.poste || '') + '</span><div class="m">Salaire de base ' + fcfa(b.base) + '</div></div><b>' + fcfa(b.net) + '</b></div>' +
        '<div class="m">Absences : ' + b.absences + ' j (−' + fcfa(b.retenue) + ') · Primes : +' + fcfa(b.primes) + ' · Avances : −' + fcfa(b.avances) + '</div><div class="m"><b>Payé ' + fcfa(b.paye) + ' · reste ' + fcfa(b.reste) + '</b></div>' +
        '<div class="act"><button class="b ok" data-a="abs">📆 Absence</button><button class="b ok" data-a="prime">🎁 Prime</button><button class="b ok" data-a="avance">💸 Avance</button>' + (b.reste > 0 ? '<button class="b wa" data-a="paie">✅ Payer le reste</button>' : '') + '<button class="b g2" data-a="bul">🧾 Bulletin</button><button class="b g2" data-a="sup">🗑️</button></div></div>';
    }).join('') : '<div class="vide">Aucun employé. Ajoutez le premier ci-dessus.</div>';
  }
  function bulletinImp(e, M) {
    var b = bulletin(e, M), ligne = function (a, v) { return '<tr><td style="border:1px solid #999;padding:8px">' + a + '</td><td style="border:1px solid #999;padding:8px;text-align:right">' + v + '</td></tr>'; };
    $('em-cert').innerHTML = '<div style="text-align:center"><img src="logo.png" alt="" style="height:56px"><h2 style="margin:6px 0">BULLETIN DE PAIE — ' + M.split('-').reverse().join('/') + '</h2><div>SAMASSA TECHNOLOGIE — Kayes, Mali</div></div><p><b>Employé :</b> ' + H(e.nom) + ' &nbsp; <b>Poste :</b> ' + H(e.poste || '—') + '</p><table style="width:100%;border-collapse:collapse;font-size:14px">' +
      ligne('Salaire de base', fcfa(b.base)) + ligne('Retenue absences (' + b.absences + ' j)', '− ' + fcfa(b.retenue)) + ligne('Primes', '+ ' + fcfa(b.primes)) + ligne('Avances déjà versées', '− ' + fcfa(b.avances)) + ligne('<b>Net à payer</b>', '<b>' + fcfa(b.net) + '</b>') + ligne('Déjà payé', fcfa(b.paye)) + '</table><div style="display:flex;justify-content:space-between;margin-top:40px;font-size:13px"><span>Signature de l\'employé</span><span>Cachet & signature SAMASSA TECHNOLOGIE</span></div>';
    document.body.classList.add('imp-cert'); window.print(); setTimeout(function () { document.body.classList.remove('imp-cert'); }, 500);
  }
  document.addEventListener('input', function (e) { if (e.target.id === 'em-mois') rendre(); });
  document.addEventListener('click', function (e) {
    var t = e.target, M = $('em-mois').value || moisCle(auj());
    if (t.id === 'em-ok') { var n = $('em-nom').value.trim(), s = Number($('em-sal').value) || 0; if (!n || s <= 0) { alert('Nom et salaire sont obligatoires.'); return; } var l = lire(); l.push({ id: Date.now(), nom: n, poste: $('em-poste').value.trim(), tel: $('em-tel').value.trim(), salaire: s, debut: auj(), lignes: [] }); save(l); ['em-nom', 'em-poste', 'em-tel', 'em-sal'].forEach(function (i) { $(i).value = ''; }); rendre(); return; }
    var b = t.closest && t.closest('[data-a]'); if (!b) return;
    var id = Number(b.closest('.pj').dataset.id), l2 = lire(), emp = l2.find(function (x) { return x.id === id; }); if (!emp) return; var a = b.dataset.a, T = auj();
    function maj(n) { save(l2.map(function (x) { return x.id === id ? n : x; })); rendre(); }
    if (a === 'sup') { if (confirm('Supprimer cet employé et son historique ?')) { save(l2.filter(function (x) { return x.id !== id; })); rendre(); } }
    else if (a === 'bul') bulletinImp(emp, M);
    else if (a === 'abs') { var j = Number(prompt('Nombre de jours d\'absence non justifiée :', '1')); if (j > 0) maj(ajouter(emp, M, 'absence', j, '', T)); }
    else if (a === 'prime') { var p = Number(prompt('Montant de la prime (FCFA) :', '0')); if (p > 0) maj(ajouter(emp, M, 'prime', p, '', T)); }
    else if (a === 'avance') { var v = Number(prompt('Montant de l\'avance (FCFA) :', '0')); if (v > 0) { caisse(sortieCaisse(emp, 'avance', v, T)); maj(ajouter(emp, M, 'avance', v, '', T)); } }
    else if (a === 'paie') { var r = bulletin(emp, M).reste; if (r > 0 && confirm('Payer ' + fcfa(r) + ' à ' + emp.nom + ' ? (sortie de caisse)')) { caisse(sortieCaisse(emp, 'paie', r, T, M)); maj(ajouter(emp, M, 'paie', r, '', T)); } }
  });
  function init() { $('em-mois').value = moisCle(auj()); rendre(); }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
