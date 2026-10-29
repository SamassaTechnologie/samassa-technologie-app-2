/* SAMASSA TECHNOLOGIE — Scanner intelligent v2 : multi-pages, recadrage auto, rotation, mode Document, PDF multi-pages, OCR, champs détectés */
'use strict';
(() => {
  /* ===== Fonctions pures (testables) ===== */
  const gris = (r, g, b) => .299 * r + .587 * g + .114 * b;
  function otsu(hist, total) {
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0, wB = 0, best = 0, seuil = 128;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; seuil = t; } }
    return seuil;
  }
  /* g : niveaux de gris (Uint8) w×h. Renvoie {x,y,w,h} en proportion (0..1) ou null si rien à recadrer */
  function limitesDocument(g, w, h) {
    const hist = new Array(256).fill(0); for (let i = 0; i < g.length; i++) hist[g[i]]++;
    const s = otsu(hist, g.length);
    let bord = 0, nb = 0; for (let x = 0; x < w; x++) { bord += g[x] + g[(h - 1) * w + x]; nb += 2; } for (let y = 0; y < h; y++) { bord += g[y * w] + g[y * w + w - 1]; nb += 2; }
    const papierClair = (bord / nb) <= s; /* bords sombres => papier clair au centre */
    const ok = v => papierClair ? v > s : v <= s;
    const lig = new Array(h).fill(0), col = new Array(w).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ok(g[y * w + x])) { lig[y]++; col[x]++; }
    const sl = w * .12, sc = h * .12; let y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
    while (y0 < h && lig[y0] < sl) y0++; while (y1 > y0 && lig[y1] < sl) y1--;
    while (x0 < w && col[x0] < sc) x0++; while (x1 > x0 && col[x1] < sc) x1--;
    const m = .015, ax = Math.max(0, x0 / w - m), ay = Math.max(0, y0 / h - m), bx = Math.min(1, (x1 + 1) / w + m), by = Math.min(1, (y1 + 1) / h + m);
    const aire = (bx - ax) * (by - ay);
    if (!papierClair || aire > .96 || aire < .2) return null;
    return { x: ax, y: ay, w: bx - ax, h: by - ay };
  }
  /* Seuillage adaptatif (texte net même avec ombre). g Uint8 w×h -> Uint8 0/255 */
  function seuilAdaptatif(g, w, h, bloc, ratio) {
    const W = w + 1, I = new Uint32Array(W * (h + 1));
    for (let y = 0; y < h; y++) { let l = 0; for (let x = 0; x < w; x++) { l += g[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + l; } }
    const r = Math.max(2, bloc >> 1), out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) { const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) { const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), n = (x1 - x0) * (y1 - y0), s = I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]; out[y * w + x] = g[y * w + x] * n > s * ratio ? 255 : 0; } }
    return out;
  }
  function champs(texte) {
    const t = String(texte || ''), uniq = a => [...new Set(a.map(s => s.trim()))].slice(0, 8);
    return {
      telephones: uniq((t.match(/(?:\+?223[\s.-]?)?\b\d{2}(?:[\s.-]?\d{2}){3}\b/g) || []).filter(x => x.replace(/\D/g, '').length >= 8)),
      emails: uniq(t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []),
      dates: uniq(t.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-](?:\d{4}|\d{2})\b/g) || []),
      montants: uniq(t.match(/\b\d{1,3}(?:[\s.]\d{3})+(?:\s?(?:FCFA|F\s?CFA|CFA|XOF|F))\b|\b\d{3,}\s?(?:FCFA|F\s?CFA|CFA|XOF)\b/gi) || [])
    };
  }
  const lib = { limitesDocument, seuilAdaptatif, champs, otsu };
  if (typeof window !== 'undefined') window.ScanLib = lib;
  if (typeof document === 'undefined' || !document.getElementById('scan-file')) return;

  /* ===== Interface ===== */
  const $ = id => document.getElementById(id);
  const fileInput = $('scan-file'), preview = $('scan-preview'), empty = $('preview-empty'), status = $('status');
  const setStatus = (m, t = 'info') => { status.textContent = m; status.className = `status show ${t}`; };
  const track = (a, b, c, d) => { try { if (window.SAMASSA_ANALYTICS) SAMASSA_ANALYTICS.track('scanner', a, b || 'success', d); } catch (e) {} };
  const MAX_PAGES = 30, MAX = 2400;
  let pages = [], cur = -1, urlApercu = null;
  const setEnabled = on => ['enhance-btn', 'pdf-btn', 'ocr-btn'].forEach(id => $(id).disabled = !on);
  const nouveauCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  const lireImage = file => new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Image illisible : ' + file.name)); }; i.src = u; });
  async function ajouter(files) {
    let ajoutees = 0;
    for (const f of Array.from(files || [])) {
      if (pages.length >= MAX_PAGES) { setStatus(`Maximum ${MAX_PAGES} pages atteint.`, 'error'); break; }
      if (!/^image\//.test(f.type) || f.size > 25 * 1024 * 1024) { setStatus(`« ${f.name} » ignoré (image de 25 Mo maximum).`, 'error'); continue; }
      try {
        const img = await lireImage(f), r = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const c = nouveauCanvas(Math.round(img.naturalWidth * r), Math.round(img.naturalHeight * r)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        pages.push({ nom: f.name, orig: c, work: c }); ajoutees++;
      } catch (e) { setStatus(e.message, 'error'); }
    }
    if (ajoutees) { cur = pages.length - 1; setEnabled(true); majBande(); await afficher(); setStatus(`${pages.length} page(s). Recadrage auto, rotation et mode « Document » disponibles ci-dessous.`, 'success'); track('import', 'success', { n: ajoutees }); }
  }

  /* Rendu d'une page avec le mode choisi */
  function rendre(p, mode) {
    const w = p.work.width, h = p.work.height, c = nouveauCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(p.work, 0, 0);
    if (mode === 'original') return c;
    const d = x.getImageData(0, 0, w, h), px = d.data, g = new Uint8Array(w * h);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = gris(px[i], px[i + 1], px[i + 2]);
    let out = null;
    if (mode === 'doc') out = seuilAdaptatif(g, w, h, Math.max(15, Math.round(Math.min(w, h) / 12)), .9);
    else if (mode === 'bw') { const s = otsu((() => { const hh = new Array(256).fill(0); g.forEach(v => hh[v]++); return hh; })(), g.length); out = g.map(v => v > s ? 255 : 0); }
    for (let i = 0, j = 0; j < g.length; i += 4, j++) {
      if (out) { px[i] = px[i + 1] = px[i + 2] = out[j]; }
      else if (mode === 'gray') { px[i] = px[i + 1] = px[i + 2] = g[j]; }
      else if (mode === 'contrast') { for (let k = 0; k < 3; k++) px[i + k] = Math.max(0, Math.min(255, (px[i + k] - 128) * 1.35 + 128)); }
    }
    x.putImageData(d, 0, 0); return c;
  }
  const mode = () => $('enhance-mode').value;
  const versBlob = (c, q) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
  async function afficher() {
    const p = pages[cur]; if (!p) { preview.hidden = true; empty.hidden = false; return; }
    const blob = await versBlob(rendre(p, mode()), .85); if (urlApercu) URL.revokeObjectURL(urlApercu);
    urlApercu = URL.createObjectURL(blob); preview.src = urlApercu; preview.hidden = false; empty.hidden = true;
  }

  /* Bande de pages + barre d'outils */
  const barre = document.createElement('div');
  barre.id = 'scan-pages'; barre.style.cssText = 'margin:10px 0';
  barre.innerHTML = '<div id="scan-thumbs" style="display:flex;gap:8px;overflow-x:auto;padding:4px 0"></div><div id="scan-edit" class="scan-actions" hidden style="flex-wrap:wrap"></div>';
  document.querySelector('.preview-wrap').after(barre);
  const thumbs = barre.querySelector('#scan-thumbs'), edit = barre.querySelector('#scan-edit');
  const OUTILS = [['rotg', '↺', 'Pivoter à gauche'], ['rotd', '↻', 'Pivoter à droite'], ['crop', '✂️ Recadrer auto', 'Détecter les bords du document'], ['undo', '↩ Original', 'Annuler les retouches'], ['left', '◀', 'Déplacer avant'], ['right', '▶', 'Déplacer après'], ['del', '🗑', 'Supprimer la page']];
  edit.innerHTML = OUTILS.map(o => `<button type="button" class="scan-btn ghost" data-a="${o[0]}" title="${o[2]}" aria-label="${o[2]}" style="padding:8px 10px;min-width:44px">${o[1]}</button>`).join('');
  function majBande() {
    thumbs.innerHTML = ''; edit.hidden = !pages.length;
    pages.forEach((p, i) => {
      const t = nouveauCanvas(56, Math.max(20, Math.round(56 * p.work.height / p.work.width))); t.getContext('2d').drawImage(p.work, 0, 0, t.width, t.height);
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Page ' + (i + 1)); b.style.cssText = 'flex:none;border:2px solid ' + (i === cur ? '#0877B9' : '#D7E3EE') + ';border-radius:8px;background:#fff;padding:2px;cursor:pointer;position:relative';
      b.appendChild(t); const n = document.createElement('span'); n.textContent = i + 1; n.style.cssText = 'position:absolute;top:2px;left:4px;font:700 10px sans-serif;background:#0A1628;color:#fff;border-radius:6px;padding:0 4px'; b.appendChild(n);
      b.onclick = async () => { cur = i; majBande(); await afficher(); }; thumbs.appendChild(b);
    });
  }
  function pivoter(p, sens) { const w = p.work.width, h = p.work.height, c = nouveauCanvas(h, w), x = c.getContext('2d'); x.translate(sens > 0 ? h : 0, sens > 0 ? 0 : w); x.rotate(sens * Math.PI / 2); x.drawImage(p.work, 0, 0); p.work = c; }
  function recadrer(p) {
    const w = p.work.width, h = p.work.height, r = 220 / Math.max(w, h), sw = Math.max(1, Math.round(w * r)), sh = Math.max(1, Math.round(h * r));
    const s = nouveauCanvas(sw, sh), sx = s.getContext('2d', { willReadFrequently: true }); sx.drawImage(p.work, 0, 0, sw, sh);
    const d = sx.getImageData(0, 0, sw, sh).data, g = new Uint8Array(sw * sh); for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = gris(d[i], d[i + 1], d[i + 2]);
    const b = limitesDocument(g, sw, sh); if (!b) return false;
    const x = Math.round(b.x * w), y = Math.round(b.y * h), cw = Math.round(b.w * w), ch = Math.round(b.h * h), c = nouveauCanvas(cw, ch); c.getContext('2d').drawImage(p.work, x, y, cw, ch, 0, 0, cw, ch); p.work = c; return true;
  }
  edit.addEventListener('click', async e => {
    const bt = e.target.closest('button'); if (!bt || cur < 0) return; const p = pages[cur], a = bt.dataset.a;
    if (a === 'rotg') pivoter(p, -1); else if (a === 'rotd') pivoter(p, 1); else if (a === 'undo') p.work = p.orig;
    else if (a === 'crop') { if (!recadrer(p)) { setStatus('Bords du document non détectés : posez-le sur un fond sombre et uni, ou gardez la page telle quelle.', 'info'); return; } setStatus('Page recadrée.', 'success'); }
    else if (a === 'left' && cur > 0) { [pages[cur - 1], pages[cur]] = [pages[cur], pages[cur - 1]]; cur--; }
    else if (a === 'right' && cur < pages.length - 1) { [pages[cur + 1], pages[cur]] = [pages[cur], pages[cur + 1]]; cur++; }
    else if (a === 'del') { pages.splice(cur, 1); cur = Math.min(cur, pages.length - 1); if (!pages.length) { setEnabled(false); } }
    majBande(); await afficher();
  });

  /* PDF multi-pages (A4 en largeur, 595 pt) */
  async function creerPdf() {
    if (!pages.length) return;
    try {
      setStatus('Création du PDF…', 'info'); const q = Number($('pdf-quality').value) || .85, enc = new TextEncoder(), parts = [], off = []; let total = 0;
      const txt = t => { const b = enc.encode(t); parts.push(b); total += b.length; };
      const n = pages.length, imgs = [];
      for (const p of pages) { const c = rendre(p, mode()); imgs.push({ w: c.width, h: c.height, bytes: new Uint8Array(await (await versBlob(c, q)).arrayBuffer()) }); }
      txt('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      const kids = imgs.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
      off[1] = total; txt('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
      off[2] = total; txt(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`);
      imgs.forEach((im, i) => {
        const po = 3 + i * 3, co = po + 1, io = po + 2, W = 595, H = Math.round(im.h * W / im.w), st = `q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ`;
        off[po] = total; txt(`${po} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${io} 0 R >> >> /Contents ${co} 0 R >>\nendobj\n`);
        off[co] = total; txt(`${co} 0 obj\n<< /Length ${st.length} >>\nstream\n${st}\nendstream\nendobj\n`);
        off[io] = total; txt(`${io} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`); parts.push(im.bytes); total += im.bytes.length; txt('\nendstream\nendobj\n');
      });
      const N = 3 + n * 3, xref = total; let tail = `xref\n0 ${N}\n0000000000 65535 f \n`; for (let i = 1; i < N; i++) tail += String(off[i]).padStart(10, '0') + ' 00000 n \n';
      tail += `trailer\n<< /Size ${N} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; txt(tail);
      const out = new Uint8Array(total); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'application/pdf' })); a.download = 'scan-' + new Date().toISOString().slice(0, 10) + '.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setStatus(`PDF de ${n} page(s) créé (${(total / 1048576).toFixed(1)} Mo).`, 'success'); track('création PDF', 'success', { pages: n });
    } catch (e) { setStatus('Impossible de créer le PDF : ' + e.message, 'error'); track('création PDF', 'error'); }
  }

  /* OCR de toutes les pages */
  async function ocr() {
    if (!pages.length) return;
    try {
      setStatus('Chargement du moteur OCR…', 'info');
      if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('Moteur OCR indisponible (connexion ?)')); document.head.appendChild(s); });
      let k = 0; const worker = await Tesseract.createWorker('fra+eng', 1, { logger: m => { if (m.status === 'recognizing text') setStatus(`OCR page ${k + 1}/${pages.length} : ${Math.round((m.progress || 0) * 100)} %`, 'info'); } });
      const res = []; for (k = 0; k < pages.length; k++) { const r = await worker.recognize(rendre(pages[k], mode() === 'original' ? 'gray' : mode())); res.push(r.data.text.trim()); }
      await worker.terminate();
      const texte = res.map((t, i) => (pages.length > 1 ? `--- Page ${i + 1} ---\n` : '') + (t || '(aucun texte)')).join('\n\n');
      $('ocr-output').value = res.some(Boolean) ? texte : 'Aucun texte détecté.'; afficherChamps(texte);
      setStatus('OCR terminé. Vérifiez le texte avant utilisation.', 'success'); track('OCR local', 'success', { pages: pages.length });
    } catch (e) { setStatus('OCR indisponible : ' + e.message, 'error'); track('OCR local', 'error'); }
  }
  const zoneChamps = document.createElement('div'); zoneChamps.style.cssText = 'margin:8px 0;font-size:12px;line-height:1.7'; $('ocr-output').after(zoneChamps);
  function afficherChamps(texte) {
    const c = champs(texte), L = { telephones: '📞 Téléphones', emails: '✉️ Emails', dates: '📅 Dates', montants: '💰 Montants' }; zoneChamps.textContent = '';
    Object.keys(L).forEach(k => { if (!c[k].length) return; const l = document.createElement('div'); l.append(L[k] + ' : '); c[k].forEach(v => { const b = document.createElement('button'); b.type = 'button'; b.textContent = v; b.title = 'Copier'; b.style.cssText = 'border:1px solid #D7E3EE;background:#fff;border-radius:99px;padding:3px 10px;margin:2px;font:inherit;cursor:pointer'; b.onclick = async () => { try { await navigator.clipboard.writeText(v); b.textContent = '✓ ' + v; } catch (e) {} }; l.appendChild(b); }); zoneChamps.appendChild(l); });
  }

  /* Branchements */
  fileInput.removeAttribute('capture'); fileInput.multiple = true; fileInput.accept = 'image/*';
  const cam = document.createElement('input'); cam.type = 'file'; cam.accept = 'image/*'; cam.setAttribute('capture', 'environment'); cam.hidden = true; document.body.appendChild(cam);
  fileInput.addEventListener('change', async e => { await ajouter(e.target.files); fileInput.value = ''; });
  cam.addEventListener('change', async e => { await ajouter(e.target.files); cam.value = ''; });
  $('camera-btn').textContent = '📷 Photographier une page'; $('camera-btn').onclick = () => cam.click();
  $('clear-btn').onclick = () => { pages = []; cur = -1; majBande(); preview.hidden = true; empty.hidden = false; $('ocr-output').value = ''; zoneChamps.textContent = ''; setEnabled(false); status.className = 'status'; };
  $('enhance-mode').addEventListener('change', afficher);
  $('enhance-btn').onclick = async () => { await afficher(); setStatus('Aperçu mis à jour avec le mode choisi (appliqué au PDF et à l\'OCR).', 'success'); };
  $('pdf-btn').onclick = creerPdf; $('ocr-btn').onclick = ocr;
  $('copy-btn').onclick = async () => { try { await navigator.clipboard.writeText($('ocr-output').value); setStatus('Texte copié dans le presse-papiers.', 'success'); } catch { setStatus('Copie impossible sur cet appareil.', 'error'); } };
  $('writer-btn').onclick = () => { localStorage.setItem('samassa_scanner_ocr', $('ocr-output').value); window.location.href = 'redacteur-ia-mali/index.html?from=scanner'; };
  const sel = $('enhance-mode'); if (!sel.querySelector('[value="doc"]')) { const o = document.createElement('option'); o.value = 'doc'; o.textContent = 'Document (texte net, ombres retirées)'; sel.insertBefore(o, sel.children[1]); sel.value = 'doc'; }
})();
