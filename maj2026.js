/* SAMASSA PRO — Mise à jour 2026 : confort de saisie sur toutes les pages.
   - bon clavier selon le champ (chiffres, téléphone, e-mail), libellés reliés aux champs
   - numéros maliens mis en forme (76 12 34 56) et signalés s'ils sont incomplets
   - clients déjà connus proposés pendant la saisie du nom : nom, prénom, téléphone et adresse se remplissent */
'use strict';
(function (root) {
  /* ---------- Fonctions pures (testées) ---------- */
  function chiffres(t) { return String(t || '').replace(/\D/g, ''); }
  function tel8(t) { var n = chiffres(t); if ((n.length === 11 && n.indexOf('223') === 0) || (n.length === 13 && n.indexOf('00223') === 0)) n = n.slice(-8); return n.length === 8 ? n : ''; }
  /* « 76123456 » → « 76 12 34 56 » ; tout autre contenu est laissé tel quel */
  function formaterTel(t) { var s = String(t || '').trim(), n = tel8(s); return n && /^[\d\s+().-]+$/.test(s) ? n.replace(/(\d\d)(?=\d)/g, '$1 ') : s; }
  function telIncomplet(t) { var s = String(t || '').trim(); if (!s || /[\/,;]/.test(s) || /^\+(?!223)/.test(s)) return false; var n = chiffres(s); return n.length > 0 && !tel8(s); }
  function sansAccent(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  /* Réunit le répertoire et les clients vus sur les documents, sans doublon (clé : téléphone, sinon nom) */
  function fusionner(src) {
    var m = {}, ordre = [];
    function ajouter(nom, prenom, tel, adresse, poids) {
      nom = String(nom || '').trim(); prenom = String(prenom || '').trim(); var complet = (prenom + ' ' + nom).trim(); if (!complet) return;
      var t = tel8(tel), k = t || sansAccent(complet), c = m[k];
      if (!c) { c = m[k] = { nom: nom, prenom: prenom, complet: complet, tel: t, adresse: String(adresse || '').trim(), poids: 0 }; ordre.push(c); }
      c.poids += poids; if (!c.adresse && adresse) c.adresse = String(adresse).trim(); if (!c.prenom && prenom) { c.prenom = prenom; c.nom = nom; c.complet = complet; }
    }
    (src.clients || []).forEach(function (c) { ajouter(c.nom, c.prenom, c.tel, c.adresse, 5); });
    (src.documents || []).forEach(function (d) { if (d && d.client) ajouter(d.client, '', d.phone || d.tel || d.clientPhone, d.address || d.adresse, 1); });
    return ordre;
  }
  function suggerer(liste, q, max) {
    var s = sansAccent(q), n = chiffres(q); if (s.length < 2) return [];
    return liste.map(function (c) { var nom = sansAccent(c.complet), inv = sansAccent(c.nom + ' ' + c.prenom); var r = nom.indexOf(s) === 0 || inv.indexOf(s) === 0 ? 3 : (nom.indexOf(s) > 0 ? 2 : (n.length >= 3 && c.tel.indexOf(n) > -1 ? 1 : 0)); return { c: c, r: r }; })
      .filter(function (x) { return x.r; }).sort(function (a, b) { return b.r - a.r || b.c.poids - a.c.poids; }).slice(0, max || 6).map(function (x) { return x.c; });
  }
  /* Raccourcis du tableau de bord : les fonctions les plus utilisées d'abord, complétées par une liste par défaut */
  var RACC_DEFAUT = ['recu.html', 'recu_vente.html', 'recu_cyber.html', 'photo-identite.html', 'stock.html', 'clients.html'];
  function raccourcis(compteurs, disponibles, n) {
    var dispo = {}; disponibles.forEach(function (h) { dispo[h] = 1; });
    var tri = Object.keys(compteurs || {}).filter(function (h) { return dispo[h] && compteurs[h] > 0; }).sort(function (a, b) { return compteurs[b] - compteurs[a] || (a < b ? -1 : 1); });
    RACC_DEFAUT.concat(disponibles).forEach(function (h) { if (dispo[h] && tri.indexOf(h) < 0) tri.push(h); });
    return tri.slice(0, n || 6);
  }
  root.Maj2026 = { raccourcis: raccourcis, formaterTel: formaterTel, telIncomplet: telIncomplet, fusionner: fusionner, suggerer: suggerer, tel8: tel8 };
  if (typeof document === 'undefined') return;

  /* ---------- Champs ---------- */
  var RE_TEL = /(phone|tel|whatsapp)/i, RE_CLIENT_TEL = /^(clientPhone|debtPhone|f-phone|supPhone|cTel|editTel|(ab|pc|pj|pr|em)-tel)$/;
  var PAIRES = [['clientLastName', 'clientFirstName', 'clientPhone', 'clientAddress'], ['clientName', null, 'clientPhone', 'clientAddress'], ['ab-client', null, 'ab-tel'], ['pc-client', null, 'pc-tel'], ['pj-client', null, 'pj-tel'], ['pr-nom', null, 'pr-tel'], ['debtClient', null, 'debtPhone'], ['f-client', null, 'f-phone']];
  var n = 0;
  function preparer(e) {
    if (e.dataset.mj) return; e.dataset.mj = '1';
    var tag = e.tagName, id = e.id || '', cle = id + ' ' + (e.name || '');
    if (tag === 'INPUT') {
      if (e.type === 'number') { if (!e.getAttribute('inputmode')) e.setAttribute('inputmode', /[.,]/.test(e.step || '') || e.step === 'any' ? 'decimal' : 'numeric'); e.addEventListener('focus', function () { try { e.select(); } catch (x) {} }); }
      else if (e.type === 'text' && RE_TEL.test(cle) && !/nina|serie|serial/i.test(cle)) { e.setAttribute('inputmode', 'tel'); e.setAttribute('autocomplete', 'off'); }
      else if (e.type === 'text' && /mail/i.test(cle)) { e.setAttribute('inputmode', 'email'); e.setAttribute('autocapitalize', 'none'); e.setAttribute('autocorrect', 'off'); }
      else if (e.type === 'text' && /(name|nom|client|technic|manager|gerant)/i.test(cle) && !/(company|biz|entreprise)/i.test(cle)) { e.setAttribute('autocapitalize', 'words'); e.setAttribute('autocorrect', 'off'); e.setAttribute('autocomplete', 'off'); e.spellcheck = false; }
      if (RE_CLIENT_TEL.test(id)) e.addEventListener('blur', function () {
        var f = formaterTel(e.value); if (f !== e.value) { e.value = f; e.dispatchEvent(new Event('input', { bubbles: true })); }
        var bad = telIncomplet(e.value), a = e.parentNode.querySelector('.mj-aide'); e.classList.toggle('mj-err', bad);
        if (bad && !a) { a = document.createElement('div'); a.className = 'mj-aide'; a.textContent = 'Un numéro malien compte 8 chiffres (ex. : 76 12 34 56).'; e.insertAdjacentElement('afterend', a); } else if (!bad && a) a.remove();
      });
    }
    /* Libellé relié au champ : toucher le libellé place le curseur, et les lecteurs d'écran l'annoncent */
    if (!e.getAttribute('aria-label') && !e.closest('label') && !(id && document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'))) {
      var g = e.closest('.form-group, .field, .il-field, .champ'), l = g && g.querySelector('label:not([for])');
      if (l && g.querySelectorAll('input:not([type=hidden]), select, textarea').length === 1) { if (!e.id) e.id = 'mj-champ-' + (++n); l.htmlFor = e.id; }
      else if (e.placeholder) e.setAttribute('aria-label', e.placeholder);
    }
  }
  function parcourir(r) { (r.querySelectorAll ? r : document).querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea').forEach(preparer); }

  /* ---------- Clients connus ---------- */
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  var cache = null;
  function clients() { if (!cache) cache = fusionner({ clients: lire('samassa_clients'), documents: [].concat(lire('samassa_recus'), lire('samassa_recus_cyber'), lire('samassa_recus_vente'), lire('samassa_recus_photo'), lire('samassa_factures'), lire('samassa_devis'), lire('samassa_bons'), lire('samassa_interventions')) }); return cache; }
  function poser(id, v) { var e = id && document.getElementById(id); if (!e || !v) return; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
  function brancher(p) {
    var e = document.getElementById(p[0]); if (!e || e.dataset.mjClient) return; e.dataset.mjClient = '1';
    var hote = e.parentNode; if (getComputedStyle(hote).position === 'static') hote.style.position = 'relative';
    var box = null; function fermer() { if (box) { box.remove(); box = null; } }
    e.addEventListener('input', function () {
      var l = suggerer(clients(), e.value); fermer(); if (!l.length) return;
      box = document.createElement('div'); box.className = 'mj-sugg'; box.setAttribute('role', 'listbox');
      l.forEach(function (c) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'option');
        b.appendChild(document.createTextNode(c.complet)); var s = document.createElement('small'); s.textContent = [c.tel ? formaterTel(c.tel) : '', c.adresse].filter(Boolean).join(' · ') || 'client déjà enregistré'; b.appendChild(s);
        b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
        b.addEventListener('click', function () {
          fermer();
          if (p[1] && document.getElementById(p[1])) { e.value = c.prenom ? c.nom : c.complet; poser(p[1], c.prenom); } else e.value = c.complet;
          e.dispatchEvent(new Event('input', { bubbles: true })); fermer();
          poser(p[2], c.tel ? formaterTel(c.tel) : ''); var ad = p[3] && document.getElementById(p[3]); if (ad && !ad.value) poser(p[3], c.adresse);
        });
        box.appendChild(b);
      });
      e.insertAdjacentElement('afterend', box);
    });
    e.addEventListener('blur', function () { setTimeout(fermer, 150); });
    e.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fermer(); });
  }
  function init() {
    parcourir(document); PAIRES.forEach(brancher);
    /* Les lignes ajoutées plus tard (articles, services…) reçoivent le même traitement */
    try { new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (x) { if (x.nodeType === 1) { if (x.matches && x.matches('input, select, textarea')) preparer(x); parcourir(x); } }); }); PAIRES.forEach(brancher); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    window.addEventListener('storage', function () { cache = null; });
    /* Tableau plus large que l'écran (facture matériel) : on le dit clairement */
    var di = document.getElementById('docInner');
    if (di) { try { new MutationObserver(function () { di.querySelectorAll('.doc-table-mat').forEach(function (t) { var prev = t.previousElementSibling, a = prev && prev.classList.contains('mj-glisser'); if (t.scrollWidth > t.clientWidth + 4) { if (!a) { var h = document.createElement('div'); h.className = 'mj-glisser'; h.textContent = '↔ Faites glisser le tableau pour voir toutes les colonnes'; t.parentNode.insertBefore(h, t); } } else if (a) prev.remove(); }); }).observe(di, { childList: true, subtree: true }); } catch (e) {} }
    /* Bouton de thème : rangé à droite du bandeau, avant le logo */
    var tb = document.querySelector('.topbar'), th = document.getElementById('theme-btn');
    if (tb && th && th.parentNode === tb) { var logo = tb.querySelector('.topbar-logo'); if (logo) tb.insertBefore(th, logo); else tb.appendChild(th); }
  }
  /* ---------- Tableau de bord : « Vos raccourcis » ---------- */
  function tableauDeBord() {
    var grille = document.querySelector('.kpi-grid'), tuiles = document.querySelectorAll('section.cat a.qa'); if (!grille || !tuiles.length) return;
    var K = 'samassa_raccourcis', cpt = {}; try { cpt = JSON.parse(localStorage.getItem(K) || '{}') || {}; } catch (e) {}
    document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a.qa'); if (!a) return; var h = a.getAttribute('href'); if (!h) return; cpt[h] = (cpt[h] || 0) + 1; try { localStorage.setItem(K, JSON.stringify(cpt)); } catch (x) {} });
    function dessiner() {
      var parHref = {}, dispo = []; tuiles.forEach(function (a) { var h = a.getAttribute('href'); if (a.dataset.cache === '1' || parHref[h]) return; parHref[h] = a; dispo.push(h); });
      var choix = raccourcis(cpt, dispo, 6), z = document.getElementById('mj-racc'); if (!choix.length) { if (z) z.remove(); return; }
      if (!z) { z = document.createElement('section'); z.id = 'mj-racc'; z.setAttribute('aria-label', 'Vos raccourcis'); grille.parentNode.insertBefore(z, grille); }
      z.innerHTML = '<div class="mj-racc-t">⚡ Vos raccourcis <small>les fonctions que vous utilisez le plus</small></div><div class="mj-racc-g"></div>';
      var g = z.querySelector('.mj-racc-g'); choix.forEach(function (h) { var c = parHref[h].cloneNode(true); c.removeAttribute('data-filtre'); c.style.display = ''; g.appendChild(c); });
    }
    dessiner(); setTimeout(dessiner, 1500);   /* après l'application des droits de l'utilisateur */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); tableauDeBord(); }); else { init(); tableauDeBord(); }
})(typeof window !== 'undefined' ? window : globalThis);
