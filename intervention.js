/* ============================================================
   SAMASSA TECHNOLOGIE — intervention.js v2.0
   Logique complète du module Fiche d'Intervention
   ============================================================ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  ST.setTodayDate('interventionDate');
  const now = new Date().toTimeString().slice(0, 5);
  ST.el('interventionTime').value = now;
  ST.el('interventionNumber').value = ST.nextNumber('samassa_interventions', 'INT-');
  initCostCalc();
});

function initCostCalc() {
  ['laborCost', 'partsCost'].forEach(id => {
    const el = ST.el(id);
    if (el) el.addEventListener('input', recalcTotal);
  });
}

function recalcTotal() {
  const labor  = parseFloat(ST.v('laborCost'))  || 0;
  const parts  = parseFloat(ST.v('partsCost'))  || 0;
  const travel = parseFloat(ST.v('travelCost')) || 0;
  const total  = labor + parts + travel;
  const el = ST.el('totalCost');
  if (el) el.value = total;
  const el2 = ST.el('totalCostDisplay');
  if (el2) el2.value = ST.fmt(total);
}

function generateIntervention() {
  recalcTotal();
  const v = ST.v;

  // En-tête
  ST.el('d-intNum').textContent    = v('interventionNumber');
  ST.el('d-intDate').textContent   = ST.fmtDate(v('interventionDate')) + ' — ' + v('interventionTime');
  ST.el('d-tech').textContent      = v('technicianName');
  ST.el('d-techSig').textContent   = v('technicianName');

  // Statut paiement avec style
  const statut = v('paymentStatus');
  const el = ST.el('d-payStatus');
  el.textContent = statut;
  el.className = 'status-badge ' + (statut === 'Payé' ? 'status-paye' : statut === 'Impayé' ? 'status-impaye' : 'status-acompte');

  // Client
  ST.el('d-cliName').textContent    = v('clientName')    || '—';
  ST.el('d-cliPhone').textContent   = v('clientPhone')   || '—';
  ST.el('d-cliAddress').textContent = v('clientAddress') || '—';

  // Équipement
  ST.el('d-eqType').textContent  = v('equipmentType')  || '—';
  ST.el('d-eqBrand').textContent = v('equipmentBrand') || '—';

  // Descriptions
  ST.el('d-problem').textContent  = v('problemDescription')  || '—';
  ST.el('d-actions').textContent  = v('actionsPerformed')    || '—';
  ST.el('d-result').textContent   = v('interventionResult')  || '—';

  // Facturation
  const labor  = parseFloat(v('laborCost'))  || 0;
  const parts  = parseFloat(v('partsCost'))  || 0;
  const travel = parseFloat(v('travelCost')) || 0;
  const total  = labor + parts + travel;

  ST.el('d-labor').textContent  = ST.fmt(labor);
  ST.el('d-parts').textContent  = ST.fmt(parts);
  ST.el('d-travel').textContent = ST.fmt(travel);
  ST.el('d-total').textContent  = ST.fmt(total);

  ST.showDoc();
}

function printDoc() {
  if (ST.el('docInner').style.display === 'none') generateIntervention();
  setTimeout(() => window.print(), 150);
}

function saveDoc() {
  const total = parseFloat(ST.v('totalCost')) || 0;
  ST.save('samassa_interventions', {
    number:    ST.v('interventionNumber'),
    client:    ST.v('clientName'),
    date:      ST.fmtDate(ST.v('interventionDate')),
    equipment: ST.v('equipmentType') + ' ' + ST.v('equipmentBrand'),
    total,
    statut:    ST.v('paymentStatus'),
  });
}

function shareWhatsApp() {
  if (ST.el('docInner').style.display === 'none') generateIntervention();
  const cl  = ST.v('clientName') || 'Client';
  const eq  = ST.v('equipmentType') + (ST.v('equipmentBrand') ? ' — ' + ST.v('equipmentBrand') : '');
  const tot = ST.fmt(parseFloat(ST.v('totalCost')) || 0);
  const msg =
`*SAMASSA TECHNOLOGIE*
_Tout pour l'informatique_

Bonjour *${cl}*,

🔧 *Fiche d'Intervention N° ${ST.v('interventionNumber')}*
📅 Date : ${ST.fmtDate(ST.v('interventionDate'))}
💻 Équipement : ${eq}
🔍 Problème : ${ST.v('problemDescription') || '—'}
✅ Actions : ${ST.v('actionsPerformed') || '—'}
💰 Total : *${tot}*
📋 Statut : *${ST.v('paymentStatus')}*

Merci pour votre confiance ! 🙏
📞 77 29 19 31  /  62 97 06 30`;
  ST.openWhatsApp(msg);
}
