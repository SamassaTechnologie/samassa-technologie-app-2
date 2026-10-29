/* Assistant IA de gestion : collecte des totaux (sans données personnelles) et conversation */
'use strict';
(function () {
  var H = window.escHtml, historique = [], occupe = false;
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function n(x) { return Math.round(Number(x) || 0); }
  function somme(l, f) { return l.reduce(function (s, x) { return s + n(f(x)); }, 0); }
  function moisPrecedent(m) { var p = m.split('-'), d = new Date(+p[0], +p[1] - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function top(obj, k) { return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, k).reduce(function (o, c) { o[c] = obj[c]; return o; }, {}); }

  /* Collecte pure : ne renvoie que des totaux, jamais de noms de clients ni de téléphones */
  function collecter(src, maintenant) {
    src = src || {}; var L = src.lire || lire, auj = (maintenant || new Date().toISOString()).slice(0, 10), mois = auj.slice(0, 7), prec = moisPrecedent(mois);
    var caisse = L('samassa_mouvements'), stock = L('samassa_stock_v2'), mvts = L('samassa_stock_mouvements'), fixes = L('samassa_charges_fixes');
    var out = { date: auj, mois: mois };
    var R = window.Rentabilite, d = { caisse: caisse, stock: stock, mvts: mvts, fixes: fixes };
    if (R) {
      var c = R.calculer(mois, d), p = R.calculer(prec, d);
      out.rentabilite = { chiffreAffaires: c.ca, coutMarchandises: c.cout, margeBrute: c.margeBrute, tauxMargePct: Math.round(c.tauxMarge), sortiesCaisse: c.depenses, chargesFixes: c.chargesFixes, beneficeNet: c.net, seuilRentabilite: n(c.pointMort), caParCategorie: top(c.parCat, 8), produitsTopMarge: c.produits.slice(0, 5).map(function (x) { return { produit: x.nom, quantite: x.qte, marge: n(x.marge) }; }), moisPrecedent: { chiffreAffaires: p.ca, beneficeNet: p.net } };
    }
    var jours = {}, depuis = new Date(new Date(auj + 'T12:00:00').getTime() - 14 * 864e5).toISOString().slice(0, 10), modes = {};
    caisse.forEach(function (m) { if (!m.date) return; var j = String(m.date).slice(0, 10); if (j >= depuis) { var o = jours[j] = jours[j] || { entrees: 0, sorties: 0 }; o[m.type === 'entree' ? 'entrees' : 'sorties'] += n(m.amount); } if (String(m.date).slice(0, 7) === mois && m.type === 'entree') modes[m.pm || 'Autre'] = (modes[m.pm || 'Autre'] || 0) + n(m.amount); });
    out.caisse = { soldeTotal: somme(caisse.filter(function (m) { return m.type === 'entree'; }), function (m) { return m.amount; }) - somme(caisse.filter(function (m) { return m.type === 'sortie'; }), function (m) { return m.amount; }), parJour14j: jours, encaissementsParModeCeMois: modes, derniereClotures: L('samassa_clotures').slice(-4).map(function (c) { return { date: c.date, theorique: c.theorique, reel: c.reel, ecart: c.ecart }; }) };
    out.stock = { articles: stock.length, valeurAchat: somme(stock, function (a) { return (a.qty || 0) * (a.pa || 0); }), aReapprovisionner: stock.filter(function (a) { return n(a.qty) <= n(a.min); }).slice(0, 10).map(function (a) { return { article: a.name, quantite: n(a.qty), seuil: n(a.min) }; }), prixAchatManquant: stock.filter(function (a) { return !(n(a.pa) > 0); }).length };
    var br = L('samassa_bons_reparation'), SR = window.SuiviRep, actifs = br.filter(function (b) { return ['Restitué au client', 'Annulé', 'Terminé'].indexOf(b.status) < 0; }), parStatut = {};
    br.forEach(function (b) { parStatut[b.status || '?'] = (parStatut[b.status || '?'] || 0) + 1; });
    out.reparations = { parStatut: parStatut, enCours: actifs.length, enRetard: SR ? br.filter(SR.enRetard).length : null, soldesAEncaisser: somme(actifs, function (b) { return b.balance; }) };
    var C = window.Contrats, ct = L('samassa_contrats');
    out.contrats = C ? { actifs: ct.filter(function (c) { return c.statut !== 'suspendu'; }).length, revenuMensuelRecurrent: C.mrr(ct), enRetard: ct.filter(function (c) { return C.etat(c, auj).cle === 'late'; }).length, totalImpaye: somme(ct, function (c) { return C.etat(c, auj).impayes.length * (c.montant || 0); }) } : null;
    var cr = L('samassa_creances').filter(function (c) { return !c.paid; });
    out.creancesClients = { nombre: cr.length, total: somme(cr, function (c) { return c.amount; }), echeanceDepassee: cr.filter(function (c) { return c.due && c.due < auj; }).length, montantEcheanceDepassee: somme(cr.filter(function (c) { return c.due && c.due < auj; }), function (c) { return c.amount; }) };
    var cm = L('samassa_commandes'), CM = window.Commandes;
    out.commandesFournisseurs = { aRecevoir: cm.filter(function (c) { return c.statut === 'Commandée'; }).length, duAuxFournisseurs: CM ? somme(cm.filter(function (c) { return c.statut !== 'Annulée'; }), function (c) { return Math.max(0, CM.totalCmd(c) - (c.paye || 0)); }) : null };
    var ses = L('samassa_sessions_cyber').filter(function (s) { return String(s.date).slice(0, 7) === mois; });
    out.cybercafe = { sessionsCeMois: ses.length, encaisseCeMois: somme(ses, function (s) { return s.montant; }), heuresVendues: Math.round(somme(ses, function (s) { return s.minutes; }) / 6) / 10, pagesImprimees: somme(ses, function (s) { return s.pages; }) };
    var RP = window.Rapprochement, rel = L('samassa_mm_releves').filter(function (r) { return String(r.date).slice(0, 7) === mois; });
    if (RP && rel.length) { var rr = RP.rapprocher(rel, caisse.filter(function (m) { return String(m.date).slice(0, 7) === mois; })); out.mobileMoney = { paiementsRecus: rel.length, rapproches: rr.liens.length, recusSansPaiement: rr.sansPaiement.length, montantRecusSansPaiement: somme(rr.sansPaiement, function (m) { return m.amount; }), paiementsHorsCaisse: rr.sansCaisse.length, montantHorsCaisse: somme(rr.sansCaisse, function (m) { return m.montant; }) }; }
    else out.mobileMoney = 'aucun relevé importé ce mois';
    return out;
  }

  async function jeton() { try { if (typeof Auth !== 'undefined' && Auth.idToken) return await Auth.idToken(); } catch (e) {} return null; }
  function bulle(cls, texte) { var d = document.createElement('div'); d.className = 'b ' + cls; d.textContent = texte; document.getElementById('chat').appendChild(d); d.scrollIntoView({ block: 'end', behavior: 'smooth' }); return d; }
  function outils(b, texte) {
    var t = document.createElement('div'); t.className = 'tools';
    var c = document.createElement('button'); c.type = 'button'; c.textContent = '📋 Copier';
    c.onclick = function () { try { navigator.clipboard.writeText(texte); c.textContent = '✓ Copié'; } catch (e) {} };
    t.appendChild(c); b.appendChild(t);
  }
  async function demander(question) {
    question = String(question || '').trim().slice(0, 300); if (!question || occupe) return;
    occupe = true; document.getElementById('go').disabled = true; document.querySelectorAll('.chip').forEach(function (c) { c.disabled = true; });
    bulle('u', question); var att = bulle('a wait', 'Analyse en cours…');
    try {
      var donnees = collecter(); document.getElementById('donnees').textContent = JSON.stringify(donnees, null, 1);
      var h = { 'Content-Type': 'application/json' }, t = await jeton(); if (t) h.Authorization = 'Bearer ' + t;
      var r = await fetch('/api/analyse-ia', { method: 'POST', headers: h, body: JSON.stringify({ donnees: donnees, question: question, historique: historique }), signal: AbortSignal.timeout(28000) });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok || !d.text) throw new Error(r.status === 401 ? 'Session expirée : reconnectez-vous (Déco. puis connexion).' : (d.error || 'Service IA indisponible'));
      att.className = 'b a'; att.textContent = d.text; outils(att, d.text);
      historique.push({ q: question, r: d.text }); historique = historique.slice(-4);
    } catch (e) { att.className = 'b a err'; att.textContent = '⚠️ ' + (e && e.name === 'TimeoutError' ? 'Le service met trop de temps à répondre. Réessayez.' : (e.message || 'Erreur')); }
    occupe = false; document.getElementById('go').disabled = false; document.querySelectorAll('.chip').forEach(function (c) { c.disabled = false; });
  }
  var SUGG = [['📊 Bilan du mois', 'Fais le bilan complet de ce mois.'], ['📦 Quoi réapprovisionner ?', 'Quels articles dois-je réapprovisionner en priorité et pourquoi ?'], ['💸 Qui me doit de l\'argent ?', 'Résume mes créances, mes contrats impayés et ce que je dois relancer en priorité.'], ['🔧 Réparations en retard', 'Où en sont mes réparations ? Qu\'est-ce qui est en retard ou à encaisser ?'], ['📈 Augmenter mon bénéfice', 'Que puis-je faire concrètement pour augmenter mon bénéfice le mois prochain ?'], ['🔍 Anomalies ?', 'Vois-tu des anomalies dans la caisse, les clôtures ou les paiements Mobile Money ?']];
  window.AssistantIA = { collecter: collecter };
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('chips')) return;
    document.getElementById('chips').innerHTML = SUGG.map(function (s, i) { return '<button type="button" class="chip" data-i="' + i + '">' + H(s[0]) + '</button>'; }).join('');
    document.getElementById('chips').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) demander(SUGG[+b.dataset.i][1]); });
    document.getElementById('go').onclick = function () { var q = document.getElementById('q'); demander(q.value); q.value = ''; };
    document.getElementById('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('go').click(); });
    document.getElementById('donnees').textContent = JSON.stringify(collecter(), null, 1);
    bulle('a', 'Bonjour ! Je peux analyser votre activité à partir de vos chiffres. Choisissez une question ci-dessus ou écrivez la vôtre.');
  });
})();
