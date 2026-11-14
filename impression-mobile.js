/* SAMASSA PRO — Impression sur iPhone / application installée.
   Dans l'application installée, window.print() ne répond pas et une page ouverte à part n'a pas de bouton retour.
   Ici : le document est transformé en PDF dans la page, puis remis à la feuille de partage d'iOS
   (Imprimer, Enregistrer dans Fichiers, WhatsApp…). Un panneau avec « Fermer » reste toujours disponible. */
'use strict';
(function (root) {
  /* ---------- Fonctions pures (testées) ---------- */
  /* Positions de coupe d'une image haute en pages : on remonte jusqu'à une ligne « vide » pour ne pas couper un texte.
     vide(y) -> true si la ligne y de l'image est blanche. */
  function coupes(hauteur, hPage, vide, marge) {
    var out = [], y = 0; marge = marge == null ? Math.round(hPage * 0.12) : marge;
    while (hauteur - y > hPage) {
      var c = y + hPage, k = c;
      if (vide) { while (k > c - marge && !vide(k)) k--; if (k <= c - marge) k = c; }
      out.push(k); y = k;
    }
    out.push(hauteur); return out;
  }
  function ascii(s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
  /* PDF minimal : une image JPEG par page. pages = [{jpeg:Uint8Array, wPx, hPx, wPt, hPt}] */
  function pdf(pages) {
    var parts = [], pos = 0, offs = [];
    function put(x) { var b = typeof x === 'string' ? ascii(x) : x; parts.push(b); pos += b.length; }
    function obj(n, corps, flux) { offs[n] = pos; put(n + ' 0 obj\n' + corps + '\n'); if (flux) { put('stream\n'); put(flux); put('\nendstream\n'); } put('endobj\n'); }
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    var n = pages.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>');
    pages.forEach(function (p, i) {
      var a = 3 + i * 3, wImg = p.wImgPt || p.wPt, hImg = wImg * p.hPx / p.wPx, c = 'q ' + wImg.toFixed(2) + ' 0 0 ' + hImg.toFixed(2) + ' ' + ((p.wPt - wImg) / 2).toFixed(2) + ' ' + (p.hPt - hImg).toFixed(2) + ' cm /Im0 Do Q';
      obj(a, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + p.wPt.toFixed(2) + ' ' + p.hPt.toFixed(2) + '] /Resources << /XObject << /Im0 ' + (a + 2) + ' 0 R >> >> /Contents ' + (a + 1) + ' 0 R >>');
      obj(a + 1, '<< /Length ' + c.length + ' >>', ascii(c));
      obj(a + 2, '<< /Type /XObject /Subtype /Image /Width ' + p.wPx + ' /Height ' + p.hPx + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>', p.jpeg);
    });
    var total = 3 + n * 3, x = pos, t = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var k = 1; k < total; k++) t += String(offs[k]).padStart(10, '0') + ' 00000 n \n';
    put(t + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n');
    var out = new Uint8Array(pos), o = 0; parts.forEach(function (b) { out.set(b, o); o += b.length; }); return out;
  }
  function nomFichier(titre) { return (String(titre || 'document').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document') + '.pdf'; }
  root.ImpressionMobile = { coupes: coupes, pdf: pdf, nomFichier: nomFichier };
  if (typeof document === 'undefined') return;

  var MM = 72 / 25.4;
  function besoin() {
    var ua = navigator.userAgent || '', ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function charger(src) { return new Promise(function (ok, ko) { if (window.html2canvas) return ok(); var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('outil de rendu indisponible')); }; document.head.appendChild(s); }); }
  function jpeg(canvas) { return new Promise(function (ok, ko) { canvas.toBlob(function (b) { if (!b) return ko(new Error('image vide')); b.arrayBuffer().then(function (a) { ok(new Uint8Array(a)); }, ko); }, 'image/jpeg', 0.9); }); }
  /* Canvas → PDF. largeurMm = 210 (A4, plusieurs pages) ou 80 (ticket, une seule page à la hauteur du reçu) */
  async function canvasVersPdf(cv, largeurMm) {
    var wPt = largeurMm * MM, pages = [];
    if (largeurMm < 150) { pages.push({ jpeg: await jpeg(cv), wPx: cv.width, hPx: cv.height, wPt: wPt, hPt: wPt * cv.height / cv.width }); return pdf(pages); }
    var hPt = 297 * MM, hPage = Math.floor(cv.width * 297 / 210), g = cv.getContext('2d');
    var vide = function (y) { try { var d = g.getImageData(0, y, cv.width, 1).data; for (var i = 0; i < d.length; i += 16) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return false; return true; } catch (e) { return true; } };
    /* Dépassement léger (jusqu'à 15 %) : on réduit pour tenir sur une seule feuille plutôt que d'en entamer une seconde */
    if (cv.height > hPage && cv.height <= hPage * 1.15) { pages.push({ jpeg: await jpeg(cv), wPx: cv.width, hPx: cv.height, wPt: wPt, hPt: hPt, wImgPt: wPt * hPage / cv.height }); return pdf(pages); }
    var c = coupes(cv.height, hPage, vide), y0 = 0;
    for (var i = 0; i < c.length; i++) {
      var h = c[i] - y0; if (h <= 2 && i) break;
      var t = document.createElement('canvas'); t.width = cv.width; t.height = h; var tg = t.getContext('2d'); tg.fillStyle = '#fff'; tg.fillRect(0, 0, t.width, h); tg.drawImage(cv, 0, y0, cv.width, h, 0, 0, cv.width, h);
      pages.push({ jpeg: await jpeg(t), wPx: t.width, hPx: h, wPt: wPt, hPt: hPt }); y0 = c[i];
    }
    return pdf(pages);
  }
  async function rendre(o) {
    if (o.image) {   /* ticket : l'image exacte déjà préparée pour WhatsApp */
      var blob = await o.image; if (blob) { var bmp = await new Promise(function (ok, ko) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = ko; im.src = URL.createObjectURL(blob); }); var c0 = document.createElement('canvas'); c0.width = bmp.naturalWidth; c0.height = bmp.naturalHeight; var g0 = c0.getContext('2d'); g0.fillStyle = '#fff'; g0.fillRect(0, 0, c0.width, c0.height); g0.drawImage(bmp, 0, 0); return canvasVersPdf(c0, 80); }
    }
    await charger(o.html2canvas || 'html2canvas.min.js');
    var a4 = (o.largeurMm || 210) >= 150, L = a4 ? 794 : 302;
    var cv = await window.html2canvas(o.source, {
      scale: a4 ? 2 : 3, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: a4 ? 1200 : window.innerWidth, scrollX: 0, scrollY: 0,
      onclone: function (doc, el) {   /* le document seul, à la largeur d'une feuille, avec la mise en page « grand écran » */
        doc.body.innerHTML = ''; doc.body.appendChild(el); doc.documentElement.removeAttribute('data-theme');
        doc.body.style.cssText = 'margin:0;padding:0;background:#fff;width:' + L + 'px;overflow:visible';
        el.hidden = false; el.style.cssText += ';display:block;width:' + L + 'px;max-width:none;margin:0;box-shadow:none;border:0;border-radius:0;background:#fff;' + (a4 ? 'padding:38px;box-sizing:border-box;' : '');
        el.querySelectorAll('.mj-glisser, .t80-avis, .no-print').forEach(function (x) { x.remove(); });
      }
    });
    return canvasVersPdf(cv, a4 ? 210 : 80);
  }
  var css = null;
  function panneau() {
    if (!css) { css = document.createElement('style'); css.textContent = '#im-voile{position:fixed;inset:0;z-index:99999;background:rgba(10,22,40,.55);display:flex;align-items:flex-end;justify-content:center}#im-carte{background:#fff;color:#0A1628;width:100%;max-width:520px;border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));font:15px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 -8px 30px rgba(0,0,0,.3)}#im-carte h3{margin:0 0 6px;font-size:17px}#im-carte p{margin:0 0 12px;color:#475569;font-size:13.5px}#im-carte button{display:block;width:100%;border:0;border-radius:12px;padding:14px;font:inherit;font-weight:700;margin-top:8px;min-height:48px;cursor:pointer}#im-go{background:#16A34A;color:#fff}#im-go:disabled{background:#94A3B8}#im-dl{background:#0877B9;color:#fff}#im-dir{background:#E2E8F0;color:#0A1628}#im-x{background:none;color:#DC2626}@media print{#im-voile{display:none!important}}'; document.head.appendChild(css); }
    var v = document.getElementById('im-voile'); if (v) v.remove();
    v = document.createElement('div'); v.id = 'im-voile'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true');
    v.innerHTML = '<div id="im-carte"><h3>🖨️ Imprimer le document</h3><p id="im-msg">Préparation du PDF…</p><button id="im-go" disabled>Préparation…</button><button id="im-dl" hidden>⬇️ Télécharger le PDF</button><button id="im-dir">Essayer l\'impression directe</button><button id="im-x">✕ Fermer</button></div>';
    document.body.appendChild(v);
    var fermer = function () { v.remove(); };
    v.querySelector('#im-x').onclick = fermer; v.addEventListener('click', function (e) { if (e.target === v) fermer(); });
    v.querySelector('#im-dir').onclick = function () { fermer(); setTimeout(function () { try { window.print(); } catch (e) {} }, 60); };
    return v;
  }
  /* o = {source: élément, titre, largeurMm, image: Promise<Blob>|null} */
  function ouvrir(o) {
    var v = panneau(), msg = v.querySelector('#im-msg'), go = v.querySelector('#im-go'), dl = v.querySelector('#im-dl'), nom = nomFichier(o.titre);
    rendre(o).then(function (octets) {
      if (!document.body.contains(v)) return;
      var blob = new Blob([octets], { type: 'application/pdf' }), fichier = null; try { fichier = new File([blob], nom, { type: 'application/pdf' }); } catch (e) {}
      var partage = !!(fichier && navigator.canShare && navigator.canShare({ files: [fichier] }));
      var telecharger = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 20000); };
      dl.hidden = false; dl.onclick = telecharger;
      if (partage) {
        msg.textContent = 'Le PDF est prêt. Touchez le bouton vert, puis choisissez « Imprimer » dans la liste (ou « Enregistrer dans Fichiers », WhatsApp…).';
        go.disabled = false; go.textContent = '🖨️ Imprimer / Partager le PDF';
        go.onclick = function () { navigator.share({ files: [fichier], title: o.titre || 'Document' }).then(function () { v.remove(); }).catch(function (e) { if (!e || e.name !== 'AbortError') msg.textContent = 'Le partage a échoué. Utilisez « Télécharger le PDF ».'; }); };
      } else { msg.textContent = 'Le PDF est prêt. Téléchargez-le, puis ouvrez-le pour l\'imprimer.'; go.hidden = true; }
    }).catch(function (e) {
      if (!document.body.contains(v)) return;
      msg.textContent = 'Le PDF n\'a pas pu être préparé (' + (e && e.message || 'erreur') + '). Essayez l\'impression directe, ou fermez et réessayez.'; go.hidden = true;
    });
    return v;
  }
  root.ImpressionMobile.besoin = besoin; root.ImpressionMobile.ouvrir = ouvrir; root.ImpressionMobile.rendre = rendre;
})(typeof window !== 'undefined' ? window : globalThis);
