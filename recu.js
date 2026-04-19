/* ============================================================
   SAMASSA TECHNOLOGIE — recu.js v2.0
   Logique complète du module Reçu de Paiement
   ============================================================ */
'use strict';

let selectedPM = 'Wave';

document.addEventListener('DOMContentLoaded', () => {
  ST.setTodayDate('receiptDate');
  ST.el('receiptNumber').value = ST.nextNumber('samassa_recus', 'REC-');
  recalc();
  document.addEventListener('itemsChanged', recalc);
  initPMPicker();
});

function initPMPicker() {
  const selClasses = { Wave: 'selected', 'Orange Money': 'sel-orange', 'Moov Money': 'sel-moov', Espèces: 'sel-cash' };
  document.querySelectorAll('.pm-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.pm-option').forEach(o => o.classList.remove(...Object.values(selClasses)));
      selectedPM = opt.dataset.pm;
      opt.classList.add(selClasses[selectedPM] || 'selected');
    });
  });
}

function recalc() {
  const total = ST.calcItems();
  const el = ST.el('totalAmount');
  if (el) el.value = ST.fmt(total);
}

function addItem()           { const r = ST.buildItemRow(false); document.getElementById('itemsContainer').appendChild(r); recalc(); }
function removeItem(btn)     { ST.removeItem(btn); }

function generateReceipt() {
  recalc();
  const v = ST.v;

  ST.el('d-coName').textContent    = v('companyName');
  ST.el('d-coPhone').textContent   = v('companyPhone');
  ST.el('d-coEmail').textContent   = v('companyEmail');
  ST.el('d-num').textContent       = v('receiptNumber');
  ST.el('d-date').textContent      = ST.fmtDate(v('receiptDate'));
  ST.el('d-lastName').textContent  = v('clientLastName');
  ST.el('d-firstName').textContent = v('clientFirstName');
  ST.el('d-nina').textContent      = v('clientNina') || '—';
  ST.el('d-cliPhone').textContent  = v('clientPhone') || '—';

  // Table des services
  const tbody = ST.el('d-items');
  tbody.innerHTML = '';
  let total = 0;
  document.querySelectorAll('.item-row').forEach(r => {
    const ins   = r.querySelectorAll('.item-inputs input');
    const desc  = ins[0].value;
    const qty   = parseFloat(ins[1].value) || 0;
    const price = parseFloat(ins[2].value) || 0;
    const t     = qty * price;
    total += t;
    tbody.innerHTML += `<tr><td>${desc}</td><td>${qty}</td><td>${ST.fmtNum(price)} F</td><td style="font-weight:600">${ST.fmtNum(t)} F</td></tr>`;
  });
  ST.el('d-total').textContent = ST.fmt(total);

  // Mode de paiement
  const icons  = { Wave: '🌊', 'Orange Money': '🟠', 'Moov Money': '🔵', Espèces: '💵' };
  const pmBox  = ST.el('d-pmBox');
  const pmCls  = { Wave: 'pm-box-wave', 'Orange Money': 'pm-box-orange', 'Moov Money': 'pm-box-moov', Espèces: 'pm-box-cash' };
  pmBox.className = 'pm-display-box ' + (pmCls[selectedPM] || '');
  ST.el('d-pmIcon').textContent   = icons[selectedPM] || '💵';
  ST.el('d-pmName').textContent   = selectedPM;
  ST.el('d-pmAmount').textContent = ST.fmt(total);

  ST.showDoc();
}

function printDoc() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();
  setTimeout(() => window.print(), 150);
}

function saveDoc() {
  const total = parseFloat(ST.v('totalAmount').replace(/\D/g, '')) || 0;
  ST.save('samassa_recus', {
    number: ST.v('receiptNumber'),
    client: ST.v('clientFirstName') + ' ' + ST.v('clientLastName'),
    date:   ST.fmtDate(ST.v('receiptDate')),
    total,
    mode:   selectedPM,
    statut: 'Payé',
  });
}

function shareWhatsApp() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();
  const icons = { Wave: '🌊', 'Orange Money': '🟠', 'Moov Money': '🔵', Espèces: '💵' };
  const cl  = ST.v('clientFirstName') + ' ' + ST.v('clientLastName');
  const t   = ST.v('totalAmount');
  const msg =
`*SAMASSA TECHNOLOGIE*
_Tout pour l'informatique_

Bonjour *${cl}*,

🧾 *Reçu N° ${ST.v('receiptNumber')}*
📅 Date : ${ST.fmtDate(ST.v('receiptDate'))}
💰 Montant : *${t}*
${icons[selectedPM] || ''} Mode : *${selectedPM}*

✅ Paiement confirmé et enregistré.

Merci pour votre confiance ! 🙏
📞 77 29 19 31  /  62 97 06 30`;
  ST.openWhatsApp(msg);
}
