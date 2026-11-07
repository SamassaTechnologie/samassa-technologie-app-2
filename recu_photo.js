/* SAMASSA TECHNOLOGIE — Reçu Photos d'identité (ticket 80 mm) */
'use strict';
function lireLignes() {
  const lignes = []; let total = 0;
  document.querySelectorAll('#itemsContainer .item-row').forEach(r => {
    const i = r.querySelectorAll('.item-inputs input'), q = parseFloat(i[1].value) || 0, p = parseFloat(i[2].value) || 0;
    if (!i[0].value.trim() && !(q * p)) return; total += q * p; lignes.push({ desc: i[0].value.trim(), qte: q, pu: p, total: q * p });
  });
  return { lignes, total };
}
function recalc() { const t = ST.calcItems(); ST.el('totalAmount').value = ST.fmt(t); }
function addItem(desc, qty, prix) {
  const r = ST.buildItemRow(false), i = r.querySelectorAll('.item-inputs input');
  if (desc) i[0].value = desc; if (qty) i[1].value = qty; if (prix) i[2].value = prix;
  document.getElementById('itemsContainer').appendChild(r); recalc();
}
function libelleFormat(f, nb) { return "Photos d'identité " + f.pays + ' — ' + f.doc + ' ' + f.w + '×' + f.h + ' mm' + (nb ? ' (' + nb + ' photos)' : ''); }
function generateReceipt() { recalc(); ST.showDoc(); }
function printDoc() { if (ST.el('docInner').style.display === 'none') generateReceipt(); SamassaPrint(); }
function saveDoc() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();
  const { lignes, total } = lireLignes(); if (!total) { ST.toast('Le montant est vide.', 'error'); return; }
  const num = ST.v('receiptNumber'), client = (ST.v('clientFirstName') + ' ' + ST.v('clientLastName')).trim() || 'Client comptoir', iso = ST.v('receiptDate'), mode = ST.v('paymentMethod');
  const liste = JSON.parse(localStorage.getItem('samassa_recus_photo') || '[]');
  if (liste.some(x => x.number === num)) { ST.toast('Ce reçu est déjà enregistré.', 'error'); return; }
  const ts = new Date().toISOString();
  liste.push({ number: num, client, phone: ST.v('clientPhone') || '', date: ST.fmtDate(iso), total, mode, statut: 'Payé', services: lignes.map(l => ({ desc: l.desc, qty: l.qte, price: l.pu })), timestamp: ts });
  localStorage.setItem('samassa_recus_photo', JSON.stringify(liste));
  const caisse = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]');
  caisse.push({ id: 'PH-' + Date.now(), date: iso, type: 'entree', desc: 'Reçu ' + num + ' — ' + client, amount: total, pm: mode, cat: 'Vente service', auto: true, timestamp: ts });
  localStorage.setItem('samassa_mouvements', JSON.stringify(caisse));
  ST.toast('Reçu enregistré ✓  —  +' + ST.fmtNum(total) + ' FCFA ajouté à la caisse 💰', 'success');
}
document.addEventListener('DOMContentLoaded', () => {
  ST.setTodayDate('receiptDate');
  ST.el('receiptNumber').value = ST.nextNumber('samassa_recus_photo', 'REP-');
  document.addEventListener('itemsChanged', recalc);
  document.getElementById('itemsContainer').addEventListener('input', recalc);
  const sel = document.getElementById('fmtSel');
  window.PhotoFormats.FORMATS.forEach(f => { const o = document.createElement('option'); o.value = f.id; o.textContent = f.pays + ' — ' + f.doc + ' (' + f.w + '×' + f.h + ')'; sel.appendChild(o); });
  sel.addEventListener('change', () => { const f = window.PhotoFormats.FORMATS[+sel.value]; if (f) { addItem(libelleFormat(f, 0), 1, 0); sel.value = ''; } });
  const p = new URLSearchParams(location.search), f = window.PhotoFormats.FORMATS[+p.get('fmt')];
  if (p.has('fmt') && f) { addItem(libelleFormat(f, +p.get('nb') || 0), 1, Math.round(+p.get('prix')) || 0); if (['Espèces', 'Wave', 'Orange Money', 'Moov Money'].includes(p.get('pm'))) ST.el('paymentMethod').value = p.get('pm'); }
  else addItem("Photos d'identité", 1, 0);
});
