/* Contrats de maintenance : échéances mensuelles, paiements en caisse, rappels, visites */
'use strict';
(function () {
  var KEY = 'samassa_contrats', H = window.escHtml, editId = null;
  function lire() { try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function ecrire(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
  function money(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function aujourdhui() { return iso(new Date()); }
  function fr(s) { return s ? new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  function moisFr(m) { var p = m.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); }

  /* Échéances : une par mois depuis le mois de début jusqu'au mois courant (inclus) */
  function echeances(c, auj) {
    auj = auj || aujourdhui();
    if (!c.debut) return [];
    var p = c.debut.split('-'), y = +p[0], m = +p[1], fin = auj.slice(0, 7), out = [], jour = Math.min(28, Math.max(1, +c.jour || 5));
    for (var n = 0; n < 240; n++) {
      var mois = y + '-' + String(m).padStart(2, '0'); if (mois > fin) break;
      out.push({ mois: mois, date: mois + '-' + String(jour).padStart(2, '0'), paye: (c.payes || []).indexOf(mois) >= 0 });
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  function etat(c, auj) {
    auj = auj || aujourdhui();
    if (c.statut === 'suspendu') return { cle: 'off', txt: 'Suspendu', pill: 'g', impayes: [] };
    var ech = echeances(c, auj), impayes = ech.filter(function (e) { return !e.paye && e.date < auj; });
    var courant = ech.filter(function (e) { return !e.paye && e.date >= auj; })[0];
    if (impayes.length) return { cle: 'late', txt: impayes.length + ' mois impayé' + (impayes.length > 1 ? 's' : ''), pill: 'r', impayes: impayes };
    if (courant) {
      var j = Math.round((new Date(courant.date + 'T12:00:00') - new Date(auj + 'T12:00:00')) / 864e5);
      return { cle: j <= 5 ? 'soon' : 'ok', txt: j === 0 ? 'Échéance aujourd\'hui' : 'Échéance dans ' + j + ' j', pill: j <= 5 ? 'o' : '', impayes: [], prochaine: courant };
    }
    return { cle: 'ok', txt: 'À jour', pill: '', impayes: [] };
  }
  function mrr(l) { return l.filter(function (c) { return c.statut !== 'suspendu'; }).reduce(function (s, c) { return s + (Number(c.montant) || 0); }, 0); }

  function payer(id) {
    var l = lire(), c = l.find(function (x) { return x.id === id; }); if (!c) return;
    var e = etat(c), a = e.impayes[0] || e.prochaine; if (!a) { alert('Ce contrat est à jour.'); return; }
    if (!confirm('Encaisser ' + money(c.montant) + ' pour ' + moisFr(a.mois) + ' (' + c.client + ') ?')) return;
    c.payes = (c.payes || []).concat([a.mois]);
    var caisse; try { caisse = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]'); } catch (x) { caisse = []; }
    caisse.push({ id: 'CT-' + Date.now(), date: aujourdhui(), type: 'entree', desc: 'Contrat maintenance — ' + c.client + ' (' + moisFr(a.mois) + ')', amount: Number(c.montant) || 0, pm: 'Espèces', cat: 'Contrat maintenance', auto: true, timestamp: new Date().toISOString() });
    localStorage.setItem('samassa_mouvements', JSON.stringify(caisse));
    ecrire(l); rendre(); if (window.ST && ST.toast) ST.toast('✅ Paiement enregistré en caisse', 'success');
  }
  function visite(id) {
    var l = lire(), c = l.find(function (x) { return x.id === id; }); if (!c) return;
    c.visites = (c.visites || []).concat([aujourdhui()]); ecrire(l); rendre();
  }
  function bascule(id) { var l = lire(), c = l.find(function (x) { return x.id === id; }); if (!c) return; c.statut = c.statut === 'suspendu' ? 'actif' : 'suspendu'; ecrire(l); rendre(); }
  function supprimer(id) { var c = lire().find(function (x) { return x.id === id; }); if (!c || !confirm('Supprimer le contrat de ' + c.client + ' ?')) return; ecrire(lire().filter(function (x) { return x.id !== id; })); rendre(); }
  function telNet(t) { return String(t || '').replace(/[^\d+]/g, ''); }
  function rappel(id, canal) {
    var c = lire().find(function (x) { return x.id === id; }); if (!c) return;
    var tel = telNet(c.phone); if (!tel) { alert('Aucun téléphone enregistré.'); return; }
    var e = etat(c), du = e.impayes.length ? e.impayes.length * (Number(c.montant) || 0) : Number(c.montant) || 0;
    var msg = 'SAMASSA TECHNOLOGIE - Kayes\nBonjour ' + c.client + ',\nRappel : votre contrat de maintenance (' + money(c.montant) + '/mois) ' + (e.impayes.length ? 'a ' + e.impayes.length + ' mois en attente, soit ' + money(du) + '.' : 'arrive à échéance le ' + fr(e.prochaine ? e.prochaine.date : '') + '.') + '\nMerci de passer régler ou de nous contacter.\nTel: 77291931 / 62970630';
    if (canal === 'wa') { var n = tel.replace(/^\+/, ''); if (n.length === 8) n = '223' + n; window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(msg), '_blank'); } else window.open('sms:' + tel + '?body=' + encodeURIComponent(msg), '_blank');
  }

  function carte(c) {
    var e = etat(c), v = (c.visites || []), moisCourant = aujourdhui().slice(0, 7), vm = v.filter(function (d) { return d.slice(0, 7) === moisCourant; }).length, prevu = +c.visitesMois || 0;
    return '<div class="card ' + e.cle + '" data-id="' + H(c.id) + '"><div class="top"><div><div class="nm">' + H(c.client) + '</div><div class="sub">' + H(c.objet || '') + '</div><div class="sub">📞 ' + H(c.phone || '—') + ' · Depuis ' + fr(c.debut) + ' · Échéance le ' + H(c.jour) + ' du mois</div>' +
      (prevu ? '<div class="sub">🔧 Visites ce mois : <b>' + vm + ' / ' + prevu + '</b>' + (v.length ? ' · dernière ' + fr(v[v.length - 1]) : '') + '</div>' : '') + '</div>' +
      '<div style="text-align:right"><span class="pill ' + e.pill + '">' + H(e.txt) + '</span><div class="sub" style="margin-top:6px"><b>' + money(c.montant) + '</b> / mois' + (e.impayes.length ? '<br><b style="color:#DC2626">Dû : ' + money(e.impayes.length * (Number(c.montant) || 0)) + '</b>' : '') + '</div></div></div>' +
      '<div class="acts">' + (c.statut !== 'suspendu' ? '<button class="ok" data-a="pay">💰 Encaisser</button><button data-a="vis">🔧 Visite faite</button>' : '') + '<button class="sms" data-a="sms">✉ Rappel SMS</button><button class="wa" data-a="wa">💬 WhatsApp</button><button data-a="mod">✏ Modifier</button><button data-a="sus">' + (c.statut === 'suspendu' ? '▶ Réactiver' : '⏸ Suspendre') + '</button><button class="x" data-a="del">🗑</button></div></div>';
  }
  function rendre() {
    var tous = lire(), q = (document.getElementById('q').value || '').toLowerCase();
    var enRetard = tous.filter(function (c) { return etat(c).cle === 'late'; }), du = enRetard.reduce(function (s, c) { return s + etat(c).impayes.length * (Number(c.montant) || 0); }, 0);
    var actifs = tous.filter(function (c) { return c.statut !== 'suspendu'; });
    document.getElementById('kpis').innerHTML = '<div class="kpi"><b>' + actifs.length + '</b><span>Contrats actifs</span></div><div class="kpi"><b>' + money(mrr(tous)) + '</b><span>Revenu mensuel récurrent</span></div><div class="kpi ' + (enRetard.length ? 'warn' : '') + '"><b>' + enRetard.length + '</b><span>Contrats en retard</span></div><div class="kpi ' + (du ? 'warn' : '') + '"><b>' + money(du) + '</b><span>Total impayé</span></div>';
    var l = tous.filter(function (c) { return !q || [c.client, c.phone, c.objet].join(' ').toLowerCase().indexOf(q) >= 0; });
    var ordre = { late: 0, soon: 1, ok: 2, off: 3 };
    l.sort(function (a, b) { return ordre[etat(a).cle] - ordre[etat(b).cle] || String(a.client).localeCompare(String(b.client)); });
    document.getElementById('liste').innerHTML = l.length ? l.map(carte).join('') : '<div class="empty">Aucun contrat. Cliquez sur « Nouveau contrat » pour commencer.</div>';
  }
  function ouvrir(c) {
    editId = c ? c.id : null; document.getElementById('d-t').textContent = c ? 'Modifier le contrat' : 'Nouveau contrat';
    var g = function (i) { return document.getElementById(i); };
    g('f-client').value = c ? c.client : ''; g('f-phone').value = c ? c.phone || '' : ''; g('f-objet').value = c ? c.objet || '' : ''; g('f-montant').value = c ? c.montant : ''; g('f-jour').value = c ? c.jour : 5; g('f-debut').value = c ? c.debut : aujourdhui(); g('f-visites').value = c ? c.visitesMois || 0 : 1;
    document.getElementById('dlg').showModal();
  }
  function enregistrer() {
    var g = function (i) { return document.getElementById(i).value.trim(); };
    var client = g('f-client'), montant = parseFloat(g('f-montant')), debut = g('f-debut');
    if (!client || !(montant > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(debut)) { alert('Renseignez le client, un montant mensuel et la date de début.'); return; }
    var l = lire(), data = { client: client.slice(0, 80), phone: g('f-phone').slice(0, 30), objet: g('f-objet').slice(0, 200), montant: montant, jour: Math.min(28, Math.max(1, parseInt(g('f-jour'), 10) || 5)), debut: debut, visitesMois: Math.max(0, parseInt(g('f-visites'), 10) || 0) };
    if (editId) { var c = l.find(function (x) { return x.id === editId; }); if (c) Object.assign(c, data); }
    else {
      /* les mois déjà écoulés avant la saisie ne sont pas réclamés : on part du mois courant */
      var courant = aujourdhui().slice(0, 7), payes = [], p = debut.split('-'), y = +p[0], m = +p[1];
      for (var n = 0; n < 240; n++) { var mo = y + '-' + String(m).padStart(2, '0'); if (mo >= courant) break; payes.push(mo); m++; if (m > 12) { m = 1; y++; } }
      l.push(Object.assign({ id: 'CTR-' + Date.now(), statut: 'actif', payes: payes, visites: [], cree: new Date().toISOString(), anciensMoisIgnores: payes.length }, data));
    }
    ecrire(l); document.getElementById('dlg').close(); rendre();
  }
  window.Contrats = { echeances: echeances, etat: etat, mrr: mrr };
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('kpis')) return;
    document.getElementById('q').addEventListener('input', rendre);
    document.getElementById('nouv').onclick = function () { ouvrir(null); };
    document.getElementById('d-ok').onclick = enregistrer;
    document.getElementById('d-no').onclick = function () { document.getElementById('dlg').close(); };
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-a]'); if (!b) return; var id = b.closest('.card').dataset.id, a = b.dataset.a;
      if (a === 'pay') payer(id); else if (a === 'vis') visite(id); else if (a === 'sms') rappel(id, 'sms'); else if (a === 'wa') rappel(id, 'wa'); else if (a === 'sus') bascule(id); else if (a === 'del') supprimer(id); else if (a === 'mod') ouvrir(lire().find(function (x) { return x.id === id; }));
    });
    window.addEventListener('storage', rendre); rendre();
  });
})();
