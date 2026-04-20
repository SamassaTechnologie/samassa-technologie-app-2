/* ============================================================
   SAMASSA TECHNOLOGIE — recu_cyber.js v2.2
   Reçu Cyber Café : même logique que recu.js
   • Pas de numéro NINA
   • Raccourcis services cyber café
   • Ajout automatique au solde de caisse à l'enregistrement
   • Envoi WhatsApp + SMS
   ============================================================ */
'use strict';

let selectedPM = 'Wave';

document.addEventListener('DOMContentLoaded', () => {
  ST.setTodayDate('receiptDate');
  /* Numérotation autonome pour le cyber café */
  ST.el('receiptNumber').value = ST.nextNumber('samassa_recus_cyber', 'CYB-');
  recalc();
  document.addEventListener('itemsChanged', recalc);
  initPMPicker();
});

/* ── Sélection mode de paiement (identique à recu.js) ── */
function initPMPicker() {
  const selClasses = {
    Wave:           'selected',
    'Orange Money': 'sel-orange',
    'Moov Money':   'sel-moov',
    Espèces:        'sel-cash'
  };
  document.querySelectorAll('.pm-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.pm-option').forEach(o =>
        o.classList.remove(...Object.values(selClasses))
      );
      selectedPM = opt.dataset.pm;
      opt.classList.add(selClasses[selectedPM] || 'selected');
    });
  });
}

/* ── Recalcul total ── */
function recalc() {
  const total = ST.calcItems();
  const el = ST.el('totalAmount');
  if (el) el.value = ST.fmt(total);
}

/* ── Gestion lignes articles ── */
function addItem() {
  const r = ST.buildItemRow(false);
  document.getElementById('itemsContainer').appendChild(r);
  recalc();
}

function removeItem(btn) { ST.removeItem(btn); }

/* ── Raccourci catalogue : ajoute une ligne pré-remplie ── */
function addQuick(desc, qty, price) {
  const container = document.getElementById('itemsContainer');
  const r = ST.buildItemRow(false);
  const ins = r.querySelectorAll('.item-inputs input');
  ins[0].value = desc;
  ins[1].value = qty;
  ins[2].value = price;
  ins[3].value = qty * price;
  container.appendChild(r);
  recalc();
  /* Scroll vers les items */
  container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Générer le document ── */
function generateReceipt() {
  recalc();
  const v = ST.v;

  ST.el('d-coName').textContent   = v('companyName');
  ST.el('d-coTag').textContent    = v('companyTagline');
  ST.el('d-coPhone').textContent  = v('companyPhone');
  ST.el('d-coEmail').textContent  = v('companyEmail');
  ST.el('d-num').textContent      = v('receiptNumber');
  ST.el('d-date').textContent     = ST.fmtDate(v('receiptDate'));
  ST.el('d-lastName').textContent  = v('clientLastName')  || '—';
  ST.el('d-firstName').textContent = v('clientFirstName') || '—';
  ST.el('d-cliPhone').textContent  = v('clientPhone')     || '—';

  /* Table des services */
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
    tbody.innerHTML += `
      <tr>
        <td>${desc}</td>
        <td>${qty}</td>
        <td>${ST.fmtNum(price)} F</td>
        <td style="font-weight:600">${ST.fmtNum(t)} F</td>
      </tr>`;
  });
  ST.el('d-total').textContent = ST.fmt(total);

  /* Mode de paiement */
  const icons = { Wave:'🌊', 'Orange Money':'🟠', 'Moov Money':'🔵', Espèces:'💵' };
  const pmCls = { Wave:'pm-box-wave', 'Orange Money':'pm-box-orange', 'Moov Money':'pm-box-moov', Espèces:'pm-box-cash' };
  const pmBox = ST.el('d-pmBox');
  pmBox.className = 'pm-display-box ' + (pmCls[selectedPM] || '');
  ST.el('d-pmIcon').textContent   = icons[selectedPM] || '💵';
  ST.el('d-pmName').textContent   = selectedPM;
  ST.el('d-pmAmount').textContent = ST.fmt(total);

  ST.showDoc();
}

/* ── Imprimer ── */
function printDoc() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();
  setTimeout(() => window.print(), 150);
}

/* ── Enregistrer + Caisse ── */
function saveDoc() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();

  const total  = parseFloat(ST.v('totalAmount').replace(/\D/g, '')) || 0;
  const client = (ST.v('clientFirstName') + ' ' + ST.v('clientLastName')).trim() || 'Client';
  const num    = ST.v('receiptNumber');
  const date   = ST.fmtDate(ST.v('receiptDate'));

  if (!total) {
    ST.toast('Le montant est vide — ajoutez au moins un service.', 'error');
    return;
  }

  /* Collecter le détail des services pour le modal historique */
  const services = [];
  document.querySelectorAll('.item-row').forEach(r => {
    const ins = r.querySelectorAll('.item-inputs input');
    services.push({
      desc:  ins[0].value,
      qty:   parseFloat(ins[1].value) || 1,
      price: parseFloat(ins[3].value) || 0
    });
  });

  /* 1️⃣  Enregistrer le reçu cyber dans son historique propre */
  const recusList = JSON.parse(localStorage.getItem('samassa_recus_cyber') || '[]');
  recusList.push({
    number:    num,
    client,
    phone:     ST.v('clientPhone') || '',
    date,
    total,
    mode:      selectedPM,
    statut:    'Payé',
    services,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('samassa_recus_cyber', JSON.stringify(recusList));

  /* 2️⃣  Ajouter automatiquement au solde de caisse commun */
  const mouvements = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]');
  mouvements.push({
    id:        Date.now(),
    date:      ST.v('receiptDate'),
    type:      'entree',
    desc:      'Reçu Cyber ' + num + ' — ' + client,
    amount:    total,
    pm:        selectedPM,
    cat:       'Cyber Café',
    auto:      true,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('samassa_mouvements', JSON.stringify(mouvements));

  ST.toast('Reçu Cyber enregistré ✓  —  +' + ST.fmtNum(total) + ' FCFA ajouté à la caisse 💰', 'success');
}

/* ── Partage WhatsApp ── */
function shareWhatsApp() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();

  const icons = { Wave:'🌊', 'Orange Money':'🟠', 'Moov Money':'🔵', Espèces:'💵' };
  const cl    = (ST.v('clientFirstName') + ' ' + ST.v('clientLastName')).trim() || 'Client';
  const t     = ST.v('totalAmount');
  const msg =
`*SAMASSA TECHNOLOGIE — Cyber Café*
_Tout pour l'informatique_

Bonjour *${cl}*,

🖥️ *Reçu Cyber N° ${ST.v('receiptNumber')}*
📅 Date : ${ST.fmtDate(ST.v('receiptDate'))}
💰 Montant : *${t}*
${icons[selectedPM] || ''} Mode : *${selectedPM}*

✅ Paiement confirmé.

Merci pour votre visite ! 🙏
📞 77 29 19 31  /  62 97 06 30`;

  ST.openWhatsApp(msg, ST.v('clientPhone'));
}

/* ── Envoi SMS ── */
function sendSMS() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();

  const cl    = (ST.v('clientFirstName') + ' ' + ST.v('clientLastName')).trim() || 'Client';
  const num   = ST.v('receiptNumber');
  const t     = ST.v('totalAmount');
  const d     = ST.fmtDate(ST.v('receiptDate'));
  const pmTxt = { Wave:'[Wave]', 'Orange Money':'[Orange Money]', 'Moov Money':'[Moov Money]', Espèces:'[Espèces]' };
  const phone = ST.v('clientPhone').replace(/\s/g, '');

  const msg = `SAMASSA CYBER - Recu N°${num} - ${cl} - ${t} - ${pmTxt[selectedPM] || selectedPM} - ${d} - Merci! Tel: 77291931`;

  if (phone) {
    window.open('sms:' + phone + '?body=' + encodeURIComponent(msg), '_blank');
  } else {
    window.open('sms:?body=' + encodeURIComponent(msg), '_blank');
    ST.toast('Téléphone non renseigné — SMS ouvert sans numéro.', 'info');
  }
}
