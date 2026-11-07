/* SAMASSA PRO — fonctions d'application moderne : bandeau hors-ligne, « nouvelle version prête », pastille sur l'icône */
'use strict';
(function () {
  var bande = null;
  function afficher(id, texte, bouton, action, couleur) {
    var b = document.getElementById(id); if (b) b.remove();
    b = document.createElement('div'); b.id = id; b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:' + (id === 'am-offline' ? '8px' : '48px') + ';z-index:99999;max-width:92vw;background:' + couleur + ';color:#fff;border-radius:99px;padding:8px 14px;font:700 12px/1.3 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);display:flex;gap:10px;align-items:center';
    var t = document.createElement('span'); t.textContent = texte; b.appendChild(t);
    if (bouton) { var k = document.createElement('button'); k.type = 'button'; k.textContent = bouton; k.style.cssText = 'border:0;border-radius:99px;padding:5px 11px;font:800 12px system-ui;background:#fff;color:#0A1628;cursor:pointer'; k.onclick = action; b.appendChild(k); }
    document.body.appendChild(b); return b;
  }
  /* 1. Hors-ligne */
  function reseau() {
    var el = document.getElementById('am-offline');
    if (!navigator.onLine) afficher('am-offline', '📵 Hors ligne — vos saisies restent enregistrées sur cet appareil', null, null, '#475569');
    else if (el) { el.remove(); var ok = afficher('am-offline', '✅ Connexion rétablie', null, null, '#15803D'); setTimeout(function () { ok.remove(); }, 2500); }
  }
  window.addEventListener('offline', reseau); window.addEventListener('online', reseau);
  /* 2. Nouvelle version prête */
  if ('serviceWorker' in navigator) {
    var avait = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!avait) { avait = true; return; }
      afficher('am-maj', '🔄 Nouvelle version de SAMASSA PRO prête', 'Actualiser', function () { location.reload(); }, '#0877B9');
    });
  }
  /* 3. Pastille sur l'icône de l'application (RDV arrivés + articles à réapprovisionner) */
  function liste(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function pastille() {
    if (!('setAppBadge' in navigator) || window.RappelsJour && document.getElementById('rj-carte') !== null) return;
    var auj = new Date().toISOString().slice(0, 10), rdv = liste('samassa_recus').filter(function (r) { return r && !r.retrieved && r.rdvDate && String(r.rdvDate).slice(0, 10) <= auj; }).length;
    var bas = liste('samassa_stock_v2').filter(function (a) { return a && Number(a.min) > 0 && Number(a.qty) <= Number(a.min); }).length, n = rdv + bas;
    try { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(function () {}); } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function () { if (!navigator.onLine) reseau(); pastille(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) pastille(); });
  window.AppModerne = { pastille: pastille };
})();
