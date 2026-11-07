/* Marketing : segments clients, campagnes WhatsApp (envoi un par un), fidélité à points. */
'use strict';
(function () {
  var H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function tel(t) { var n = String(t || '').replace(/\D/g, ''); if (n.length === 11 && n.indexOf('223') === 0) n = n.slice(3); return n.length === 8 ? n : ''; }
  function iso(r) { var t = r.timestamp || r.created; if (t) return String(t).slice(0, 10); var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(r.date || ''); if (m) return m[3] + '-' + m[2] + '-' + m[1]; return /^\d{4}-\d{2}-\d{2}/.test(r.date || '') ? r.date.slice(0, 10) : ''; }
  function jours(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
  var PALIERS = [{ nom: 'Or', min: 150, remise: 5, ico: '🥇' }, { nom: 'Argent', min: 50, remise: 3, ico: '🥈' }, { nom: 'Bronze', min: 0, remise: 0, ico: '🥉' }];
  var PTS = 1000; /* 1 point par 1 000 FCFA dépensés */
  function palier(pts) { return PALIERS.find(function (p) { return pts >= p.min; }); }

  /* Regroupe clients + achats par numéro de téléphone */
  function profils(src, auj) {
    var m = {};
    function get(t, nom) { var k = tel(t); if (!k) return null; return m[k] || (m[k] = { tel: k, nom: nom || '', total: 0, nb: 0, dernier: '', premier: '' }); }
    (src.clients || []).forEach(function (c) { var p = get(c.tel, ((c.prenom || '') + ' ' + (c.nom || '')).trim()); if (p && !p.nom) p.nom = ((c.prenom || '') + ' ' + (c.nom || '')).trim(); if (p && c.naiss) p.naiss = c.naiss; });
    (src.achats || []).forEach(function (r) {
      var p = get(r.phone || r.tel || r.clientPhone, r.client); if (!p) return;
      var t = Number(r.total) || 0, d = iso(r); if (!p.nom && r.client) p.nom = r.client;
      p.total += t; p.nb++; if (d && d > p.dernier) p.dernier = d; if (d && (!p.premier || d < p.premier)) p.premier = d;
    });
    return Object.keys(m).map(function (k) {
      var p = m[k]; p.points = Math.floor(p.total / PTS); p.palier = palier(p.points); p.inactif = p.dernier ? jours(p.dernier, auj) : null;
      p.prenom = (p.nom || 'cher client').split(' ')[0]; return p;
    }).sort(function (a, b) { return b.total - a.total; });
  }
  var SEGMENTS = {
    tous: function () { return true; },
    vip: function (p) { return p.palier.nom !== 'Bronze'; },
    inactifs: function (p) { return p.inactif !== null && p.inactif >= 60; },
    nouveaux: function (p) { return p.premier && p.inactif !== null && p.inactif <= 30 && p.nb <= 1; },
    fideles: function (p) { return p.nb >= 3; }
  };
  var MODELES = {
    promo: 'Bonjour {nom} 👋 SAMASSA TECHNOLOGIE (Kayes) vous propose : {offre}. Passez nous voir ou répondez à ce message ! 📱💻',
    retour: 'Bonjour {nom}, vous nous manquez chez SAMASSA TECHNOLOGIE 😊 Revenez avec ce message et profitez de {offre}.',
    merci: 'Bonjour {nom}, merci pour votre confiance ! 🙏 Vous cumulez {points} points fidélité ({palier}). {offre}',
    arrivage: 'Bonjour {nom}, nouveaux arrivages chez SAMASSA TECHNOLOGIE : {offre}. Stock limité ! 🛒'
  };
  function rediger(modele, p, offre) {
    return String(modele).replace(/\{nom\}/g, p.prenom || 'cher client').replace(/\{points\}/g, p.points).replace(/\{palier\}/g, p.palier.nom).replace(/\{offre\}/g, offre || 'une offre spéciale');
  }
  window.Marketing = { profils: profils, SEGMENTS: SEGMENTS, MODELES: MODELES, rediger: rediger, palier: palier, tel: tel, PALIERS: PALIERS };

  if (typeof document === 'undefined' || !document.getElementById('mk-app')) return;
  var auj = new Date().toISOString().slice(0, 10), seg = 'tous', P = [];
  function charger() {
    var achats = [].concat(lire('samassa_recus'), lire('samassa_recus_cyber'), lire('samassa_recus_vente'), lire('samassa_recus_photo'));
    P = profils({ clients: lire('samassa_clients'), achats: achats }, auj);
  }
  function envoyes() { var o = {}; lire('samassa_campagnes').forEach(function (e) { if (e.date === auj && e.modele === document.getElementById('mk-modele').value) o[e.tel] = 1; }); return o; }
  function rendre() {
    charger();
    var cible = P.filter(SEGMENTS[seg]), dej = envoyes();
    document.querySelectorAll('[data-s]').forEach(function (b) { var n = P.filter(SEGMENTS[b.dataset.s]).length; b.querySelector('i').textContent = n; b.classList.toggle('on', b.dataset.s === seg); });
    var mod = MODELES[document.getElementById('mk-modele').value], offre = document.getElementById('mk-offre').value.trim();
    document.getElementById('mk-liste').innerHTML = cible.length ? cible.slice(0, 200).map(function (p) {
      var ok = dej[p.tel];
      return '<div class="row"><div class="inf"><b>' + H(p.nom || p.tel) + '</b> <span class="p">' + p.palier.ico + ' ' + p.palier.nom + ' · ' + p.points + ' pts</span><div class="m">' + p.nb + ' achat(s) · ' + Math.round(p.total).toLocaleString('fr-FR') + ' FCFA' + (p.inactif !== null ? ' · dernier achat il y a ' + p.inactif + ' j' : '') + '</div></div>' +
        '<button class="b' + (ok ? ' fait' : '') + '" data-t="' + p.tel + '">' + (ok ? '✔ Envoyé' : '💬 Envoyer') + '</button></div>';
    }).join('') : '<div class="vide">Aucun client dans ce segment. Les clients apparaissent avec leur numéro de téléphone saisi sur les reçus et le répertoire.</div>';
    document.getElementById('mk-apercu').textContent = cible.length ? rediger(mod, cible[0], offre) : '';
    document.getElementById('mk-fid').innerHTML = PALIERS.map(function (pl) { var n = P.filter(function (p) { return p.palier.nom === pl.nom; }).length; return '<div class="k"><b>' + pl.ico + ' ' + pl.nom + '</b><span>' + n + ' client(s) · dès ' + pl.min + ' pts · remise ' + pl.remise + ' %</span></div>'; }).join('');
  }
  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('[data-s]'); if (s) { seg = s.dataset.s; rendre(); return; }
    var b = e.target.closest && e.target.closest('[data-t]'); if (!b) return;
    var p = P.find(function (x) { return x.tel === b.dataset.t; }); if (!p) return;
    var m = document.getElementById('mk-modele').value, log = lire('samassa_campagnes'); log.push({ date: auj, tel: p.tel, modele: m, ts: new Date().toISOString() });
    try { localStorage.setItem('samassa_campagnes', JSON.stringify(log.slice(-2000))); } catch (x) {}
    window.open('https://wa.me/223' + p.tel + '?text=' + encodeURIComponent(rediger(MODELES[m], p, document.getElementById('mk-offre').value.trim())), '_blank'); rendre();
  });
  ['mk-modele', 'mk-offre'].forEach(function (id) { document.addEventListener('input', function (e) { if (e.target.id === id) rendre(); }); });
  if (document.readyState !== 'loading') rendre(); else document.addEventListener('DOMContentLoaded', rendre);
})();
