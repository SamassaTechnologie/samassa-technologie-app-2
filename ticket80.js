/* SAMASSA TECHNOLOGIE — Ticket de caisse 80 mm : aperçu, impression, image et envoi WhatsApp du reçu exact.
   Un seul modèle de lignes sert à l'écran (HTML) ET à l'image envoyée (canvas) : le reçu envoyé est identique. */
'use strict';
(function () {
  var F = function (n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' '); };
  /* Montant en lettres (français) : 10000 -> « dix mille francs CFA » */
  var U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  var D = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
  function sous100(n) {
    if (n < 20) return U[n];
    var d = Math.floor(n / 10), u = n % 10;
    if (d === 7 || d === 9) { var base = d === 7 ? 'soixante' : 'quatre-vingt', r = 10 + u; return base + (d === 7 && u === 1 ? ' et ' : '-') + U[r]; }
    if (d === 8) return u ? 'quatre-vingt-' + U[u] : 'quatre-vingts';
    return D[d] + (u === 1 ? ' et un' : u ? '-' + U[u] : '');
  }
  function sous1000(n, fin) {
    var c = Math.floor(n / 100), r = n % 100, t = '';
    if (c) t = (c > 1 ? U[c] + ' ' : '') + 'cent' + (c > 1 && !r && fin ? 's' : '');
    if (r) t += (t ? ' ' : '') + (r === 80 && !fin ? 'quatre-vingt' : sous100(r));
    return t;
  }
  function enLettres(n) {
    n = Math.round(Number(n) || 0); if (n < 0) return 'moins ' + enLettres(-n); if (n === 0) return 'zéro';
    var parts = [], noms = [['milliard', 1e9], ['million', 1e6]], t = [];
    noms.forEach(function (x) { var q = Math.floor(n / x[1]); if (q) { t.push(sous1000(q, true) + ' ' + x[0] + (q > 1 ? 's' : '')); n %= x[1]; } });
    var m = Math.floor(n / 1000), r = n % 1000;
    if (m) t.push(m === 1 ? 'mille' : sous1000(m, false) + ' mille');
    if (r) t.push(sous1000(r, true));
    return t.join(' ');
  }
  /* d : {societe:{nom,tel,email,adresse}, titre, numero, date, client, tel, piece:{label,num}, lignes:[{desc,qte,pu,total}], total, mode, note, rdv, qr:bool} */
  /* Présentation uniforme : « 77291931 / 62970630 » → « 77 29 19 31 / 62 97 06 30 », « 14/11/2026 » → « 14 novembre 2026 » */
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function telLisible(t) {
    return String(t || '').split('/').map(function (x) { var b = x.trim(), n = b.replace(/\D/g, ''); if (n.length === 13 && n.indexOf('00223') === 0) n = n.slice(5); else if (n.length === 11 && n.indexOf('223') === 0) n = n.slice(3); return n.length === 8 && /^[\d\s+().-]+$/.test(b) ? n.replace(/(\d\d)(?=\d)/g, '$1 ') : b; }).filter(Boolean).join(' / ');
  }
  function dateLisible(t) {
    var x = String(t || '').trim(), iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(x), fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(x);
    var j = iso ? iso[3] : fr ? fr[1] : 0, m = iso ? iso[2] : fr ? fr[2] : 0, a = iso ? iso[1] : fr ? fr[3] : 0;
    return j && MOIS[Number(m) - 1] ? Number(j) + ' ' + MOIS[Number(m) - 1] + ' ' + a : x;
  }
  function modele(d) {
    var L = [], s = d.societe || {};
    if (d.logo) L.push({ k: 'logo' });
    var kv = function (k, v) { if (v) L.push({ k: 'l', t: k + ' : ' + v }); };
    L.push({ k: 'c', t: String(s.nom || '').toUpperCase(), b: 1 });
    if (s.adresse) L.push({ k: 'c', t: s.adresse });
    if (s.tel) L.push({ k: 'c', t: 'Tél : ' + telLisible(s.tel) });
    if (s.email) L.push({ k: 'c', t: s.email });
    L.push({ k: 'sep' }, { k: 'c', t: d.titre || 'REÇU DE PAIEMENT', b: 1 }, { k: 'sep' });
    kv('Reçu', d.numero); kv('Date', d.date ? dateLisible(d.date) + (d.heure ? ' à ' + d.heure : '') : ''); (d.avant || []).forEach(function (x) { kv(x[0], x[1]); }); kv('Client', d.client); kv('Tél', telLisible(d.tel));
    if (d.piece && d.piece.num) kv(d.piece.label || 'Pièce', d.piece.num);
    L.push({ k: 'sep' });
    (d.lignes || []).forEach(function (x) {
      L.push({ k: 'l', t: x.desc || '—' });
      L.push({ k: 'r', t: x.qte + ' x ' + F(x.pu) + ' = ' + F(x.total) + ' F' });
    });
    L.push({ k: 'sep' }, { k: 'lr', l: 'MONTANT', r: F(d.total) + ' FCFA', b: 1 });
    if (d.total) L.push({ k: 'l', t: 'Arrêté à : ' + enLettres(d.total) + ' francs CFA' });
    kv('Mode', d.mode);
    (d.apres || []).forEach(function (x) { kv(x[0], x[1]); });
    if (d.rdv) kv('Retrait prévu', d.rdv);
    if (d.note) L.push({ k: 'l', t: 'Note : ' + d.note });
    L.push({ k: 'sep' });
    if (d.qr) L.push({ k: 'qr' }, { k: 'c', t: 'Scannez pour vérifier ce reçu', s: 1 });
    L.push({ k: 'c', t: 'Merci de votre confiance', b: 1 });
    return L;
  }
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function html(L) {
    return L.map(function (x) {
      switch (x.k) {
        case 'c': return '<div class="t-c' + (x.b ? ' t-b' : '') + (x.s ? ' t-s' : '') + '">' + esc(x.t) + '</div>';
        case 'l': return '<div class="t-l">' + esc(x.t) + '</div>';
        case 'r': return '<div class="t-r">' + esc(x.t) + '</div>';
        case 'lr': return '<div class="t-lr' + (x.b ? ' t-b t-big' : '') + '"><span>' + esc(x.l) + '</span><span>' + esc(x.r) + '</span></div>';
        case 'sep': return '<div class="t-sep"></div>';
        case 'qr': return '<div class="t-qr"></div>';
        case 'logo': return '<div class="t-logo"><img src="logo.png" alt=""></div>';
      }
      return '';
    }).join('');
  }
  /* Dessin sur canvas (image envoyée). qrCanvas : canvas du QR ou null. Retourne le canvas. */
  function dessiner(L, qrCanvas, logo) {
    var logoOk = !!(logo && logo.complete && logo.naturalWidth);
    var W = 576, P = 28, S = 2, FS = 22, LH = 30, mono = '"Courier New",Courier,monospace', y = P, ops = [];
    var m = document.createElement('canvas').getContext('2d');
    var police = function (b, size) { return (b ? 'bold ' : '') + (size || FS) + 'px ' + mono; };
    var coupe = function (t, b, size, max) {
      m.font = police(b, size); var out = [], ligne = '';
      String(t).split(/(\s+)/).forEach(function (w) {
        if (m.measureText(ligne + w).width > max && ligne.trim()) { out.push(ligne.trim()); ligne = w.trim(); } else ligne += w;
      });
      if (ligne.trim()) out.push(ligne.trim()); return out.length ? out : [''];
    };
    L.forEach(function (x) {
      if (x.k === 'logo') { if (logoOk) { ops.push({ t: 'logo', y: y }); y += 112; } }
      else if (x.k === 'sep') { ops.push({ t: 'sep', y: y + LH / 2 }); y += LH; }
      else if (x.k === 'c') { var sz = x.s ? 19 : FS; coupe(x.t, x.b, sz, W - 2 * P).forEach(function (l) { ops.push({ t: 'txt', a: 'c', s: l, b: x.b, z: sz, y: y }); y += LH; }); }
      else if (x.k === 'l') { coupe(x.t, 0, FS, W - 2 * P).forEach(function (l) { ops.push({ t: 'txt', a: 'l', s: l, y: y }); y += LH; }); }
      else if (x.k === 'r') { ops.push({ t: 'txt', a: 'r', s: x.t, y: y }); y += LH + 4; }
      else if (x.k === 'lr') { var z = x.b ? 26 : FS; ops.push({ t: 'lr', l: x.l, r: x.r, b: x.b, z: z, y: y }); y += LH + 6; }
      else if (x.k === 'qr') { if (qrCanvas) { ops.push({ t: 'qr', y: y + 6 }); y += 200 + 18; } }
    });
    y += P - 6;
    var c = document.createElement('canvas'); c.width = W * S; c.height = Math.ceil(y) * S;
    var g = c.getContext('2d'); g.scale(S, S); g.fillStyle = '#fff'; g.fillRect(0, 0, W, y); g.fillStyle = '#000'; g.textBaseline = 'top';
    ops.forEach(function (o) {
      if (o.t === 'sep') { g.save(); g.setLineDash([6, 5]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(P, o.y); g.lineTo(W - P, o.y); g.stroke(); g.restore(); }
      else if (o.t === 'txt') { g.font = police(o.b, o.z); g.textAlign = o.a === 'c' ? 'center' : o.a === 'r' ? 'right' : 'left'; g.fillText(o.s, o.a === 'c' ? W / 2 : o.a === 'r' ? W - P : P, o.y); }
      else if (o.t === 'lr') { g.font = police(o.b, o.z); g.textAlign = 'left'; g.fillText(o.l, P, o.y); g.textAlign = 'right'; g.fillText(o.r, W - P, o.y); }
      else if (o.t === 'qr') { g.drawImage(qrCanvas, (W - 200) / 2, o.y, 200, 200); }
      else if (o.t === 'logo') { var lh = 100, lw = Math.min(W - 2 * P, lh * logo.naturalWidth / logo.naturalHeight); g.drawImage(logo, (W - lw) / 2, o.y, lw, lh); }
    });
    return c;
  }
  
  /* ===== Intégration : Ticket80.brancher({generer, partager, type, lire}) =====
     lire() renvoie les données du modèle + _iso (date AAAA-MM-JJ) ; generer/partager = noms des fonctions globales de la page */
  var injecte = false;
  function styles() {
    if (injecte || typeof document === 'undefined') return; injecte = true; var css = document.createElement('style');
    css.textContent = '.doc-inner.is-t80>.doc-z,.doc-inner.is-t80>.watermark{display:none!important}.doc-inner.is-t80{background:transparent;padding:10px 0}' +
      '.t80{width:302px;max-width:100%;margin:0 auto;background:#fff;color:#000;font:13px/1.45 "Courier New",Courier,monospace;padding:16px 14px;box-shadow:0 2px 14px rgba(0,0,0,.18);box-sizing:border-box}' +
      '.t80 .t-c{text-align:center;word-break:break-word}.t80 .t-b{font-weight:700}.t80 .t-s{font-size:11px}.t80 .t-l{word-break:break-word}.t80 .t-r{text-align:right;margin-bottom:3px}' +
      '.t80 .t-lr{display:flex;justify-content:space-between;gap:8px;margin:3px 0}.t80 .t-big{font-size:15px}.t80 .t-sep{border-top:1.5px dashed #000;margin:7px 0}.t80-avis{max-width:302px;margin:10px auto 0;background:#FEF3C7;border:1px solid #FCD34D;color:#78350F;border-radius:10px;padding:9px 11px;font:600 12px/1.4 system-ui,sans-serif}@media print{.t80-avis{display:none!important}}.t80 .t-logo{text-align:center;margin-bottom:4px}.t80 .t-logo img{height:54px;max-width:70%;object-fit:contain}.t80 .t-qr{display:flex;justify-content:center;margin:8px 0 3px;min-height:20px}.t80 .t-qr canvas,.t80 .t-qr img{width:120px!important;height:120px!important}' +
      '@media print{@page{size:auto;margin:0}html,body{width:80mm}.doc-inner.is-t80{padding:0!important;width:80mm!important}.t80{width:80mm;box-shadow:none;padding:4mm 4mm 8mm;font-size:12px}.t80 .t-qr canvas,.t80 .t-qr img{width:34mm!important;height:34mm!important}.t80 .t-logo img{height:14mm}}';
    document.head.appendChild(css);
  }
  var numWa = function (t) { var n = String(t || '').replace(/\D/g, ''); if (n.length === 8) n = '223' + n; return n; };
  var avis = function (m, t) { if (window.ST && ST.toast) ST.toast(m, t); else alert(m); };
  function brancher(cfg) {
    if (typeof document === 'undefined' || !document.getElementById('docInner') || typeof window[cfg.generer] !== 'function') return;
    styles();
    var logoImg = new Image(); logoImg.src = 'logo.png';
    var dernier = { id: 0, pret: Promise.resolve(null), blob: null, d: null }, genBase = window[cfg.generer];
    window[cfg.generer] = function () {
      var r = genBase.apply(this, arguments), di = document.getElementById('docInner');
      try {
        var d = cfg.lire(); d.qr = false; d.logo = true; if (!d.heure) { var hh = new Date(); d.heure = String(hh.getHours()).padStart(2, '0') + ':' + String(hh.getMinutes()).padStart(2, '0'); } dernier.d = d; dernier.blob = null;
        var old = document.getElementById('t80'); if (old) old.remove(); var oa = document.getElementById('t80-avis'); if (oa) oa.remove();
        var box = document.createElement('div'); box.id = 't80'; box.className = 't80'; box.innerHTML = html(modele(d)); di.classList.add('is-t80'); di.appendChild(box);
        var id = ++dernier.id;
        dernier.pret = (async function () {
          var url = null; try { if (window.DocQR && DocQR.adresse && typeof QRCode !== 'undefined' && d.numero && d.total) url = await DocQR.adresse({ type: cfg.type, number: d.numero, total: Math.round(d.total), date: d._iso }); } catch (e) {}
          if (id !== dernier.id) return null;
          var qc = null, tmp = null;
          if (url) {
            tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-999px;top:0'; document.body.appendChild(tmp);
            new QRCode(tmp, { text: url, width: 400, height: 400, colorDark: '#000000', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
            qc = tmp.querySelector('canvas'); d.qr = !!qc;
          }
          var m = modele(d); box.innerHTML = html(m);
          /* Reçu sans QR : on dit pourquoi (ce message n'est ni imprimé ni envoyé) */
          var av = document.getElementById('t80-avis'); if (av) av.remove();
          if (!d.qr) { av = document.createElement('div'); av.id = 't80-avis'; av.className = 't80-avis'; av.textContent = '⚠️ Reçu sans QR de vérification : ' + (!(Number(d.total) > 0) ? 'renseignez le montant puis régénérez.' : !d.numero ? 'renseignez le numéro du reçu puis régénérez.' : !navigator.onLine ? 'pas de connexion internet. Régénérez une fois connecté.' : 'la signature a échoué. Reconnectez-vous à l\'application puis régénérez.'); box.insertAdjacentElement('afterend', av); }
          if (qc) { var z = box.querySelector('.t-qr'); if (z) { var cp = document.createElement('canvas'); cp.width = cp.height = 400; cp.getContext('2d').drawImage(qc, 0, 0); z.appendChild(cp); } }
          if (!logoImg.complete) await new Promise(function (ok) { logoImg.onload = logoImg.onerror = ok; setTimeout(ok, 1500); });
          var cv = dessiner(m, qc, logoImg); if (tmp) tmp.remove();
          return new Promise(function (res) { cv.toBlob(function (b) { dernier.blob = b; res(b); }, 'image/png'); });
        })();
      } catch (e) { console.error('Ticket 80 mm :', e); }
      return r;
    };
    window[cfg.partager] = async function () {
      var di = document.getElementById('docInner'); if (di.style.display === 'none' || !document.getElementById('t80')) window[cfg.generer]();
      var d0 = dernier.d, num = numWa(d0 && d0.tel), avecNum = num.length >= 9;
      /* Numéro renseigné : on copie l'image (geste tactile conservé grâce à la promesse) puis on ouvre directement la conversation avec ce numéro */
      var copie = null;
      if (avecNum && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        try { copie = navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(dernier.blob || dernier.pret) })]); } catch (e) { copie = null; }
      }
      var blob = dernier.blob || await dernier.pret; if (!blob) { avis('Impossible de préparer le reçu.', 'error'); return; }
      var d = dernier.d, nom = (cfg.prefixe || 'recu') + '-' + (d.numero || 'samassa') + '.png', file = new File([blob], nom, { type: 'image/png' }), texte = (d.titre || 'Reçu') + ' N° ' + d.numero + ' — ' + d.societe.nom;
      if (avecNum) {
        var copie_ok = false; if (copie) { try { await copie; copie_ok = true; } catch (e) {} }
        if (!copie_ok) { var a0 = document.createElement('a'); a0.href = URL.createObjectURL(blob); a0.download = nom; a0.click(); setTimeout(function () { URL.revokeObjectURL(a0.href); }, 5000); }
        avis(copie_ok ? 'Image copiée ✅ — dans WhatsApp, appuyez longuement sur le message puis « Coller » et envoyez.' : 'Image enregistrée — joignez-la dans la conversation WhatsApp 📎', 'success');
        setTimeout(function () { window.location.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent('Bonjour, voici votre ' + texte); }, 900);
        return;
      }
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texte }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      window.open('https://wa.me/?text=' + encodeURIComponent('Bonjour, voici votre ' + texte), '_blank');
      avis('Image du reçu téléchargée : joignez-la dans la conversation WhatsApp 📎', 'success');
    };
  }
  window.Ticket80 = { telLisible: telLisible, dateLisible: dateLisible, modele: modele, html: html, dessiner: dessiner, F: F, enLettres: enLettres, brancher: brancher };
})();
