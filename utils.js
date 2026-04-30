/* ============================================================
   SAMASSA TECHNOLOGIE — Utilitaires partagés v2.0
   ============================================================ */

'use strict';

/* ---- Formatage ---- */
const ST = {

  fmt: (n) => Math.round(n).toLocaleString('fr-FR') + ' FCFA',
  fmtNum: (n) => Math.round(n).toLocaleString('fr-FR'),
  v: (id) => document.getElementById(id)?.value ?? '',
  el: (id) => document.getElementById(id),

  /* ---- Toast notification ---- */
  toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '0', 2700);
    setTimeout(() => t.remove(), 3100);
  },

  /* ---- Calcul items ---- */
  calcItems(containerSelector = '#itemsContainer') {
    let ht = 0;
    document.querySelectorAll(containerSelector + ' .item-row').forEach(r => {
      const ins = r.querySelectorAll('.item-inputs input');
      const q = parseFloat(ins[1]?.value) || 0;
      const p = parseFloat(ins[2]?.value) || 0;
      const t = q * p;
      if (ins[3]) ins[3].value = t;
      ht += t;
    });
    return ht;
  },

  /* ---- Ajouter une ligne article ---- */
  buildItemRow(withRemark = true) {
    const d = document.createElement('div');
    d.className = 'item-row';
    d.innerHTML = `
      <div class="item-inputs">
        <input type="text" placeholder="Description">
        <input type="number" placeholder="Qté" value="1" min="1">
        <input type="number" placeholder="Prix unit." value="0" min="0">
        <input type="number" placeholder="Total" readonly>
      </div>
      ${withRemark ? '<div class="item-remark"><input type="text" placeholder="Remarques (optionnel)"></div>' : ''}
      <button class="remove-btn" onclick="ST.removeItem(this)" title="Supprimer la ligne">✕</button>`;
    return d;
  },

  removeItem(btn) {
    const rows = document.querySelectorAll('.item-row');
    if (rows.length <= 1) { ST.toast('Au moins un article est requis.', 'error'); return; }
    btn.closest('.item-row').remove();
    document.dispatchEvent(new Event('itemsChanged'));
  },

  /* ---- Sélection mode de paiement ---- */
  initPaymentPicker(defaultMode = 'Wave') {
    const selMap = { Wave: 'selected', 'Orange Money': 'sel-orange', 'Moov Money': 'sel-moov', Espèces: 'sel-cash' };
    let current = defaultMode;
    document.querySelectorAll('.pm-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.pm-option').forEach(o => o.classList.remove(...Object.values(selMap)));
        const mode = opt.dataset.pm;
        opt.classList.add(selMap[mode] || 'selected');
        current = mode;
        const inp = document.getElementById('paymentMethod');
        if (inp) inp.value = mode;
      });
    });
    // Sélectionner le défaut
    const defaultOpt = document.querySelector(`[data-pm="${defaultMode}"]`);
    if (defaultOpt) { defaultOpt.classList.add('selected'); if (document.getElementById('paymentMethod')) document.getElementById('paymentMethod').value = defaultMode; }
    return { getMode: () => current };
  },

  /* ---- Date du jour ---- */
  setTodayDate(id) {
    const el = document.getElementById(id);
    if (el) el.value = new Date().toISOString().split('T')[0];
  },

  /* ---- Date +30 jours ---- */
  setDatePlus(id, days = 30) {
    const el = document.getElementById(id);
    if (!el) return;
    const d = new Date(); d.setDate(d.getDate() + days);
    el.value = d.toISOString().split('T')[0];
  },

  /* ---- Format date lisible ---- */
  fmtDate(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  },

  /* ---- Numéro auto (sans doublon même après suppression) ---- */
  nextNumber(key, prefix) {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    // Extraire les numéros existants pour éviter les doublons
    let maxN = 0;
    list.forEach(item => {
      const num = item.number || '';
      const match = num.replace(prefix, '').replace(/\D/g,'');
      const n = parseInt(match, 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    });
    return prefix + String(maxN + 1).padStart(3, '0');
  },

  /* ---- Sauvegarde localStorage ---- */
  save(key, record) {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push({ ...record, timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(list));
    ST.toast('Document enregistré avec succès ✓', 'success');
  },

  /* ---- WhatsApp helper ---- */
  openWhatsApp(msg, phone = '') {
    const base = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : 'https://wa.me/';
    window.open(base + '?text=' + encodeURIComponent(msg), '_blank');
  },

  /* ---- Afficher le document ---- */
  showDoc() {
    const ph = document.getElementById('placeholder');
    const di = document.getElementById('docInner');
    if (ph) ph.style.display = 'none';
    if (di) { di.style.display = 'block'; di.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  },

  /* ---- Texte → innerHTML (sauts de ligne) ---- */
  nl2br(str) { return (str || '').replace(/\n/g, '<br>'); },

  /* ---- Icônes mode paiement ---- */
  pmIcon: { Wave: '🌊', 'Orange Money': '🟠', 'Moov Money': '🔵', Espèces: '💵' },
  pmClass: { Wave: 'pm-box-wave', 'Orange Money': 'pm-box-orange', 'Moov Money': 'pm-box-moov', Espèces: 'pm-box-cash' },
};

/* ---- Recalcul automatique à la saisie ---- */
document.addEventListener('input', e => {
  if (e.target.matches('.item-row .item-inputs input[type=number]:not([readonly])')) {
    document.dispatchEvent(new Event('itemsChanged'));
  }
});
