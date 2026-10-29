/* RÉDACTEUR IA – MALI | assistant-redaction.js (v1.0)
   1. « Décrivez votre besoin » sur l'accueil : propose les meilleurs modèles (fonctionne hors ligne)
   2. Pré-remplissage du formulaire entier par l'IA à partir d'une phrase (internet requis)
   À charger APRÈS ameliorations.js. */
(function () {
  'use strict';
  const nrm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const STOP = new Set('je un une des les pour mon ma mes de du la le et en au aux ce cette que qui dans sur par avec veux voudrais besoin faire fais ecrire rediger redige document lettre moi nous est sont'.split(' '));
  const jetons = t => nrm(t).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
  const racine = w => w.slice(0, Math.max(4, w.length - 2));

  /* Classe les modèles selon la phrase de l'utilisateur */
  function classer(modeles, phrase, n) {
    const mots = jetons(phrase); if (!mots.length) return [];
    return modeles.map((m, i) => {
      const t = nrm(m.titre), c = nrm(m.cat), o = nrm(m.objet || ''); let s = 0;
      mots.forEach(w => { const r = racine(w); if (t.includes(r)) s += 3; if (c.includes(r)) s += 2; if (o.includes(r)) s += 1; });
      return { i, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n || 4).map(x => x.i);
  }
  /* Lit « CLE: valeur » (valeurs sur plusieurs lignes acceptées) ; ne garde que les clés autorisées */
  function lireReponse(texte, clesOk) {
    const out = {}; let cle = null;
    String(texte || '').replace(/\r/g, '').split('\n').forEach(l => {
      const m = /^\s*[-*•]?\s*\[?([A-Z][A-Z0-9_]{1,24})\]?\s*[:=]\s*(.*)$/.exec(l);
      if (m && clesOk.includes(m[1])) { cle = m[1]; out[cle] = m[2]; }
      else if (cle && l.trim() && !/^\s*[-*•]?\s*\[?[A-Z][A-Z0-9_]{1,24}\]?\s*[:=]/.test(l)) out[cle] += '\n' + l.trim();
    });
    Object.keys(out).forEach(k => { let v = out[k].replace(/\*\*/g, '').replace(/^["«\s]+|["»\s]+$/g, '').trim(); if (!v || /^(\[?à compléter\]?|-|—|n\/a|inconnu|néant)$/i.test(v)) delete out[k]; else out[k] = v.slice(0, 1500); });
    return out;
  }
  window.AssistantRedaction = { classer, lireReponse };
  if (typeof MODELES === 'undefined' || typeof ouvrir === 'undefined' || window.__assistantRedaction) return;
  window.__assistantRedaction = true;

  const css = document.createElement('style');
  css.textContent = '.ar-box{background:var(--clair);border:1px solid var(--bord);border-radius:12px;padding:12px;margin:10px 0}.ar-box textarea{width:100%;box-sizing:border-box;min-height:64px;padding:10px;border:1.5px solid var(--bord);border-radius:10px;font:inherit}.ar-box .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.ar-sug button{border:1px solid var(--bord);background:#fff;border-radius:99px;padding:8px 12px;cursor:pointer;font:inherit}.ar-msg{margin-top:8px;font-size:.88rem}.champ.ar-ia input,.champ.ar-ia textarea{background:#F5F3FF;border-color:#7C3AED}';
  document.head.appendChild(css);
  const $q = s => document.querySelector(s);
  async function entetes() { try { return typeof aiAuthHeaders === 'function' ? await aiAuthHeaders() : { 'Content-Type': 'application/json' }; } catch (e) { return { 'Content-Type': 'application/json' }; } }

  /* --- Pré-remplissage par l'IA du formulaire ouvert --- */
  const EXCLUS = ['NUMERO', 'DATE', 'LIEU', 'REF', 'TVA', 'MODE', 'VALIDITE'];
  async function preRemplir(phrase, msg, btn) {
    phrase = phrase.trim().slice(0, 1200);
    if (!phrase) { msg.textContent = 'Décrivez d\'abord votre situation en une ou deux phrases.'; return; }
    if (!navigator.onLine) { msg.textContent = 'L\'assistant IA a besoin d\'une connexion internet.'; return; }
    const champs = [...document.querySelectorAll('#champs [data-k]')].filter(e => e.dataset.t !== 'd' && e.dataset.t !== 's' && !EXCLUS.includes(e.dataset.k));
    const cles = champs.map(e => e.dataset.k); if (!cles.length) { msg.textContent = 'Ce modèle n\'a pas de champ à remplir.'; return; }
    const liste = champs.map(e => `${e.dataset.k} : ${e.closest('label').querySelector('span').textContent.replace(/\s*\[.*?\]\s*$/, '')}${e.dataset.t === 'm' ? ' (montant en FCFA, chiffres seulement)' : ''}`).join('\n');
    btn.disabled = true; msg.textContent = 'L\'IA remplit le formulaire…';
    try {
      const r = await fetch('/api/generate-doc', { method: 'POST', headers: await entetes(), body: JSON.stringify({
        prompt: `Tu remplis le formulaire du modèle « ${modele.titre} ». Voici la situation de l'utilisateur :\n"""${phrase}"""\n\nChamps à remplir :\n${liste}\n\nFORMAT STRICT : une ligne par champ, sous la forme CLE: valeur (la CLE exactement comme ci-dessus, en majuscules). Pour un champ long, écris le texte complet sur la même ligne ou les lignes suivantes, en français administratif malien. N'écris QUE les champs que tu peux remplir avec certitude : n'invente aucun nom, numéro, adresse, date ni montant absent de la situation. Aucun commentaire.`,
        forme: modele.titre, longueur: 'court', ton: 'formel' }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.text) throw new Error(r.status === 503 ? 'service IA non configuré' : (d.error || 'service indisponible (' + r.status + ')'));
      const v = lireReponse(d.text, cles); let n = 0;
      champs.forEach(e => { const k = e.dataset.k; if (v[k] === undefined) return; if (e.dataset.t === 'm' || e.dataset.t === 'n') { const num = v[k].replace(/[^\d]/g, ''); if (!num) return; e.value = num; } else e.value = v[k]; e.closest('label').classList.add('ar-ia'); e.dispatchEvent(new Event('input', { bubbles: true })); n++; });
      msg.textContent = n ? `✅ ${n} champ(s) pré-rempli(s) (en violet). Relisez et complétez avant de générer.` : 'L\'IA n\'a trouvé aucune information fiable : ajoutez des détails (noms, dates, motif).';
      if (window.SAMASSA_ANALYTICS) SAMASSA_ANALYTICS.track('writer', 'pré-remplissage IA', n ? 'success' : 'error', { model: modele.titre });
    } catch (e) { msg.textContent = '⚠️ Assistant indisponible : ' + e.message; }
    btn.disabled = false;
  }
  function panneauForm() {
    document.querySelectorAll('.ar-form').forEach(x => x.remove());
    const b = document.createElement('div'); b.className = 'ar-box ar-form';
    b.innerHTML = '<b>✨ Remplir avec l\'IA</b><textarea id="arPhrase" maxlength="1200" placeholder="Décrivez votre situation : qui, quoi, quand, pourquoi… (ex. : Awa Traoré demande 10 jours de congé à partir du 3 novembre pour un mariage familial)"></textarea><div class="row"><button type="button" class="btn" id="arGo">Pré-remplir le formulaire</button></div><div class="ar-msg" id="arMsg" aria-live="polite"></div>';
    $q('#champs').before(b);
    $q('#arGo').onclick = () => preRemplir($q('#arPhrase').value, $q('#arMsg'), $q('#arGo'));
    if (window.__arPhraseAccueil) { $q('#arPhrase').value = window.__arPhraseAccueil; window.__arPhraseAccueil = ''; if (navigator.onLine) $q('#arGo').click(); }
  }
  const ouvrirAvant = ouvrir;
  ouvrir = function (i) { ouvrirAvant(i); panneauForm(); };

  /* --- Accueil : « Décrivez votre besoin » --- */
  const boite = document.createElement('div'); boite.className = 'ar-box';
  boite.innerHTML = '<b>🔎 Que voulez-vous rédiger ?</b><textarea id="arBesoin" maxlength="400" placeholder="Ex. : demande de congé pour un mariage · facture pour un client · attestation de résidence…"></textarea><div class="row"><button type="button" class="btn" id="arChercher">Trouver le bon modèle</button></div><div class="ar-sug row" id="arSug" aria-live="polite"></div>';
  $q('#recherche').before(boite);
  $q('#arChercher').onclick = () => {
    const phrase = $q('#arBesoin').value, ids = classer(MODELES, phrase, 4), z = $q('#arSug'); z.textContent = '';
    if (!ids.length) { z.textContent = phrase.trim() ? 'Aucun modèle trouvé : essayez d\'autres mots, ou parcourez les catégories ci-dessous.' : ''; return; }
    ids.forEach(i => { const b = document.createElement('button'); b.type = 'button'; b.textContent = '📄 ' + MODELES[i].titre; b.onclick = () => { window.__arPhraseAccueil = phrase.length > 25 ? phrase : ''; ouvrir(i); }; z.appendChild(b); });
  };
  $q('#arBesoin').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $q('#arChercher').click(); } });
})();
