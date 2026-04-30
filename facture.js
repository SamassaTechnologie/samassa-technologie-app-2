/* ============================================================
   SAMASSA TECHNOLOGIE — facture.js v2.0
   Logique complète du module Facture
   ============================================================ */
'use strict';

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  ST.setTodayDate('invoiceDate');
  ST.el('invoiceNumber').value = ST.nextNumber('samassa_factures', 'FAC-');
  recalc();
  document.addEventListener('itemsChanged', recalc);
  document.querySelectorAll('.item-row .item-inputs input[type=number]').forEach(i => i.addEventListener('input', recalc));
});

/* ---- Recalcul totaux ---- */
function recalc() {
  const ht = ST.calcItems();
  const tva = ht * 0.18;
  const ttc = ht + tva;
  const fmt = n => ST.fmtNum(n);
  const set = (id, v) => { const e = ST.el(id); if (e) e.value = v; };
  set('totalHT',  fmt(ht)  + ' FCFA');
  set('totalTVA', fmt(tva) + ' FCFA');
  set('totalTTC', fmt(ttc) + ' FCFA');
}

/* ---- Ajouter article ---- */
function addItem() {
  const row = ST.buildItemRow(true);
  document.getElementById('itemsContainer').appendChild(row);
  recalc();
}

/* ---- Supprimer article ---- */
function removeItem(btn) { ST.removeItem(btn); }

/* ---- Générer la facture ---- */
function generateInvoice() {
  recalc();
  const v = ST.v;

  // En-tête société
  ST.el('d-coName').textContent    = v('companyName');
  ST.el('d-coTag').textContent     = v('companyTagline');
  ST.el('d-coAddr').innerHTML      = ST.nl2br(v('companyAddress'));
  ST.el('d-coPhone').textContent   = v('companyPhone');
  ST.el('d-coEmail').textContent   = v('companyEmail');

  // Référence
  ST.el('d-num').textContent       = v('invoiceNumber');
  ST.el('d-date').textContent      = ST.fmtDate(v('invoiceDate'));
  ST.el('d-client').textContent    = v('clientName') || '—';
  ST.el('d-manager').textContent   = v('managerName');

  // Lignes articles
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

  // Totaux
  const tva = ht * 0.18, ttc = ht + tva;
  ST.el('d-ht').textContent  = ST.fmt(ht);
  ST.el('d-tva').textContent = ST.fmt(tva);
  ST.el('d-ttc').textContent = ST.fmt(ttc);

  ST.showDoc();
}

/* ---- Imprimer ---- */
function printDoc() {
  if (ST.el('docInner').style.display === 'none') generateInvoice();
  setTimeout(() => window.print(), 150);
}

/* ---- Enregistrer ---- */
function saveDoc() {
  const ttcRaw = parseFloat(ST.v('totalTTC').replace(/\D/g, '')) || 0;
  ST.save('samassa_factures', {
    number:  ST.v('invoiceNumber'),
    client:  ST.v('clientName'),
    date:    ST.fmtDate(ST.v('invoiceDate')),
    total:   ttcRaw,
    statut:  'En attente',
  });
}

/* ---- WhatsApp ---- */
function shareWhatsApp() {
  if (ST.el('docInner').style.display === 'none') generateInvoice();
  const n   = ST.v('invoiceNumber');
  const cl  = ST.v('clientName') || 'Client';
  const ttc = ST.v('totalTTC');
  const d   = ST.fmtDate(ST.v('invoiceDate'));
  const msg =
`*SAMASSA TECHNOLOGIE*
_Tout pour l'informatique_

Bonjour *${cl}*,

📄 *Facture N° ${n}*
📅 Date : ${d}
💰 Total TTC : *${ttc}*

_Modes de paiement acceptés :_
🌊 Wave ⭐  |  🟠 Orange Money  |  🔵 Moov Money  |  💵 Espèces

Merci pour votre confiance ! 🙏
📞 77 29 19 31  /  62 97 06 30
📧 samassatechnologie10@gmail.com`;
  ST.openWhatsApp(msg);
}
