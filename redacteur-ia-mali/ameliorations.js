/* ==================================================================
   RÉDACTEUR IA – MALI  |  ameliorations.js  (v1.0)
   Ajoute, sans toucher au fonctionnement existant :
   1. Bouton « Retour » du téléphone : revient à la liste au lieu de quitter l'application
   2. Totaux de la facture en direct (HT, TVA, TTC + montant en lettres)
   3. Montant en lettres affiché sous chaque champ « F CFA »
   4. Champs vides signalés à la génération (sans bloquer)
   5. Raccourcis clavier : Ctrl+Entrée = Générer, Ctrl+P = Imprimer (compté)
   6. Avis « nouvelle version disponible » après une mise à jour du site
   7. Indicateur « hors ligne »
   À charger APRÈS fonctions-plus.js.
   ================================================================== */
(function () {
  'use strict';
  if (typeof MODELES === 'undefined' || window.__ameliorations) return;
  window.__ameliorations = true;

  const css = document.createElement('style');
  css.textContent = [
    '.am-total{background:var(--clair);border:1px solid var(--bord);border-radius:8px;padding:8px 12px;margin-top:8px;font-size:.9rem}',
    '.am-total b{color:var(--b)}',
    '.am-total small{display:block;color:#5b6b79;margin-top:2px}',
    '.am-lettres{color:#5b6b79;font-size:.78rem;font-style:italic;min-height:1em}',
    '.champ .vide{border-color:#e0a800;background:#fffbea}',
    '.am-note{background:#fff8e1;border:1px solid #f0d78c;border-radius:8px;padding:8px 12px;margin:8px 0;font-size:.9rem}',
    '.am-toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#1b2a38;color:#fff;border-radius:8px;padding:10px 14px;display:flex;gap:10px;align-items:center;z-index:50;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:calc(100% - 32px)}',
    '.am-toast .btn{padding:5px 10px;font-size:.85rem}',
    '.am-horsligne{background:#fdecea;color:#b33;padding:6px 10px;border-radius:20px;font-size:.85rem}'
  ].join('');
  document.head.appendChild(css);

  const enForm = () => !$('#vueForm').hidden;

  /* ---------- 1. Bouton « Retour » du téléphone ---------- */
  const ouvrirBase = ouvrir;
  ouvrir = function (i) {
    ouvrirBase(i);
    if (history.state && history.state.form) history.replaceState({form: 1}, '');
    else history.pushState({form: 1}, '');
    $$('.am-note').forEach(n => n.remove());
    majTotal(); majLettres();
  };
  const versAccueil = () => { $('#vueForm').hidden = true; $('#vueAccueil').hidden = false; };
  window.addEventListener('popstate', () => { if (enForm()) versAccueil(); });
  $('#btnRetour').onclick = () => { if (history.state && history.state.form) history.back(); else versAccueil(); };

  /* ---------- 2. Totaux de la facture en direct ---------- */
  function majTotal() {
    const ancien = $('.am-total'); if (ancien) ancien.remove();
    if (!modele || modele.type !== 'f' || modele.noprix || !$('#lignes')) return;
    let ht = 0;
    $$('#lignes .ligne').forEach(r => {
      const q = parseFloat(r.querySelector('.lq').value) || 0, p = r.querySelector('.lp') ? parseFloat(r.querySelector('.lp').value) || 0 : 0;
      ht += q * p;
    });
    const e = $('#champs [data-k="TVA"]'), tva = e ? parseFloat(e.value) || 0 : 0;
    const tv = Math.round(ht * tva / 100), ttc = ht + tv;
    const z = document.createElement('div'); z.className = 'am-total';
    z.innerHTML = (tva ? 'Total HT : <b>' + fmt(ht) + ' F</b> – TVA ' + tva + ' % : <b>' + fmt(tv) + ' F</b> – Total TTC : ' : 'Net à payer : ') +
      '<b>' + fmt(ttc) + ' F CFA</b><small>' + esc(enLettres(ttc)) + ' francs CFA</small>';
    $('#btnLigne').after(z);
  }

  /* ---------- 3. Montant en lettres sous les champs « m » ---------- */
  function majLettres() {
    $$('#champs [data-t="m"]').forEach(e => {
      let s = e.nextElementSibling;
      if (!s || !s.classList.contains('am-lettres')) { s = document.createElement('span'); s.className = 'am-lettres'; e.after(s); }
      s.textContent = e.value.trim() ? enLettres(e.value) + ' francs CFA' : '';
    });
  }

  $('#champs').addEventListener('input', e => {
    if (e.target.classList) e.target.classList.remove('vide');
    if (e.target.dataset && e.target.dataset.t === 'm') majLettres();
    majTotal();
  });
  $('#champs').addEventListener('change', majTotal);
  $('#champs').addEventListener('click', e => { if (e.target.closest('.x, #btnLigne')) setTimeout(majTotal, 0); });

  /* ---------- 4. Champs vides signalés (sans bloquer) ---------- */
  const genBase = $('#btnGen').onclick;
  $('#btnGen').onclick = function () {
    $$('.am-note').forEach(n => n.remove());
    const vides = $$('#champs [data-k]').filter(e => !e.value.trim() && !/^(REF|PJ|ADRESSE_CL|NIF_CL)$/.test(e.dataset.k));
    vides.forEach(e => e.classList.add('vide'));
    genBase.apply(this, arguments);
    if (vides.length) {
      const n = document.createElement('div'); n.className = 'am-note';
      n.textContent = vides.length + ' champ(s) vide(s), surligné(s) en jaune : ils apparaissent en pointillés (……………) pour être remplis à la main.';
      $('#apercu').before(n);
    }
  };

  /* ---------- 5. Raccourcis clavier ---------- */
  document.addEventListener('keydown', e => {
    if (!enForm() || !(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'Enter') { e.preventDefault(); $('#btnGen').click(); }
    else if ((e.key === 'p' || e.key === 'P') && !$('#btnPrint').hidden) { e.preventDefault(); $('#btnPrint').click(); }
  });

  /* ---------- 6. Nouvelle version disponible ---------- */
  function toast(html, actions) {
    const t = document.createElement('div'); t.className = 'am-toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + html + '</span>';
    actions.forEach(([lib, fn, cls]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = lib;
      b.onclick = () => { t.remove(); if (fn) fn(); }; t.appendChild(b);
    });
    document.body.appendChild(t);
  }
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    let vu = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (vu) return; vu = true;
      toast('Nouvelle version de l\'application installée.', [['Recharger', () => location.reload()], ['Plus tard', null, 'sec']]);
    });
  }

  /* ---------- 7. Indicateur hors ligne ---------- */
  const hl = document.createElement('span'); hl.className = 'am-horsligne'; hl.textContent = '⚠ Hors ligne'; hl.title = 'Tout fonctionne, sauf l\'assistant IA';
  $('.cyber').prepend(hl);
  const majReseau = () => { hl.hidden = navigator.onLine; };
  window.addEventListener('online', majReseau); window.addEventListener('offline', majReseau); majReseau();
})();
