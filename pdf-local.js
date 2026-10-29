/* SAMASSA TECHNOLOGIE — Outils PDF & images locaux (gratuits, sans envoi de fichier) */
'use strict';
(() => {
  /* "1-3,5" -> [0,1,2,4] (indices), valide et borné à n pages */
  function parsePages(txt, n) {
    const out = [];
    for (const part of String(txt || '').split(',')) {
      const s = part.trim(); if (!s) continue;
      const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(s); if (!m) throw new Error(`Plage invalide : « ${s} »`);
      let a = +m[1], b = m[2] ? +m[2] : a; if (a < 1 || b < 1 || a > n || b > n) throw new Error(`Page hors limites (le document a ${n} pages)`);
      if (a > b) [a, b] = [b, a]; for (let i = a; i <= b; i++) out.push(i - 1);
    }
    if (!out.length) throw new Error('Indiquez les pages (exemple : 1-3,5)');
    return out;
  }
  if (typeof window !== 'undefined') window.PdfLocal = { parsePages };
  if (typeof document === 'undefined' || !document.getElementById('lc-run')) return;
  const $ = id => document.getElementById(id), st = (t, c = '') => { $('lc-status').textContent = t; $('lc-status').className = 'il-status ' + c; };
  let files = [];
  async function pdfLib() {
    if (window.PDFLib) return window.PDFLib;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'; s.onload = res; s.onerror = () => rej(new Error('Module PDF indisponible (connexion ?)')); document.head.appendChild(s); });
    return window.PDFLib;
  }
  const lire = f => f.arrayBuffer();
  const telecharger = (bytes, nom, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type })); a.download = nom; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  const base = f => f.name.replace(/\.[^.]+$/, '');
  const charger = f => new Promise((res, rej) => { const u = URL.createObjectURL(f), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Image illisible : ' + f.name)); }; i.src = u; });
  async function versJpeg(f, maxCote, q) {
    const img = await charger(f), r = Math.min(1, maxCote / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', q)); return { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
  }
  const ACTIONS = {
    async img2pdf() {
      const P = await pdfLib(), doc = await P.PDFDocument.create();
      for (const [i, f] of files.entries()) { st(`Image ${i + 1}/${files.length}…`); const j = await versJpeg(f, 2400, .88), im = await doc.embedJpg(j.bytes), W = 595, H = Math.round(j.h * W / j.w), pg = doc.addPage([W, H]); pg.drawImage(im, { x: 0, y: 0, width: W, height: H }); }
      telecharger(await doc.save(), 'images.pdf', 'application/pdf'); return `PDF de ${files.length} page(s) créé.`;
    },
    async merge() {
      if (files.length < 2) throw new Error('Sélectionnez au moins 2 PDF.');
      const P = await pdfLib(), out = await P.PDFDocument.create();
      for (const f of files) { const d = await P.PDFDocument.load(await lire(f), { ignoreEncryption: false }); (await out.copyPages(d, d.getPageIndices())).forEach(p => out.addPage(p)); }
      telecharger(await out.save(), 'fusion.pdf', 'application/pdf'); return `${files.length} PDF fusionnés (${out.getPageCount()} pages).`;
    },
    async extract() {
      if (files.length !== 1) throw new Error('Sélectionnez un seul PDF.');
      const P = await pdfLib(), d = await P.PDFDocument.load(await lire(files[0])), idx = parsePages($('lc-pages').value, d.getPageCount()), out = await P.PDFDocument.create();
      (await out.copyPages(d, idx)).forEach(p => out.addPage(p)); telecharger(await out.save(), base(files[0]) + '-extrait.pdf', 'application/pdf'); return `${idx.length} page(s) extraite(s).`;
    },
    async rotate() {
      if (files.length !== 1) throw new Error('Sélectionnez un seul PDF.');
      const P = await pdfLib(), d = await P.PDFDocument.load(await lire(files[0])), deg = +$('lc-angle').value, txt = $('lc-pages').value.trim(), idx = txt ? parsePages(txt, d.getPageCount()) : d.getPageIndices();
      idx.forEach(i => { const p = d.getPage(i); p.setRotation(P.degrees(((p.getRotation().angle + deg) % 360 + 360) % 360)); });
      telecharger(await d.save(), base(files[0]) + '-pivote.pdf', 'application/pdf'); return `${idx.length} page(s) pivotée(s).`;
    },
    async imgcompress() {
      const maxc = +$('lc-max').value, q = +$('lc-q').value; let avant = 0, apres = 0;
      for (const [i, f] of files.entries()) { st(`Image ${i + 1}/${files.length}…`); const j = await versJpeg(f, maxc, q); avant += f.size; apres += j.bytes.length; telecharger(j.bytes, base(f) + '-leger.jpg', 'image/jpeg'); await new Promise(r => setTimeout(r, 350)); }
      return `${files.length} image(s) : ${(avant / 1048576).toFixed(2)} Mo → ${(apres / 1048576).toFixed(2)} Mo.`;
    }
  };
  const ACCEPT = { img2pdf: 'image/*', merge: '.pdf,application/pdf', extract: '.pdf,application/pdf', rotate: '.pdf,application/pdf', imgcompress: 'image/*' };
  const ctrl = () => { const a = $('lc-tool').value; $('lc-files').accept = ACCEPT[a]; $('lc-pagesbox').hidden = !['extract', 'rotate'].includes(a); $('lc-anglebox').hidden = a !== 'rotate'; $('lc-imgbox').hidden = a !== 'imgcompress'; files = []; $('lc-files').value = ''; $('lc-list').textContent = 'Aucun fichier sélectionné.'; };
  $('lc-tool').addEventListener('change', ctrl); ctrl();
  $('lc-files').addEventListener('change', e => { files = [...e.target.files].slice(0, 20); $('lc-list').textContent = files.length ? files.map(f => `${f.name} (${(f.size / 1048576).toFixed(2)} Mo)`).join(' · ') : 'Aucun fichier sélectionné.'; });
  $('lc-run').addEventListener('click', async () => {
    if (!files.length) { st('Sélectionnez au moins un fichier.', 'error'); return; }
    if (files.some(f => f.size > 40 * 1024 * 1024)) { st('Un fichier dépasse 40 Mo.', 'error'); return; }
    $('lc-run').disabled = true; st('Traitement en cours…');
    try { st(await ACTIONS[$('lc-tool').value](), 'success'); } catch (e) { st(e.message || 'Erreur', 'error'); } finally { $('lc-run').disabled = false; }
  });
})();
