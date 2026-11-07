/* SAMASSA TECHNOLOGIE — Photos d'identité : cadrage, fond blanc, planche d'impression */
'use strict';
(function () {
  var P = window.PhotoFormats, $ = function (id) { return document.getElementById(id); };
  if (!P || !$('cv')) return;
  var img = null, S = { zoom: 1, dx: 0, dy: 0, rot: 0 }, fmt = P.FORMATS[1], PPM_PREVIEW = 9, DPI = 600;
  var msg = function (t, c) { $('msg').textContent = t || ''; $('msg').style.color = c === 'err' ? '#B91C1C' : c === 'ok' ? '#166534' : '#475569'; };
  var ppm = function (dpi) { return dpi / 25.4; };

  /* ---- Formats ---- */
  function libelle(f) { return f.pays + ' — ' + f.doc + ' (' + f.w + '×' + f.h + ' mm)'; }
  var nrm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  function remplirFormats() {
    var q = nrm($('rech').value).replace(/\s+/g, ' ').trim(), sel = $('fmt'), cur = fmt.id; sel.textContent = '';
    var liste = P.FORMATS.filter(function (f) { return !q || nrm(libelle(f) + ' ' + f.code).indexOf(q) >= 0 || nrm(libelle(f)).replace(/ /g, '').indexOf(q.replace(/ /g, '')) >= 0; });
    liste.forEach(function (f) { var o = document.createElement('option'); o.value = f.id; o.textContent = libelle(f); if (f.id === cur) o.selected = true; sel.appendChild(o); });
    if (!liste.length) { var o = document.createElement('option'); o.textContent = 'Aucun résultat'; o.disabled = true; sel.appendChild(o); }
    sel.size = q ? Math.min(6, Math.max(2, liste.length)) : 1;
  }
  function majInfo() {
    var f = fmt, h = f.h, i = $('infoFmt'), tp = Math.round(f.teteMin / h * 100) + '–' + Math.round(f.teteMax / h * 100);
    i.className = 'info ' + (f.verifie ? 'ok' : 'w');
    i.textContent = '';
    var b = document.createElement('b'); b.textContent = f.pays + ' · ' + f.doc; i.appendChild(b);
    i.appendChild(document.createElement('br'));
    i.appendChild(document.createTextNode('Taille : ' + f.w + ' × ' + f.h + ' mm · Tête : ' + f.teteMin + '–' + f.teteMax + ' mm (' + tp + ' % de la hauteur) · Fond : ' + f.fond + '. '));
    i.appendChild(document.createTextNode(f.verifie ? 'Dimensions conformes aux sources consultées ; vérifiez toujours les consignes officielles à jour.' : 'Norme internationale courante (ICAO) : confirmez la taille exacte auprès de l\'autorité émettrice (ambassade, mairie, service d\'état civil…).'));
  }

  /* ---- Rendu ---- */
  function rendre(ppmv, canvas) {
    var W = Math.round(fmt.w * ppmv), H = Math.round(fmt.h * ppmv), c = canvas || document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    if (!img) return c;
    var iw = img.width, ih = img.height, s = Math.max(W / iw, H / ih) * S.zoom;
    g.save(); g.translate(W / 2 + S.dx * W, H / 2 + S.dy * H); g.rotate(S.rot * Math.PI / 180); g.scale(s, s); g.drawImage(img, -iw / 2, -ih / 2); g.restore();
    var lum = +$('lum').value, con = +$('con').value, fond = $('fondOn').checked, tol = +$('fondTol').value;
    if (lum || con !== 1 || fond) {
      var d = g.getImageData(0, 0, W, H), p = d.data, bg = null;
      if (fond) { /* couleur du fond = moyenne de petits carrés dans les 4 coins */
        var k = Math.max(3, Math.round(Math.min(W, H) * .04)), tot = [0, 0, 0], n = 0;
        [[0, 0], [W - k, 0], [0, k], [W - k, k]].forEach(function (o) { for (var y = o[1]; y < o[1] + k; y++) for (var x = o[0]; x < o[0] + k; x++) { var j = (y * W + x) * 4; tot[0] += p[j]; tot[1] += p[j + 1]; tot[2] += p[j + 2]; n++; } });
        bg = [tot[0] / n, tot[1] / n, tot[2] / n];
      }
      for (var i = 0; i < p.length; i += 4) {
        var r = p[i], gg = p[i + 1], b = p[i + 2];
        if (bg) { var dr = r - bg[0], dg = gg - bg[1], db = b - bg[2], dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist < tol) { r = gg = b = 255; } else if (dist < tol * 1.5) { var t = (dist - tol) / (tol * .5); r = 255 + (r - 255) * t; gg = 255 + (gg - 255) * t; b = 255 + (b - 255) * t; } }
        p[i] = Math.max(0, Math.min(255, (r - 128) * con + 128 + lum)); p[i + 1] = Math.max(0, Math.min(255, (gg - 128) * con + 128 + lum)); p[i + 2] = Math.max(0, Math.min(255, (b - 128) * con + 128 + lum));
      }
      g.putImageData(d, 0, 0);
    }
    return c;
  }
  function guide() {
    var svg = $('guide'), cv = $('cv'), on = $('guideOn').checked; svg.textContent = ''; if (!on) return;
    var W = cv.width, H = cv.height; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var tete = (fmt.teteMin + fmt.teteMax) / 2 * PPM_PREVIEW, top = (H - tete) * .42, rx = tete * .36, cy = top + tete / 2, NS = 'http://www.w3.org/2000/svg';
    var mk = function (n, a) { var e = document.createElementNS(NS, n); Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); svg.appendChild(e); };
    mk('ellipse', { cx: W / 2, cy: cy, rx: rx, ry: tete / 2, fill: 'none', stroke: '#16A34A', 'stroke-width': 2, 'stroke-dasharray': '6 4' });
    mk('line', { x1: W / 2, y1: 0, x2: W / 2, y2: H, stroke: 'rgba(22,163,74,.45)', 'stroke-width': 1, 'stroke-dasharray': '3 5' });
    mk('line', { x1: 0, y1: top + tete * .42, x2: W, y2: top + tete * .42, stroke: 'rgba(22,163,74,.45)', 'stroke-width': 1, 'stroke-dasharray': '3 5' });
  }
  var attente = 0;
  function maj() {
    rendre(PPM_PREVIEW, $('cv')); guide();
    var on = !!img; ['bImp', 'bDl', 'bOne', 'bWa', 'bCaisse'].forEach(function (id) { $(id).disabled = !on; });
    cancelAnimationFrame(attente); attente = requestAnimationFrame(planchePreview);
  }
  function feuille() { return P.FEUILLES[$('feuille').value]; }
  function disposition() { var f = feuille(); return P.grille(f.w, f.h, fmt.w, fmt.h, 4, 2); }
  function planche(dpi) {
    var g = disposition(), n = Math.max(1, Math.min(+$('nb').value || g.n, g.n)), p = ppm(dpi), W = Math.round(g.w * p), H = Math.round(g.h * p), c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    var ph = rendre(p), pw = Math.round(g.pw * p), phh = Math.round(g.ph * p), gap = 2 * p, tw = g.cols * pw + (g.cols - 1) * gap, th = g.rows * phh + (g.rows - 1) * gap, ox = (W - tw) / 2, oy = (H - th) / 2, k = 0;
    for (var r = 0; r < g.rows && k < n; r++) for (var q = 0; q < g.cols && k < n; q++, k++) {
      var px = Math.round(ox + q * (pw + gap)), py = Math.round(oy + r * (phh + gap));
      if (g.tourne) { x.save(); x.translate(px, py); x.translate(pw / 2, phh / 2); x.rotate(Math.PI / 2); x.drawImage(ph, -phh / 2, -pw / 2, phh, pw); x.restore(); } else x.drawImage(ph, px, py, pw, phh);
      x.strokeStyle = '#C8CDD3'; x.lineWidth = Math.max(1, p * .15); x.strokeRect(px + .5, py + .5, pw - 1, phh - 1);
    }
    return { canvas: c, n: n, g: g };
  }
  function planchePreview() {
    var g = disposition(), nb = $('nb'); nb.max = g.n;
    $('infoGrille').textContent = g.n + ' photo(s) maximum sur cette feuille' + (g.tourne ? ' (photos tournées)' : '') + (g.paysage ? ' (feuille en paysage)' : '') + '.';
    if (+nb.value > g.n || !nb.dataset.touche) nb.value = g.n;
    var r = planche(100), sc = $('sheet'); sc.width = r.canvas.width; sc.height = r.canvas.height; sc.style.width = Math.min(360, r.canvas.width * 1.2) + 'px'; sc.getContext('2d').drawImage(r.canvas, 0, 0);
  }

  /* ---- Entrées ---- */
  function charger(file) {
    if (!file) return; if (!/^image\//.test(file.type) || file.size > 30 * 1024 * 1024) { msg('Choisissez une image de 30 Mo maximum.', 'err'); return; }
    var u = URL.createObjectURL(file), i = new Image();
    i.onload = function () {
      URL.revokeObjectURL(u); var r = Math.min(1, 3200 / Math.max(i.naturalWidth, i.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(i.naturalWidth * r); c.height = Math.round(i.naturalHeight * r); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
      img = c; reinit(); msg('Photo chargée. Cadrez le visage dans l\'ovale vert.', 'ok'); auto(true);
    };
    i.onerror = function () { URL.revokeObjectURL(u); msg('Image illisible.', 'err'); }; i.src = u;
  }
  function reinit() { S = { zoom: 1, dx: 0, dy: 0, rot: 0 }; $('zoom').value = 1; $('rot').value = 0; maj(); }
  async function auto(silencieux) {
    if (!img) return;
    if (!('FaceDetector' in window)) { if (!silencieux) msg('La détection du visage n\'est pas disponible sur ce navigateur : cadrez à la main (glisser + zoom).', 'err'); return; }
    try {
      var faces = await new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }).detect(img); if (!faces.length) { if (!silencieux) msg('Aucun visage détecté.', 'err'); return; }
      var b = faces[0].boundingBox, W = fmt.w * PPM_PREVIEW, H = fmt.h * PPM_PREVIEW, iw = img.width, ih = img.height, s0 = Math.max(W / iw, H / ih), tete = (fmt.teteMin + fmt.teteMax) / 2 * PPM_PREVIEW;
      var s = tete / (b.height * 1.3), zoom = Math.max(1, Math.min(4, s / s0)); s = s0 * zoom;
      var cx = b.x + b.width / 2, cy = b.y + b.height / 2, top = (H - tete) * .42, ty = top + tete * .5;
      S.zoom = zoom; S.rot = 0; S.dx = -(cx - iw / 2) * s / W; S.dy = (ty - H / 2 - (cy - ih / 2) * s) / H; $('zoom').value = zoom; $('rot').value = 0; maj();
      if (!silencieux) msg('Visage centré : ajustez si besoin.', 'ok');
    } catch (e) { if (!silencieux) msg('Détection impossible : cadrez à la main.', 'err'); }
  }
  var ptrs = {}, dist0 = 0, zoom0 = 1;
  $('zone').addEventListener('pointerdown', function (e) { if (!img) return; this.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var k = Object.keys(ptrs); if (k.length === 2) { dist0 = Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y); zoom0 = S.zoom; } });
  $('zone').addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId]; if (!p || !img) return; var r = $('cv').getBoundingClientRect(), k = Object.keys(ptrs);
    if (k.length === 2) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var d = Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y); if (dist0) { S.zoom = Math.max(.5, Math.min(4, zoom0 * d / dist0)); $('zoom').value = S.zoom; } }
    else { S.dx += (e.clientX - p.x) / r.width; S.dy += (e.clientY - p.y) / r.height; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; }
    maj();
  });
  ['pointerup', 'pointercancel'].forEach(function (n) { $('zone').addEventListener(n, function (e) { delete ptrs[e.pointerId]; }); });
  $('zone').addEventListener('wheel', function (e) { if (!img) return; e.preventDefault(); S.zoom = Math.max(.5, Math.min(4, S.zoom * (e.deltaY < 0 ? 1.05 : .95))); $('zoom').value = S.zoom; maj(); }, { passive: false });
  $('zoom').addEventListener('input', function () { S.zoom = +this.value; maj(); }); $('rot').addEventListener('input', function () { S.rot = +this.value; maj(); });
  ['lum', 'con', 'fondOn', 'fondTol'].forEach(function (id) { $(id).addEventListener('input', maj); $(id).addEventListener('change', maj); });
  $('guideOn').addEventListener('change', guide); $('bReset').onclick = reinit; $('bAuto').onclick = function () { auto(false); };
  $('bPhoto').onclick = function () { $('fCam').click(); }; $('bGalerie').onclick = function () { $('fGal').click(); };
  $('fCam').addEventListener('change', function () { charger(this.files[0]); this.value = ''; }); $('fGal').addEventListener('change', function () { charger(this.files[0]); this.value = ''; });
  $('rech').addEventListener('input', remplirFormats);
  $('fmt').addEventListener('change', function () { var f = P.FORMATS[+this.value]; if (!f) return; fmt = f; $('rech').value = ''; remplirFormats(); majInfo(); $('nb').dataset.touche = ''; maj(); });
  $('feuille').addEventListener('change', function () { $('nb').dataset.touche = ''; maj(); }); $('nb').addEventListener('input', function () { this.dataset.touche = '1'; maj(); });
  Object.keys(P.FEUILLES).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = P.FEUILLES[k].nom; $('feuille').appendChild(o); });

  /* ---- Sorties ---- */
  var blobDe = function (c) { return new Promise(function (r) { c.toBlob(r, 'image/jpeg', .95); }); };
  var nomBase = function () { return nrm(fmt.pays + '-' + fmt.doc).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); };
  function telecharger(blob, nom) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000); }
  $('bDl').onclick = async function () { var r = planche(300); telecharger(await blobDe(r.canvas), 'planche-' + nomBase() + '.jpg'); msg('Planche de ' + r.n + ' photo(s) enregistrée (300 dpi).', 'ok'); };
  $('bOne').onclick = async function () { telecharger(await blobDe(rendre(ppm(DPI))), 'photo-' + nomBase() + '-' + fmt.w + 'x' + fmt.h + '.jpg'); msg('Photo enregistrée (600 dpi).', 'ok'); };
  $('bWa').onclick = async function () {
    var r = planche(300), blob = await blobDe(r.canvas), f = new File([blob], 'planche-' + nomBase() + '.jpg', { type: 'image/jpeg' });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: 'Photos d\'identité — ' + fmt.pays + ' ' + fmt.doc }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    telecharger(blob, f.name); msg('Image enregistrée : joignez-la dans WhatsApp.', 'ok');
  };
  $('bImp').onclick = async function () {
    var r = planche(300), url = URL.createObjectURL(await blobDe(r.canvas)), g = r.g, w = window.open('', '_blank');
    if (!w) { msg('Autorisez les fenêtres pop-up pour imprimer.', 'err'); return; }
    w.document.open(); w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Planche photos</title><style>@page{size:' + g.w + 'mm ' + g.h + 'mm;margin:0}html,body{margin:0;background:#e5e7eb}.bar{position:sticky;top:0;background:#0A1628;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;font:14px system-ui}.bar button{background:#16A34A;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-weight:700}img{display:block;margin:0 auto;width:' + g.w + 'mm;height:' + g.h + 'mm;background:#fff}@media print{.bar{display:none}html,body{background:#fff}}</style></head><body><div class="bar"><span>Imprimez en taille réelle (100 %), sans marges</span><button onclick="print()">🖨️ Imprimer</button></div><img src="' + url + '"></body></html>'); w.document.close();
  };
  $('prix').value = (function () { try { return localStorage.getItem('samassa_photo_prix') || ''; } catch (e) { return ''; } })();
  $('bCaisse').onclick = function () {
    var m = Math.round(+$('prix').value); if (!(m > 0)) { msg('Indiquez le prix du service.', 'err'); return; }
    try {
      localStorage.setItem('samassa_photo_prix', String(m)); var l = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]'), d = new Date().toISOString();
      l.push({ id: Date.now(), date: d.slice(0, 10), type: 'entree', desc: 'Photos d\'identité — ' + fmt.pays + ' ' + fmt.doc, amount: m, pm: $('pm').value, cat: 'Vente service', auto: true, timestamp: d });
      localStorage.setItem('samassa_mouvements', JSON.stringify(l)); msg('✓ ' + m.toLocaleString('fr-FR') + ' FCFA ajoutés à la caisse.', 'ok');
    } catch (e) { msg('Enregistrement impossible : ' + e.message, 'err'); }
  };
  remplirFormats(); majInfo(); maj();
})();
