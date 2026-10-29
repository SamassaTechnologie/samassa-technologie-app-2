/* QR de vérification : chaque document généré reçoit un code signé que le client peut scanner. */
'use strict';
(function () {
  var cache = {};
  function chiffres(s) { return parseInt(String(s || '').replace(/\D/g, ''), 10) || 0; }
  function valeur(id) { var e = document.getElementById(id); return e ? (e.value !== undefined && e.tagName !== 'SPAN' && e.tagName !== 'DIV' ? e.value : e.textContent) : ''; }
  async function jeton() { try { if (window.Auth && Auth.idToken) return await Auth.idToken(); } catch (e) {} return null; }
  async function adresse(doc) {
    var k = [doc.type, doc.number, doc.total, doc.date].join('|'); if (cache[k]) return cache[k];
    var t = await jeton(); if (!t) return null;
    var r = await fetch('/api/sign-doc', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(doc), signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null; var d = await r.json(); if (!d.ok) return null; cache[k] = d.url; return d.url;
  }
  function zone() {
    var z = document.getElementById('d-verif'); if (z) return z;
    var pied = document.querySelector('.doc-footer') || document.getElementById('docInner'); if (!pied) return null;
    z = document.createElement('div'); z.id = 'd-verif'; z.style.cssText = 'display:none;text-align:center;margin:14px auto 0;page-break-inside:avoid';
    pied.appendChild(z); return z;
  }
  async function attacher(doc) {
    var z = zone(); if (!z) return;
    z.style.display = 'none';
    try {
      if (!doc.number || !doc.total || !/^\d{4}-\d{2}-\d{2}$/.test(doc.date) || typeof QRCode === 'undefined') return;
      var url = await adresse(doc); if (!url) return;
      z.innerHTML = '<div id="d-verif-qr" style="display:inline-block"></div><div style="font-size:10px;color:#64748B;margin-top:4px">Scannez pour vérifier l\'authenticité de ce document</div>';
      new QRCode(document.getElementById('d-verif-qr'), { text: url, width: 96, height: 96, colorDark: '#0F2137', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
      z.style.display = 'block';
    } catch (e) { z.style.display = 'none'; }
  }
  /* Enveloppe la fonction de génération d'une page */
  function brancher(c) {
    var f = window[c.fn]; if (typeof f !== 'function') return;
    window[c.fn] = function () {
      var r = f.apply(this, arguments);
      attacher({ type: c.type, number: String(valeur(c.number) || '').trim(), total: chiffres(valeur(c.total)), date: valeur(c.date) });
      return r;
    };
  }
  window.DocQR = { attacher: attacher, brancher: brancher, _chiffres: chiffres };
})();
