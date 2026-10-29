/* Suivi des réparations : statuts, historique, SMS/WhatsApp, solde, garantie, historique par appareil */
'use strict';
(function () {
  var KEY = 'samassa_bons_reparation';
  var ETAPES = ['En attente de diagnostic', 'Diagnostic effectué', 'En réparation', 'Prêt à restituer', 'Restitué au client', 'Annulé'];
  var MSG = {
    'En attente de diagnostic': 'Nous avons bien reçu votre appareil et allons le diagnostiquer.',
    'Diagnostic effectué': 'Le diagnostic de votre appareil est terminé. Passez nous voir pour valider le devis.',
    'En réparation': 'La réparation de votre appareil est en cours.',
    'Prêt à restituer': 'Bonne nouvelle : votre appareil est prêt, vous pouvez venir le récupérer.',
    'Restitué au client': 'Merci de votre confiance. Votre appareil vous a été remis.',
    'Annulé': 'Le bon de réparation a été annulé.'
  };
  var filtre = 'actifs';
  var H = window.escHtml;
  function lire() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function ecrire(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
  function money(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function jours(s) { var m = String(s || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : 0; }
  function ajouter(dateISO, nb) { var d = new Date(dateISO + 'T12:00:00'); d.setDate(d.getDate() + nb); return d.toISOString().slice(0, 10); }
  function fr(iso) { return iso ? new Date(iso.length > 10 ? iso : iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  function aujourdhui() { return new Date().toISOString().slice(0, 10); }
  function actif(b) { return b.status !== 'Restitué au client' && b.status !== 'Annulé' && b.status !== 'Terminé'; }
  function termine(b) { return b.status === 'Restitué au client' || b.status === 'Terminé'; }
  function enRetard(b) { return actif(b) && b.returnDate && b.returnDate < aujourdhui(); }

  /* Garantie : démarre à la remise de l'appareil */
  function garantie(b) {
    var nb = jours(b.warranty); if (!nb || !termine(b)) return null;
    var debut = (b.restitue || b.cloture || '').slice(0, 10); if (!debut) return null;
    var fin = ajouter(debut, nb);
    return { fin: fin, valide: fin >= aujourdhui() };
  }

  function nbMemeAppareil(b, liste) {
    var s = (b.device && b.device.serial || '').trim().toLowerCase(); if (!s) return 0;
    return liste.filter(function (x) { return x.number !== b.number && (x.device && x.device.serial || '').trim().toLowerCase() === s; }).length;
  }

  function changerStatut(num, st) {
    var l = lire(), b = l.find(function (x) { return x.number === num; }); if (!b || b.status === st) return;
    b.historique = (b.historique || []).concat([{ de: b.status, vers: st, le: new Date().toISOString() }]);
    b.status = st;
    if (st === 'Restitué au client') { b.restitue = new Date().toISOString(); }
    ecrire(l); rendre();
    if (window.ST && ST.toast) ST.toast('Statut : ' + st, 'success');
  }

  function encaisser(num) {
    var l = lire(), b = l.find(function (x) { return x.number === num; }); if (!b) return;
    var solde = Number(b.balance) || 0;
    if (solde <= 0) { changerStatut(num, 'Restitué au client'); return; }
    if (!confirm('Encaisser ' + money(solde) + ' pour ' + b.client + ' et remettre l\'appareil ?')) return;
    var caisse; try { caisse = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]'); } catch (e) { caisse = []; }
    caisse.push({ id: 'BRC-' + Date.now(), date: aujourdhui(), type: 'entree', desc: 'Solde réparation ' + b.number + ' — ' + b.client + ' (' + ((b.device && b.device.type) || '') + ')', amount: solde, pm: 'Espèces', cat: 'Réparation clôturée', auto: true, timestamp: new Date().toISOString() });
    localStorage.setItem('samassa_mouvements', JSON.stringify(caisse));
    b.balance = 0; b.advance = (Number(b.advance) || 0) + solde; b.cloture = new Date().toISOString();
    ecrire(l); changerStatut(num, 'Restitué au client');
  }

  function texte(b) {
    var g = ''; var nb = jours(b.warranty);
    var lines = ['SAMASSA TECHNOLOGIE - Kayes', 'Bonjour ' + b.client + ',', 'Réparation ' + b.number + ' (' + ((b.device && (b.device.model || b.device.type)) || 'appareil') + ') :', '➡ ' + b.status + '. ' + (MSG[b.status] || '')];
    if (b.status === 'Prêt à restituer' && Number(b.balance) > 0) lines.push('Solde à régler : ' + money(b.balance));
    if (b.status === 'Restitué au client' && nb) lines.push('Garantie : ' + b.warranty + '.');
    lines.push('Tel: 77291931 / 62970630');
    return lines.join('\n');
  }
  function telNet(t) { return String(t || '').replace(/[^\d+]/g, ''); }
  function envoyer(num, canal) {
    var b = lire().find(function (x) { return x.number === num; }); if (!b) return;
    var tel = telNet(b.phone); if (!tel) { alert('Aucun téléphone enregistré pour ce client.'); return; }
    var m = texte(b);
    if (canal === 'wa') { var n = tel.replace(/^\+/, ''); if (n.length === 8) n = '223' + n; window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(m), '_blank'); }
    else window.open('sms:' + tel + '?body=' + encodeURIComponent(m), '_blank');
  }

  function carte(b, tous) {
    var retard = enRetard(b), pret = b.status === 'Prêt à restituer', g = garantie(b), autres = nbMemeAppareil(b, tous);
    var cl = 'card' + (retard ? ' late' : pret ? ' ready' : '');
    var pill = b.status === 'Prêt à restituer' ? 'g' : (retard || b.status === 'Annulé') ? 'r' : b.status === 'En réparation' ? 'o' : '';
    var dev = b.device || {};
    var opts = ETAPES.map(function (e) { return '<option' + (e === b.status ? ' selected' : '') + '>' + H(e) + '</option>'; }).join('');
    var gh = '';
    if (Number(jours(b.warranty)) && !termine(b)) gh = '<div class="gar" style="color:#64748B">🛡 Garantie ' + H(b.warranty) + ' après remise</div>';
    if (g) gh = '<div class="gar" style="color:' + (g.valide ? '#166534' : '#991B1B') + '">🛡 ' + (g.valide ? 'Sous garantie jusqu\'au ' : 'Garantie expirée le ') + fr(g.fin) + '</div>';
    var hist = (b.historique || []).slice(-4).map(function (h) { return H(h.vers) + ' · ' + fr(h.le); }).join(' → ');
    var solde = Number(b.balance) || 0;
    return '<div class="' + cl + '" data-num="' + H(b.number) + '"><div class="top"><div><div class="nm">' + H(b.client) + ' <span style="font-weight:600;color:#7C3AED">· ' + H(b.number) + '</span></div>' +
      '<div class="sub">' + H(dev.type || '') + (dev.model ? ' — ' + H(dev.model) : '') + (dev.serial ? ' · S/N ' + H(dev.serial) : '') + '</div>' +
      '<div class="sub">📞 ' + H(b.phone || '—') + ' · Dépôt ' + fr(b.date) + ' · Restitution prévue ' + fr(b.returnDate) + (retard ? ' <b style="color:#DC2626">(en retard)</b>' : '') + '</div>' +
      '<div class="sub">🛠 ' + H((b.problem || '').slice(0, 120)) + '</div>' + gh +
      (autres ? '<div class="gar" style="color:#92400E">⚠ ' + autres + ' autre(s) intervention(s) sur cet appareil</div>' : '') + '</div>' +
      '<div style="text-align:right"><span class="pill ' + pill + '">' + H(b.status) + '</span><div class="sub" style="margin-top:6px"><b>' + money(b.total) + '</b>' + (solde > 0 ? '<br>Reste : <b style="color:#DC2626">' + money(solde) + '</b>' : '') + '</div></div></div>' +
      '<div class="acts"><select class="st" data-act="statut" aria-label="Changer le statut">' + opts + '</select>' +
      '<button class="sms" data-act="sms">✉ SMS client</button><button class="wa" data-act="wa">💬 WhatsApp</button>' +
      (actif(b) ? '<button class="ok" data-act="rendre">✓ Encaisser et remettre</button>' : '') + '</div>' +
      (hist ? '<div class="hist">Historique : ' + hist + '</div>' : '') + '</div>';
  }

  function rendre() {
    if (!document.getElementById('kpis')) return;
    var tous = lire(), q = (document.getElementById('q').value || '').toLowerCase();
    var cnt = { actifs: tous.filter(actif).length, retard: tous.filter(enRetard).length, prets: tous.filter(function (b) { return b.status === 'Prêt à restituer'; }).length, termines: tous.filter(termine).length };
    var aEnc = tous.filter(actif).reduce(function (s, b) { return s + (Number(b.balance) || 0); }, 0);
    var kp = [['actifs', cnt.actifs, 'En cours', ''], ['retard', cnt.retard, 'En retard', 'warn'], ['prets', cnt.prets, 'Prêts à remettre', ''], ['termines', cnt.termines, 'Terminés', ''], ['tous', tous.length, 'Tous les bons', '']];
    document.getElementById('kpis').innerHTML = kp.map(function (k) { return '<div class="kpi ' + k[3] + (filtre === k[0] ? ' on' : '') + '" data-f="' + k[0] + '"><b>' + k[1] + '</b><span>' + k[2] + '</span></div>'; }).join('') +
      '<div class="kpi"><b style="font-size:16px">' + money(aEnc) + '</b><span>Soldes à encaisser</span></div>';
    var l = tous.filter(function (b) { return filtre === 'tous' || (filtre === 'actifs' && actif(b)) || (filtre === 'retard' && enRetard(b)) || (filtre === 'prets' && b.status === 'Prêt à restituer') || (filtre === 'termines' && termine(b)); });
    if (q) l = l.filter(function (b) { var d = b.device || {}; return [b.client, b.phone, b.number, d.model, d.serial].join(' ').toLowerCase().indexOf(q) >= 0; });
    l.sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
    document.getElementById('liste').innerHTML = l.length ? l.map(function (b) { return carte(b, tous); }).join('') : '<div class="empty">Aucun bon de réparation dans cette liste.</div>';
  }
  window.rendre = rendre;

  document.addEventListener('click', function (e) {
    var k = e.target.closest('.kpi[data-f]'); if (k) { filtre = k.dataset.f; rendre(); return; }
    var a = e.target.closest('[data-act]'); if (!a || a.tagName === 'SELECT') return;
    var num = a.closest('.card').dataset.num;
    if (a.dataset.act === 'sms') envoyer(num, 'sms'); else if (a.dataset.act === 'wa') envoyer(num, 'wa'); else if (a.dataset.act === 'rendre') encaisser(num);
  });
  document.addEventListener('change', function (e) { var s = e.target.closest('select[data-act="statut"]'); if (s) changerStatut(s.closest('.card').dataset.num, s.value); });
  window.SuiviRep = { garantie: garantie, enRetard: enRetard, texte: texte, changerStatut: changerStatut, encaisser: encaisser, _lire: lire };
  document.addEventListener('DOMContentLoaded', rendre);
  window.addEventListener('storage', rendre);
})();
