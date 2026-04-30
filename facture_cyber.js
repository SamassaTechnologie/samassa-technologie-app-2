/* ============================================================
   SAMASSA TECHNOLOGIE — facture_cyber.js v2.2
   Facture Cyber Café : même logique que facture.js
   • Numérotation propre FCY-XXX
   • Raccourcis services cyber café
   • TVA 18%, WhatsApp
   ============================================================ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  ST.setTodayDate('invoiceDate');
  ST.el('invoiceNumber').value = ST.nextNumber('samassa_factures_cyber', 'FCY-');
  recalc();
  document.addEventListener('itemsChanged', recalc);
});

/* ── Recalcul totaux (identique à facture.js) ── */
function recalc() {
  const ht  = ST.calcItems();
  const tva = ht * 0.18;
  const ttc = ht + tva;
  const set = (id, v) => { const e = ST.el(id); if (e) e.value = v; };
  set('totalHT',  ST.fmtNum(ht)  + ' FCFA');
  set('totalTVA', ST.fmtNum(tva) + ' FCFA');
  set('totalTTC', ST.fmtNum(ttc) + ' FCFA');
}

/* ── Gestion lignes ── */
function addItem() {
  const r = ST.buildItemRow(true);
  document.getElementById('itemsContainer').appendChild(r);
  recalc();
}

function removeItem(btn) { ST.removeItem(btn); }

/* ── Raccourci catalogue cyber café ── */
function addQuick(desc, qty, price) {
  const container = document.getElementById('itemsContainer');
  const r = ST.buildItemRow(true);
  const ins = r.querySelectorAll('.item-inputs input');
  ins[0].value = desc;
  ins[1].value = qty;
  ins[2].value = price;
  ins[3].value = qty * price;
  container.appendChild(r);
  recalc();
  container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Générer la facture ── */
function generateInvoice() {
  recalc();
  const v = ST.v;

  ST.el('d-coName').textContent  = v('companyName');
  ST.el('d-coTag').textContent   = v('companyTagline');
  ST.el('d-coAddr').innerHTML    = ST.nl2br(v('companyAddress'));
  ST.el('d-coPhone').textContent = v('companyPhone');
  ST.el('d-coEmail').textContent = v('companyEmail');
  ST.el('d-num').textContent     = v('invoiceNumber');
  ST.el('d-date').textContent    = ST.fmtDate(v('invoiceDate'));
  ST.el('d-client').textContent  = v('clientName') || '—';
  ST.el('d-manager').textContent = v('managerName');

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

/* ── Imprimer ── */
function printDoc() {
  if (ST.el('docInner').style.display === 'none') generateInvoice();
  setTimeout(() => window.print(), 150);
}

/* ── Enregistrer ── */
function saveDoc() {
  if (ST.el('docInner').style.display === 'none') generateInvoice();
  const ttcRaw = parseFloat(ST.v('totalTTC').replace(/\D/g, '')) || 0;
  if (!ttcRaw) { ST.toast('Générez d\'abord la facture.', 'error'); return; }
  const num = ST.v('invoiceNumber');
  const list = JSON.parse(localStorage.getItem('samassa_factures_cyber') || '[]');
  if (list.find(f => f.number === num)) {
    ST.toast('Facture ' + num + ' déjà enregistrée.', 'info'); return;
  }
  list.push({ number: num, client: ST.v('clientName'), date: ST.fmtDate(ST.v('invoiceDate')), total: ttcRaw, statut: 'En attente', timestamp: new Date().toISOString() });
  localStorage.setItem('samassa_factures_cyber', JSON.stringify(list));
  ST.toast('Facture Cyber ' + num + ' enregistrée ✓', 'success');
  ST.el('invoiceNumber').value = ST.nextNumber('samassa_factures_cyber', 'FCY-');
}

/* ── WhatsApp ── */
function shareWhatsApp() {
  if (ST.el('docInner').style.display === 'none') generateInvoice();
  const cl  = ST.v('clientName') || 'Client';
  const ttc = ST.v('totalTTC');
  const msg =
`*SAMASSA TECHNOLOGIE — Cyber Café*
_Tout pour l'informatique_

Bonjour *${cl}*,

📄 *Facture Cyber N° ${ST.v('invoiceNumber')}*
📅 Date : ${ST.fmtDate(ST.v('invoiceDate'))}
💰 Total TTC : *${ttc}*

_Modes de paiement acceptés :_
🌊 Wave ⭐  |  🟠 Orange Money  |  🔵 Moov Money  |  💵 Espèces

Merci pour votre confiance ! 🙏
📞 77 29 19 31  /  62 97 06 30
📧 samassatechnologie10@gmail.com`;
  ST.openWhatsApp(msg);
}
