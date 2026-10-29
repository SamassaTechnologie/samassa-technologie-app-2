/* ==================================================================
   piece-id.js (v1.0) : type de pièce d'identité, validation et analyse du contenu scanné
   - Choix du type de pièce (NINA biométrique, NINA, carte d'identité biométrique, passeport…)
   - Libellés et aides adaptés au type ; contrôle du numéro (avertissement, jamais bloquant)
   - Analyse prudente du contenu d'un QR code / code-barres : on ne devine pas, on propose
   - Téléphone : mise en forme malienne (+223 XX XX XX XX)
   Aucune dépendance. Utilisé par recu.html, recu.js et scanner.js.
   ================================================================== */
(function () {
  'use strict';
  if (window.PieceID) return;

  // pattern : contrôle souple du numéro. codes : true = on tente aussi les codes-barres (PDF417, Code128…)
  const TYPES = {
    nina:      { label: 'Carte NINA',                          court: 'NINA',        num: 'N° NINA',        ph: 'Ex : 197CI901041009A', pattern: /^[A-Z0-9]{10,20}$/, codes: false, service: 'Scan Carte NINA' },
    nina_bio:  { label: 'Carte NINA biométrique',              court: 'NINA bio.',   num: 'N° NINA',        ph: 'Ex : 197CI901041009A', pattern: /^[A-Z0-9]{10,20}$/, codes: true,  service: 'Scan Carte NINA biométrique' },
    cni_bio:   { label: 'Carte d\'identité biométrique',       court: 'CNI bio.',    num: 'N° de la carte', ph: 'N° imprimé sur la carte', pattern: /^[A-Z0-9]{6,20}$/, codes: true, service: 'Scan carte d\'identité biométrique' },
    consulaire:{ label: 'Carte consulaire biométrique',        court: 'Consulaire',  num: 'N° de la carte', ph: 'N° imprimé sur la carte', pattern: /^[A-Z0-9]{6,20}$/, codes: true, service: 'Scan carte consulaire' },
    passeport: { label: 'Passeport',                           court: 'Passeport',   num: 'N° de passeport',ph: 'Ex : A1234567',          pattern: /^[A-Z0-9]{6,12}$/,  codes: true,  service: 'Scan passeport' },
    electeur:  { label: 'Carte d\'électeur biométrique',       court: 'Électeur',    num: 'N° de la carte', ph: 'N° imprimé sur la carte', pattern: /^[A-Z0-9]{6,20}$/, codes: true, service: 'Scan carte d\'électeur' },
    permis:    { label: 'Permis de conduire',                  court: 'Permis',      num: 'N° de permis',   ph: 'N° imprimé sur le permis', pattern: /^[A-Z0-9\/-]{5,20}$/, codes: true, service: 'Scan permis de conduire' },
    autre:     { label: 'Autre pièce',                         court: 'Autre',       num: 'N° de la pièce', ph: 'N° de la pièce',         pattern: null,                codes: true,  service: 'Scan de document' }
  };
  const ORDRE = ['nina', 'nina_bio', 'cni_bio', 'consulaire', 'passeport', 'electeur', 'permis', 'autre'];
  const CLE = 'samassa_piece_type';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s == null ? '' : s).toUpperCase().replace(/[\s.\-_/]+/g, '');   // numéro comparable
  const nettoyer = s => String(s == null ? '' : s).toUpperCase().replace(/\s+/g, '');

  function typeCourant() {
    let t = null; try { t = localStorage.getItem(CLE); } catch (e) {}
    return TYPES[t] ? t : 'nina';
  }
  function definirType(t) { if (!TYPES[t]) t = 'nina'; try { localStorage.setItem(CLE, t); } catch (e) {} return t; }
  const info = t => TYPES[t] || TYPES.nina;

  // Contrôle du numéro : renvoie {etat:'vide'|'ok'|'doute', message}
  function verifierNumero(valeur, type) {
    const v = nettoyer(valeur), p = info(type).pattern;
    if (!v) return { etat: 'vide', message: '' };
    if (!p) return { etat: 'ok', message: '' };
    return p.test(v) ? { etat: 'ok', message: 'Format plausible' } : { etat: 'doute', message: 'Format inhabituel : vérifiez le numéro sur la carte' };
  }

  // Téléphone malien : 8 chiffres (indicatif +223 facultatif). Renvoie {texte, valide}
  function normaliserTel(brut) {
    let d = String(brut || '').replace(/[^\d+]/g, '');
    if (!d) return { texte: '', valide: true, vide: true };
    d = d.replace(/^\+/, '').replace(/^00/, '');
    if (d.startsWith('223') && d.length === 11) d = d.slice(3);
    if (/^\d{8}$/.test(d)) return { texte: '+223 ' + d.replace(/(\d{2})(?=\d)/g, '$1 ').trim(), valide: true };
    return { texte: String(brut).trim(), valide: false };
  }

  /* ---------- Analyse du contenu d'un QR code / code-barres ----------
     Retourne { type, numero, nom, prenom, phone, candidats:[numéros possibles], url, raw }
     « numero » n'est renseigné que s'il est reconnu avec une confiance raisonnable. */
  const CLES = {
    numero: ['NINA', 'NNI', 'NUMERO', 'NUM', 'NO', 'ID', 'IDNUMBER', 'DOCUMENTNUMBER', 'NUMEROCARTE', 'NUMEROPIECE', 'CARDNUMBER'],
    nom:    ['NOM', 'NAME', 'LASTNAME', 'LAST_NAME', 'SURNAME', 'FAMILYNAME', 'NOMDEFAMILLE'],
    prenom: ['PRENOM', 'PRENOMS', 'FIRSTNAME', 'FIRST_NAME', 'GIVENNAME', 'GIVENNAMES', 'PRENOMUSUEL'],
    phone:  ['TEL', 'TELEPHONE', 'PHONE', 'MOBILE', 'GSM']
  };
  const rangerCle = (k) => { const K = String(k).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[\s'’-]/g, ''); for (const champ in CLES) if (CLES[champ].includes(K)) return champ; return null; };
  const ressembleNumero = s => /^[A-Z0-9]{8,20}$/.test(s) && /\d/.test(s) && !/^\d{8}$/.test(s);   // 8 chiffres seuls = plutôt un téléphone
  const ressembleTel = s => /^\+?(?:00)?(?:223)?\d{8}$/.test(String(s).replace(/[\s.-]/g, ''));

  function analyser(brut) {
    const raw = String(brut == null ? '' : brut).trim().slice(0, 4000);
    const res = { raw, type: 'texte', numero: '', nom: '', prenom: '', phone: '', candidats: [], url: '' };
    if (!raw) return res;
    const ajouterCandidat = v => { v = nettoyer(v); if (ressembleNumero(v) && !res.candidats.includes(v)) res.candidats.push(v); };
    const poser = (champ, val) => {
      val = String(val == null ? '' : val).trim(); if (!val) return;
      if (champ === 'numero') { const n = nettoyer(val); ajouterCandidat(n); if (!res.numero && /^[A-Z0-9]{5,25}$/.test(n)) res.numero = n; }
      else if (champ === 'phone') { if (!res.phone) res.phone = val; }
      else if (!res[champ]) res[champ] = val.slice(0, 60);
    };

    // 1) Adresse web : on n'utilise jamais l'adresse comme numéro ; on lit seulement ses paramètres
    if (/^https?:\/\//i.test(raw)) {
      res.type = 'url'; res.url = raw.slice(0, 200);
      try { new URL(raw).searchParams.forEach((v, k) => { const c = rangerCle(k); if (c) poser(c, v); }); } catch (e) {}
      return res;
    }
    // 2) JSON
    if (/^[\[{]/.test(raw)) {
      try {
        let obj = JSON.parse(raw); if (Array.isArray(obj)) obj = obj[0] || {};
        if (obj && typeof obj === 'object') {
          res.type = 'json';
          Object.keys(obj).forEach(k => { const c = rangerCle(k); if (c && typeof obj[k] !== 'object') poser(c, obj[k]); });
          return res;
        }
      } catch (e) {}
    }
    // 3) Lignes « clé = valeur » ou « clé : valeur »
    const morceaux = raw.split(/[\r\n;|&]+/).map(x => x.trim()).filter(Boolean);
    let nbCles = 0;
    morceaux.forEach(m => {
      const kv = /^([A-Za-zÀ-ÿ'’ _-]{2,25})\s*[=:]\s*(.+)$/.exec(m);
      if (kv) { const c = rangerCle(kv[1]); if (c) { poser(c, kv[2]); nbCles++; } }
    });
    if (nbCles) { res.type = 'cles'; return res; }
    // 4) Liste de valeurs : on classe chaque valeur sans rien inventer
    const valeurs = raw.split(/[\r\n;|,\t]+/).map(x => x.trim()).filter(Boolean);
    res.type = valeurs.length > 1 ? 'liste' : 'texte';
    valeurs.forEach(v => {
      const n = nettoyer(v);
      if (ressembleTel(v)) poser('phone', v);
      else if (ressembleNumero(n)) ajouterCandidat(n);
      else if (/^[A-ZÀ-Ý][A-ZÀ-Ý' -]{1,40}$/.test(v)) poser('nom', v);
      else if (/^[A-ZÀ-Ý][a-zà-ÿ' -]{1,40}$/.test(v)) poser('prenom', v);
    });
    if (res.candidats.length === 1) res.numero = res.candidats[0];
    return res;
  }

  /* ---------- Branchement du formulaire (recu.html) ---------- */
  function brancherFormulaire() {
    const sel = document.getElementById('idType'); if (!sel) return;
    sel.innerHTML = ORDRE.map(t => '<option value="' + t + '">' + esc(TYPES[t].label) + '</option>').join('');
    sel.value = typeCourant();
    const champ = document.getElementById('clientNina'), lib = document.getElementById('ninaLabel'), aide = document.getElementById('ninaHint'),
          etat = document.getElementById('ninaState'), tel = document.getElementById('clientPhone'), telEtat = document.getElementById('phoneState');
    function majType() {
      const i = info(sel.value);
      if (lib) lib.textContent = i.num;
      if (champ) champ.placeholder = i.ph;
      if (aide) aide.textContent = 'Scannez le code de la carte ou saisissez le numéro. Vous pourrez vérifier avant de remplir le reçu.';
      majEtat();
      // suggère le libellé du service si la ligne n'a pas été modifiée à la main
      const ligne = document.querySelector('#itemsContainer .item-row .item-inputs input');
      if (ligne && (ligne.dataset.auto === '1' || !ligne.value || Object.keys(TYPES).some(t => TYPES[t].service === ligne.value))) { ligne.value = i.service; ligne.dataset.auto = '1'; ligne.addEventListener('input', () => { ligne.dataset.auto = '0'; }, { once: true }); }
    }
    function majEtat() {
      if (!champ || !etat) return;
      const r = verifierNumero(champ.value, sel.value);
      etat.textContent = r.etat === 'ok' ? '✓ ' + r.message : r.etat === 'doute' ? '⚠ ' + r.message : '';
      etat.style.color = r.etat === 'ok' ? '#15803D' : '#B45309';
    }
    function majTel() {
      if (!tel || !telEtat) return;
      const r = normaliserTel(tel.value);
      telEtat.textContent = r.vide ? '' : r.valide ? '✓ ' + r.texte : '⚠ Numéro malien attendu : 8 chiffres';
      telEtat.style.color = r.valide ? '#15803D' : '#B45309';
    }
    sel.addEventListener('change', () => { definirType(sel.value); majType(); });
    if (champ) { champ.addEventListener('input', majEtat); champ.addEventListener('blur', () => { champ.value = nettoyer(champ.value); majEtat(); }); }
    if (tel) { tel.addEventListener('input', majTel); tel.addEventListener('blur', () => { const r = normaliserTel(tel.value); if (r.valide && r.texte) tel.value = r.texte; majTel(); }); }
    majType(); majTel();
  }

  window.PieceID = { TYPES, ORDRE, typeCourant, definirType, info, verifierNumero, normaliserTel, analyser, esc, nettoyer, norm, brancherFormulaire };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancherFormulaire); else brancherFormulaire();
  }
})();
