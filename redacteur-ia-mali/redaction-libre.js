/* RÉDACTEUR IA – MALI | redaction-libre.js (v1.0)
   « Rédiger directement avec l'IA » : l'IA écrit le document entier à partir d'une simple demande,
   même avec peu d'informations. Les valeurs qu'elle invente arrivent entre [[doubles crochets]] :
   elles sont surlignées à l'écran pour être vérifiées, et les crochets disparaissent à l'impression / dans Word.
   À charger APRÈS assistant-redaction.js. */
(function () {
  'use strict';
  /* ---------- Fonctions pures (testées) ---------- */
  /* Retire ce qui n'appartient pas au document : balises de code, markdown, cadres dessinés, phrase d'introduction */
  function nettoyer(t) {
    let l = String(t || '').replace(/\r/g, '').replace(/```[a-z]*\n?/gi, '').split('\n')
      .map(x => { const cadre = /[┌┐└┘├┤┬┴┼│─═━]/.test(x); let y = x.replace(/[┌┐└┘├┤┬┴┼│]/g, '').replace(/^\s*[─═━_*\-]{4,}\s*$/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s{0,3}#{1,6}\s+/, '').replace(/[ \t]+$/, ''); if (cadre) y = y.trim(); return x.trim() && !y.trim() ? null : y; })
      .filter(x => x !== null);
    while (l.length && !l[0].trim()) l.shift();
    if (l.length > 2 && /^(voici|bien s[uû]r|d'accord|ci-dessous)\b.*:\s*$/i.test(l[0].trim())) { l.shift(); while (l.length && !l[0].trim()) l.shift(); }
    while (l.length && !l[l.length - 1].trim()) l.pop();
    return l.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  /* Découpe une ligne en morceaux : texte normal, [[exemple inventé]], [À COMPLÉTER] */
  function morceaux(ligne, base) {
    const out = [];
    String(ligne).split(/(\[\[[^\[\]]+\]\]|\[[^\[\]]*À COMPLÉTER[^\[\]]*\])/i).forEach(s => {
      if (!s) return;
      const ex = /^\[\[([^\[\]]+)\]\]$/.exec(s);
      if (ex) out.push(Object.assign({}, base, { x: ex[1].trim(), hl: true }));
      else if (/^\[[^\[\]]*À COMPLÉTER[^\[\]]*\]$/i.test(s)) out.push(Object.assign({}, base, { x: s, b: true, hl: true }));
      else out.push(Object.assign({}, base, { x: s }));
    });
    return out;
  }
  const brut = l => l.replace(/\[\[|\]\]/g, '').trim();
  const estMaj = l => { const s = brut(l), lettres = s.replace(/[^A-Za-zÀ-ÿ]/g, ''); return lettres.length >= 4 && s.length <= 90 && s === s.toUpperCase() && !/[.;,]$/.test(s); };
  /* Texte de l'IA → blocs de mise en page (les mêmes que ceux des modèles : aperçu, impression, Word) */
  function versBlocs(texte) {
    const B = [], L = nettoyer(texte).split('\n');
    const p = (l, o, base) => B.push(Object.assign({ runs: morceaux(l.trim(), base || {}) }, o));
    L.forEach((l, i) => {
      const s = brut(l), vide = !s, suivVide = i + 1 >= L.length || !L[i + 1].trim();
      if (vide) { if (B.length && !B[B.length - 1].tbl) B[B.length - 1].sa = Math.max(B[B.length - 1].sa || 0, 10); return; }
      if (/^R[ÉE]PUBLIQUE DU MALI$/i.test(s)) return p(l, { al: 'center', sa: 0 }, { b: true, sz: 26 });
      if (/^un peuple\s*[–—-]\s*un but\s*[–—-]\s*une foi$/i.test(s)) return p(l, { al: 'center', sa: 14 }, { i: true });
      if (/^objet\s*:/i.test(s)) return p(l, { sb: 8, sa: 10 }, { b: true });
      if (/^(article|art\.)\s+\d+/i.test(s) || /^(titre|chapitre)\s+[IVX\d]+/i.test(s)) return p(l, { sb: 6, sa: 3 }, { b: true });
      if (estMaj(l)) return p(l, { al: 'center', sb: 8, sa: 10 }, { b: true, u: s.length > 12 && !/^(R[ÉE]PUBLIQUE|MINIST|DIRECTION|R[ÉE]GION|CERCLE|COMMUNE)/.test(s) });
      if (/^\s*[-•–]\s+/.test(l)) return B.push({ runs: [{ x: '•  ' }].concat(morceaux(l.replace(/^\s*[-•–]\s+/, '').trim(), {})), ind: 567, sa: 3 });
      /* Ligne courte sans ponctuation finale (coordonnées, destinataire, signature) : alignée simplement, sans retrait */
      if (s.length < 70 && !/[.!?;:,]$/.test(s)) return p(l, { sa: suivVide ? 6 : 0 }, /^(fait à|lu et approuv|signature|le (vendeur|l'acheteur|bailleur|locataire|déclarant|demandeur|soussign))/i.test(s) ? { b: true } : {});
      if (s.length < 70 && /,$/.test(s)) return p(l, { sa: 8 });   /* formule d'appel : « Monsieur le Maire, » */
      p(l, { al: 'both', fi: s.length > 110, sa: 8 });
    });
    return B;
  }
  const compter = t => ({ exemples: (String(t).match(/\[\[[^\[\]]+\]\]/g) || []).length, vides: (String(t).match(/\[[^\[\]]*À COMPLÉTER[^\[\]]*\]/gi) || []).length });
  /* Titre court pour le nom du fichier et l'historique */
  function titreDe(texte, demande) {
    const l = nettoyer(texte).split('\n').map(brut), o = l.find(x => /^objet\s*:/i.test(x));
    const t = o ? o.replace(/^objet\s*:\s*/i, '') : (l.find(x => estMaj(x) && !/^(R[ÉE]PUBLIQUE|UN PEUPLE|MINIST|DIRECTION|R[ÉE]GION|CERCLE|COMMUNE)/.test(x)) || demande || 'Document');
    return ('IA – ' + t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).replace(/\s+/g, ' ').slice(0, 70);
  }
  /* Version finale : sans les doubles crochets (les [À COMPLÉTER] restent visibles) */
  const sansMarques = t => String(t).replace(/\[\[([^\[\]]+)\]\]/g, (m, a) => a.trim());
  window.RedactionLibre = { nettoyer, morceaux, versBlocs, compter, titreDe, sansMarques };

  if (typeof document === 'undefined' || typeof MODELES === 'undefined' || typeof ouvrir === 'undefined' || window.__redactionLibre) return;
  window.__redactionLibre = true;
  const $q = s => document.querySelector(s);
  const css = document.createElement('style');
  css.textContent = 'mark.ia-ex{background:#FEF08A;color:inherit;border-radius:3px;padding:0 2px}@media print{mark.ia-ex{background:none;padding:0}}'
    + '.rl textarea{width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--bord);border-radius:10px;font:inherit;font-size:15px}.rl .l2{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0}@media(max-width:560px){.rl .l2{grid-template-columns:1fr}}.rl select{width:100%;padding:9px;border:1.5px solid var(--bord);border-radius:10px;font:inherit}.rl label{display:block;font-size:13px;font-weight:600}.rl .msg{font-size:13px;margin:8px 0;min-height:18px}.rl .ex{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.rl .ex button{border:1px solid var(--bord);background:#fff;border-radius:99px;padding:5px 10px;font-size:12px;cursor:pointer}.rl .hist button{display:block;width:100%;text-align:left;border:0;border-top:1px solid var(--bord);background:none;padding:8px 2px;font:inherit;font-size:13px;cursor:pointer}';
  document.head.appendChild(css);
  async function entetes() { try { return typeof aiAuthHeaders === 'function' ? await aiAuthHeaders() : { 'Content-Type': 'application/json' }; } catch (e) { return { 'Content-Type': 'application/json' }; } }
  const EXEMPLES = ['Demande de congé de 10 jours pour un mariage', 'Lettre de motivation pour un poste de comptable', 'Attestation d\'hébergement', 'Contrat de location d\'une boutique à Kayes', 'Plainte pour vol de moto', 'Demande de stage dans une banque'];
  let texte = '', demande = '';

  function rendre() {
    const z = $q('#rlTexte'); if (z && z.value !== texte) z.value = texte;
    const ok = !!texte.trim(); $q('#rlSuite').hidden = !ok;
    $q('#apercu').hidden = $q('#btnWord').hidden = $q('#btnPrint').hidden = !ok;
    if (!ok) return;
    modele = { titre: titreDe(texte, demande), cat: 'Rédaction IA', type: 'ia' };
    blocs = versBlocs(texte); $q('#apercu').innerHTML = apercuHtml(blocs);
    const c = compter(texte);
    $q('#rlInfo').innerHTML = (c.exemples ? '🟡 <b>' + c.exemples + ' information(s) d\'exemple inventée(s) par l\'IA</b>, surlignée(s) en jaune : remplacez-les par les vraies avant d\'imprimer. ' : '') + (c.vides ? '✏️ ' + c.vides + ' champ(s) [À COMPLÉTER] à remplir. ' : '') + (!c.exemples && !c.vides ? '✅ Aucune information inventée. Relisez avant d\'imprimer.' : '') + ' Vous pouvez corriger le texte directement ci-dessous.';
  }
  async function appeler(corps, btn, libelle) {
    const msg = $q('#rlMsg');
    if (!navigator.onLine) { msg.textContent = 'La rédaction par l\'IA a besoin d\'une connexion internet.'; return null; }
    const avant = btn.textContent; btn.disabled = true; btn.textContent = libelle; msg.textContent = 'L\'IA rédige votre document… (jusqu\'à 25 secondes)';
    try {
      const r = await fetch('/api/generate-doc', { method: 'POST', headers: await entetes(), body: JSON.stringify(corps) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.text) throw new Error(r.status === 503 ? 'service IA non configuré' : r.status === 401 ? 'connexion requise : reconnectez-vous' : (d.error || 'service indisponible (' + r.status + ')'));
      msg.textContent = ''; return nettoyer(d.text);
    } catch (e) { msg.textContent = '⚠️ Rédaction impossible : ' + e.message; return null; }
    finally { btn.disabled = false; btn.textContent = avant; }
  }
  function options() { return { completer: $q('#rlManque').value, longueur: $q('#rlLong').value, ton: $q('#rlTon').value }; }
  async function rediger() {
    demande = $q('#rlDemande').value.trim().slice(0, 3000);
    if (demande.length < 4) { $q('#rlMsg').textContent = 'Écrivez ce que vous voulez rédiger, même en quelques mots (ex. : demande de congé pour un mariage).'; return; }
    const t = await appeler(Object.assign({ prompt: demande, forme: 'à déterminer selon la demande' }, options()), $q('#rlGo'), 'Rédaction en cours…');
    if (!t) return; texte = t; rendre(); noter(); $q('#rlInfo').scrollIntoView({ behavior: 'smooth' });
    if (window.SAMASSA_ANALYTICS) SAMASSA_ANALYTICS.track('writer', 'rédaction libre IA', 'success', {});
  }
  async function modifier() {
    const ins = $q('#rlIns').value.trim().slice(0, 1500); if (!ins) { $q('#rlMsg').textContent = 'Écrivez la modification voulue (ex. : le demandeur s\'appelle Awa Traoré, plus court, ajoute le numéro de téléphone 76 00 00 00).'; return; }
    const t = await appeler(Object.assign({ mode: 'affiner', previous: texte, instruction: ins }, options()), $q('#rlModif'), 'Modification…');
    if (!t) return; texte = t; $q('#rlIns').value = ''; rendre(); noter();
  }
  function noter() { try { const h = LS.get('ia_libre', []).filter(x => x.d !== demande); h.unshift({ d: demande, t: texte, date: new Date().toISOString() }); LS.set('ia_libre', h.slice(0, 15)); } catch (e) {} histo(); }
  function histo() {
    const z = $q('#rlHist'); if (!z) return; let h = []; try { h = LS.get('ia_libre', []); } catch (e) {}
    z.innerHTML = h.length ? '<b style="font-size:13px">🕘 Mes dernières rédactions IA</b>' : '';
    h.forEach(x => { const b = document.createElement('button'); b.type = 'button'; b.textContent = new Date(x.date).toLocaleDateString('fr-FR') + ' · ' + x.d.slice(0, 70); b.onclick = () => { demande = x.d; texte = x.t; $q('#rlDemande').value = x.d; rendre(); }; z.appendChild(b); });
  }
  function ouvrirLibre(phrase, lancer) {
    document.querySelectorAll('.ar-form').forEach(x => x.remove());
    texte = ''; demande = '';
    $q('#formTitre').textContent = '✍️ Rédiger directement avec l\'IA';
    $q('#champs').innerHTML = '<div class="rl champ large" style="grid-column:1/-1">'
      + '<label for="rlDemande">Que voulez-vous rédiger ? Donnez les informations que vous avez, même peu : l\'IA rédige le document entier avec.</label>'
      + '<textarea id="rlDemande" rows="4" maxlength="3000" placeholder="Ex. : demande de congé de 10 jours à partir du 3 décembre pour Awa Traoré, secrétaire à la mairie de Kayes, pour le mariage de sa sœur"></textarea>'
      + '<div class="ex" id="rlEx"></div>'
      + '<div class="l2"><label>Informations manquantes<select id="rlManque"><option value="exemple">Compléter par un exemple (surligné)</option><option value="">Laisser [À COMPLÉTER]</option></select></label>'
      + '<label>Longueur<select id="rlLong"><option value="normal">Normale</option><option value="court">Courte</option><option value="détaillé">Détaillée</option></select></label>'
      + '<label>Ton<select id="rlTon"><option value="formel">Formel</option><option value="très formel">Très formel</option><option value="courtois et simple">Courtois et simple</option><option value="ferme">Ferme</option></select></label></div>'
      + '<button type="button" class="btn" id="rlGo">✨ Rédiger le document</button><div class="msg" id="rlMsg"></div>'
      + '<div id="rlSuite" hidden><div class="msg" id="rlInfo"></div>'
      + '<label for="rlTexte">Texte du document (modifiable)</label><textarea id="rlTexte" rows="12"></textarea>'
      + '<label for="rlIns" style="margin-top:8px">Demander une modification à l\'IA</label><textarea id="rlIns" rows="2" maxlength="1500" placeholder="Ex. : le destinataire est le Maire de Kayes · rends-la plus courte · ajoute que je joins mon acte de naissance"></textarea>'
      + '<button type="button" class="btn sec" id="rlModif" style="margin-top:6px">🔁 Modifier avec l\'IA</button> <button type="button" class="btn sec" id="rlValider" style="margin-top:6px">✔ Tout est vérifié : retirer le surlignage</button></div>'
      + '<div class="hist" id="rlHist" style="margin-top:12px"></div></div>';
    EXEMPLES.forEach(e => { const b = document.createElement('button'); b.type = 'button'; b.textContent = e; b.onclick = () => { $q('#rlDemande').value = e; $q('#rlDemande').focus(); }; $q('#rlEx').appendChild(b); });
    /* Les brouillons et totaux des modèles classiques ne concernent pas cette vue */
    ['input', 'change'].forEach(ev => $q('#champs .rl').addEventListener(ev, e => e.stopPropagation()));
    try { if (history.state && history.state.form) history.replaceState({ form: 1 }, ''); else history.pushState({ form: 1 }, ''); } catch (e) {}
    $q('#rlDemande').value = phrase || '';
    $q('#rlGo').onclick = rediger; $q('#rlModif').onclick = modifier;
    $q('#rlTexte').oninput = () => { texte = $q('#rlTexte').value; rendre(); };
    $q('#rlTexte').onchange = () => { if (demande) noter(); };
    $q('#rlValider').onclick = () => { texte = sansMarques(texte); rendre(); if (demande) noter(); };
    $q('#btnGen').hidden = true; const sh = $q('#btnShare'); if (sh) sh.hidden = true;
    $q('#apercu').hidden = $q('#btnWord').hidden = $q('#btnPrint').hidden = true;
    $q('#vueAccueil').hidden = true; $q('#vueForm').hidden = false; window.scrollTo(0, 0);
    histo(); if (lancer && phrase && phrase.trim().length >= 4 && navigator.onLine) rediger();
  }
  window.RedactionLibre.ouvrir = ouvrirLibre;

  /* Un modèle classique rouvre le bouton « Générer » */
  const ouvrirAvant = ouvrir;
  ouvrir = function (i) {
    $q('#btnGen').hidden = false; ouvrirAvant(i);
    const f = $q('.ar-form'); if (f && !f.querySelector('#rlDepuisForm')) {
      const b = document.createElement('button'); b.type = 'button'; b.id = 'rlDepuisForm'; b.className = 'btn sec'; b.style.marginTop = '6px'; b.textContent = '✍️ Ou laisser l\'IA rédiger tout le document';
      b.onclick = () => { const ph = ($q('#arPhrase') || {}).value || ''; ouvrirLibre(MODELES[i].titre + (ph.trim() ? ' : ' + ph.trim() : ''), !!ph.trim()); };
      f.appendChild(b);
    }
  };
  /* Accueil : bouton à côté de « Trouver un modèle » */
  const ch = $q('#arChercher');
  if (ch) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'rlAccueil'; b.className = ch.className; b.textContent = '✍️ Rédiger directement avec l\'IA';
    b.onclick = () => ouvrirLibre($q('#arBesoin').value, true);
    ch.after(b);
  }
})();
