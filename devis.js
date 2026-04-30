/* ============================================================
   SAMASSA TECHNOLOGIE — devis.js v2.0
   Logique complète du module Devis
   ============================================================ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  ST.setTodayDate('quoteDate');
  ST.setDatePlus('validityDate', 30);
  ST.el('quoteNumber').value = ST.nextNumber('samassa_devis', 'DEV-');
  recalc();
  document.addEventListener('itemsChanged', recalc);
});

function recalc() {
  const ht  = ST.calcItems();
  const tva = ht * 0.18;
  const ttc = ht + tva;
  const set = (id, v) => { const e = ST.el(id); if (e) e.value = v + ' FCFA'; };
  set('totalHT',  ST.fmtNum(ht));
  set('totalTVA', ST.fmtNum(tva));
  set('totalTTC', ST.fmtNum(ttc));
}

function addItem()       { const r = ST.buildItemRow(true); document.getElementById('itemsContainer').appendChild(r); recalc(); }
function removeItem(btn) { ST.removeItem(btn); }

function generateQuote() {
  recalc();
  const v = ST.v;

  ST.el('d-coName').textContent  = v('companyName');
  ST.el('d-coTag').textContent   = v('companyTagline');
  ST.el('d-coAddr').innerHTML    = ST.nl2br(v('companyAddress'));
  ST.el('d-coPhone').textContent = v('companyPhone');
  ST.el('d-coEmail').textContent = v('companyEmail');
  ST.el('d-num').textContent     = v('quoteNumber');
  ST.el('d-date').textContent    = ST.fmtDate(v('quoteDate'));
  ST.el('d-client').textContent  = v('clientName') || '—';
  ST.el('d-manager').textContent = v('managerName');
  ST.el('d-validity').textContent = ST.fmtDate(v('validityDate'));

  const tbody = ST.el('d-items');
  tbody.innerHTML = '';
  let ht = 0;
  document.querySelectorAll('.item-row').forEach(r => {
    const ins   = r.querySelectorAll('.item-inputs input');
    const desc  = ins[0].value;
    const qty   = parseFloat(ins[1].value) || 0;
    const price = parseFloat(ins[2].value) || 0;
    const total = qty * price;
    const rem   = r.querySelector('.item-remark input')?.value || '';
    ht += total;
    tbody.innerHTML += `
      <tr>
        <td>${desc}</td>
        <td>${qty}</td>
        <td>${ST.fmtNum(price)} F</td>
        <td>${ST.fmtNum(total)} F</td>
        <td style="font-size:11px;color:#8099B0">${rem}</td>
      </tr>`;
  });
  const tva = ht * 0.18, ttc = ht + tva;
  ST.el('d-ht').textContent  = ST.fmt(ht);
  ST.el('d-tva').textContent = ST.fmt(tva);
  ST.el('d-ttc').textContent = ST.fmt(ttc);

  ST.showDoc();
}

function printDoc() {
  if (ST.el('docInner').style.display === 'none') generateQuote();
  setTimeout(() => window.print(), 150);
}

function saveDoc() {
  if (ST.el('docInner').style.display === 'none') generateQuote();
  const ttc = parseFloat(ST.v('totalTTC').replace(/\D/g, '')) || 0;
  if (!ttc) { ST.toast('Générez d\'abord le devis.', 'error'); return; }
  const num = ST.v('quoteNumber');
  const list = JSON.parse(localStorage.getItem('samassa_devis') || '[]');
  if (list.find(d => d.number === num)) {
    ST.toast('Devis ' + num + ' déjà enregistré.', 'info'); return;
  }
  list.push({ number: num, client: ST.v('clientName'), date: ST.fmtDate(ST.v('quoteDate')), validite: ST.fmtDate(ST.v('validityDate')), total: ttc, statut: 'En cours', timestamp: new Date().toISOString() });
  localStorage.setItem('samassa_devis', JSON.stringify(list));
  ST.toast('Devis ' + num + ' enregistré ✓', 'success');
  ST.el('quoteNumber').value = ST.nextNumber('samassa_devis', 'DEV-');
}

function shareWhatsApp() {
  if (ST.el('docInner').style.display === 'none') generateQuote();
  const cl  = ST.v('clientName') || 'Client';
  const ttc = ST.v('totalTTC');
  const msg =
`*SAMASSA TECHNOLOGIE*
_Tout pour l'informatique_

Bonjour *${cl}*,

📋 *Devis N° ${ST.v('quoteNumber')}*
📅 Date : ${ST.fmtDate(ST.v('quoteDate'))}
⏳ Valable jusqu'au : ${ST.fmtDate(ST.v('validityDate'))}
💰 Total TTC : *${ttc}*

Ce devis est établi sous réserve d'acceptation.
Pour toute question, n'hésitez pas à nous contacter.

Merci pour votre confiance ! 🙏
📞 77 29 19 31  /  62 97 06 30
📧 samassatechnologie10@gmail.com`;
  ST.openWhatsApp(msg);
}
