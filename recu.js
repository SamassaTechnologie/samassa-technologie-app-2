/* ============================================================
   SAMASSA TECHNOLOGIE — recu.js v2.5
   Reçu de Paiement
   • SMS confirmation paiement + rendez-vous (24h/48h)
   • SMS confirmation de récupération de carte (avec date)
   • Historique journalier des retraits
   • Cartes en attente de récupération
   • Lien automatique avec le solde de caisse
   ============================================================ */
'use strict';

let selectedPM = 'Wave';

/* ── Icônes/logos modes de paiement (pour l'affichage doc) ── */
const PM_LOGO_HTML = {
  Wave:           `<img src="logo-wave.png"        alt="Wave"         style="width:36px;height:36px;object-fit:contain;border-radius:8px">`,
  'Orange Money': `<img src="logo-orange-money.jpg" alt="Orange Money" style="width:36px;height:36px;object-fit:contain">`,
  'Moov Money':   `<img src="logo-moov-money.png"   alt="Moov Money"   style="width:36px;height:36px;object-fit:contain">`,
  Espèces:        `<span style="font-size:28px">💵</span>`
};

const PM_ICONS_TXT = { Wave:'🌊', 'Orange Money':'🟠', 'Moov Money':'🔵', Espèces:'💵' };

/* ══════════════════════════════════════════════════════════
   INITIALISATION
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  ST.setTodayDate('receiptDate');
  ST.el('receiptNumber').value = ST.nextNumber('samassa_recus', 'REC-');
  updateRdvDate();
  recalc();
  document.addEventListener('itemsChanged', recalc);
  initPMPicker();
  renderPendingCards();
  renderDailyHistory();

  /* Initialiser la date de l'historique sur aujourd'hui */
  const hd = ST.el('histDate');
  if (hd) hd.value = new Date().toISOString().split('T')[0];
});

/* ══════════════════════════════════════════════════════════
   SÉLECTEUR MODE DE PAIEMENT
══════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════
   RENDEZ-VOUS
══════════════════════════════════════════════════════════ */
function updateRdvDate() {
  const delay = ST.v('rdvDelay');
  const rdvInput = ST.el('rdvDate');
  if (!rdvInput) return;
  if (delay === 'custom') {
    rdvInput.readOnly = false;
    return;
  }
  const d = new Date();
  d.setHours(d.getHours() + parseInt(delay));
  /* Format datetime-local : YYYY-MM-DDTHH:MM */
  const pad = n => String(n).padStart(2, '0');
  rdvInput.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  rdvInput.readOnly = delay !== 'custom';
}

function fmtRdvDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
       + ' à ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

/* ══════════════════════════════════════════════════════════
   CALCUL TOTAL
══════════════════════════════════════════════════════════ */
function recalc() {
  const total = ST.calcItems();
  const el = ST.el('totalAmount');
  if (el) el.value = ST.fmt(total);
}

/* ══════════════════════════════════════════════════════════
   LIGNES ARTICLES
══════════════════════════════════════════════════════════ */
function addItem()       { const r = ST.buildItemRow(false); document.getElementById('itemsContainer').appendChild(r); recalc(); }
function removeItem(btn) { ST.removeItem(btn); }

/* ══════════════════════════════════════════════════════════
   GÉNÉRER LE DOCUMENT
══════════════════════════════════════════════════════════ */
function generateReceipt() {
  recalc();
  const v = ST.v;

  ST.el('d-coName').textContent   = v('companyName');
  ST.el('d-coPhone').textContent  = v('companyPhone');
  ST.el('d-coEmail').textContent  = v('companyEmail');
  ST.el('d-num').textContent      = v('receiptNumber');
  ST.el('d-date').textContent     = ST.fmtDate(v('receiptDate'));
  ST.el('d-lastName').textContent  = v('clientLastName')  || '—';
  ST.el('d-firstName').textContent = v('clientFirstName') || '—';
  ST.el('d-cliPhone').textContent  = v('clientPhone')     || '—';
  ST.el('d-nina').textContent      = v('clientNina')      || '—';

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

  /* Logo mode de paiement dans le document */
  const pmCls = { Wave:'pm-box-wave', 'Orange Money':'pm-box-orange', 'Moov Money':'pm-box-moov', Espèces:'pm-box-cash' };
  const pmBox = ST.el('d-pmBox');
  pmBox.className = 'pm-display-box ' + (pmCls[selectedPM] || '');
  ST.el('d-pmIcon').innerHTML   = PM_LOGO_HTML[selectedPM] || '💵';
  ST.el('d-pmName').textContent = selectedPM;
  ST.el('d-pmAmount').textContent = ST.fmt(total);

  ST.showDoc();
}

/* ══════════════════════════════════════════════════════════
   IMPRIMER
══════════════════════════════════════════════════════════ */
function printDoc() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();
  setTimeout(() => window.print(), 150);
}

/* ══════════════════════════════════════════════════════════
   ENREGISTRER + CAISSE (avec sauvegarde carte en attente)
══════════════════════════════════════════════════════════ */
function saveDoc() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();

  const total  = parseFloat(ST.v('totalAmount').replace(/\D/g, '')) || 0;
  const client = ST.v('clientFirstName') + ' ' + ST.v('clientLastName');
  const num    = ST.v('receiptNumber');
  const date   = ST.fmtDate(ST.v('receiptDate'));
  const rdvDate = ST.v('rdvDate');

  if (!total) { ST.toast('Le montant est vide — veuillez saisir au moins un service.', 'error'); return; }

  /* Collecter les services */
  const services = [];
  document.querySelectorAll('.item-row').forEach(r => {
    const ins = r.querySelectorAll('.item-inputs input');
    services.push({ desc: ins[0].value, qty: parseFloat(ins[1].value)||1, price: parseFloat(ins[3].value)||0 });
  });

  /* 1️⃣  Enregistrer le reçu */
  const list = JSON.parse(localStorage.getItem('samassa_recus') || '[]');
  list.push({
    number:    num,
    client,
    phone:     ST.v('clientPhone') || '',
    nina:      ST.v('clientNina')  || '',
    date,
    rdvDate,
    total,
    mode:      selectedPM,
    statut:    'Payé',
    retrieved: false,   /* carte pas encore récupérée */
    services,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('samassa_recus', JSON.stringify(list));

  /* 2️⃣  Ajouter au solde de caisse */
  const mouvements = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]');
  mouvements.push({
    id:        Date.now(),
    date:      ST.v('receiptDate'),
    type:      'entree',
    desc:      'Reçu ' + num + ' — ' + client,
    amount:    total,
    pm:        selectedPM,
    cat:       'Vente service',
    auto:      true,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('samassa_mouvements', JSON.stringify(mouvements));

  /* 3️⃣  Actualiser les sections */
  renderPendingCards();
  renderDailyHistory();

  ST.toast('Reçu enregistré ✓  —  +' + ST.fmtNum(total) + ' FCFA ajouté à la caisse 💰', 'success');
}

/* ══════════════════════════════════════════════════════════
   SMS SIMPLE (récapitulatif paiement)
══════════════════════════════════════════════════════════ */
function sendSMS() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();
  const cl  = ST.v('clientFirstName') + ' ' + ST.v('clientLastName');
  const num = ST.v('receiptNumber');
  const t   = ST.v('totalAmount');
  const d   = ST.fmtDate(ST.v('receiptDate'));
  const phone = ST.v('clientPhone').replace(/\s/g, '');
  const pmTxt = { Wave:'[Wave]', 'Orange Money':'[Orange Money]', 'Moov Money':'[Moov Money]', Espèces:'[Especes]' };
  const msg = `SAMASSA TECH - Recu N°${num} - ${cl} - ${t} - ${pmTxt[selectedPM]||selectedPM} - ${d} - Merci! Tel: 77291931`;
  window.open((phone ? 'sms:'+phone : 'sms:') + '?body=' + encodeURIComponent(msg), '_blank');
  if (!phone) ST.toast('Téléphone non renseigné — SMS ouvert sans numéro.', 'info');
}

/* ══════════════════════════════════════════════════════════
   SMS RENDEZ-VOUS (confirmation paiement + date de retrait)
══════════════════════════════════════════════════════════ */
function sendRdvSMS() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();

  const cl    = ST.v('clientFirstName') + ' ' + ST.v('clientLastName');
  const num   = ST.v('receiptNumber');
  const t     = ST.v('totalAmount');
  const phone = ST.v('clientPhone').replace(/\s/g, '');
  const rdv   = ST.v('rdvDate');
  const note  = ST.v('rdvNote');
  const pmTxt = { Wave:'Wave', 'Orange Money':'Orange Money', 'Moov Money':'Moov Money', Espèces:'espèces' };

  if (!phone) {
    ST.toast('Veuillez renseigner le téléphone du client.', 'error');
    return;
  }
  if (!rdv) {
    ST.toast('Veuillez sélectionner une date de rendez-vous.', 'error');
    return;
  }

  const rdvStr = fmtRdvDate(rdv);

  const msg =
`SAMASSA TECHNOLOGIE - Kayes
Bonjour ${cl},
✅ Paiement reçu: ${t} via ${pmTxt[selectedPM]||selectedPM}
🧾 Reçu N°: ${num}
📅 RDV: ${rdvStr}
Venez récupérer votre carte/document.${note ? '\nNote: '+note : ''}
Tel: 77291931 / 62970630`;

  window.open('sms:' + phone + '?body=' + encodeURIComponent(msg), '_blank');
  ST.toast('SMS Rendez-vous envoyé à ' + cl + ' 📅', 'success');
}

/* ══════════════════════════════════════════════════════════
   CONFIRMATION DE RÉCUPÉRATION DE CARTE
══════════════════════════════════════════════════════════ */
function confirmCardRetrieval(recuNum) {
  const list = JSON.parse(localStorage.getItem('samassa_recus') || '[]');
  const idx  = list.findIndex(r => r.number === recuNum);
  if (idx === -1) return;

  const rec = list[idx];
  const today = new Date();
  const todayStr = today.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  /* Marquer comme récupéré */
  list[idx].retrieved     = true;
  list[idx].retrievedDate = today.toISOString();
  localStorage.setItem('samassa_recus', JSON.stringify(list));

  /* Envoyer SMS de confirmation si téléphone disponible */
  const phone = (rec.phone || '').replace(/\s/g, '');
  const msg =
`SAMASSA TECHNOLOGIE - Kayes
Bonjour ${rec.client},
✅ CARTE RÉCUPÉRÉE
📅 Date: ${todayStr}
🧾 Réf: ${recuNum}
Votre carte/document a bien été récupéré(e) aujourd'hui.
Conservez ce message comme preuve.
Tel: 77291931 / 62970630`;

  if (phone) {
    window.open('sms:' + phone + '?body=' + encodeURIComponent(msg), '_blank');
    ST.toast(rec.client + ' — Carte confirmée ✓ + SMS envoyé 📱', 'success');
  } else {
    ST.toast(rec.client + ' — Carte marquée comme récupérée ✓', 'success');
  }

  renderPendingCards();
  renderDailyHistory();
}

/* ══════════════════════════════════════════════════════════
   CARTES EN ATTENTE DE RÉCUPÉRATION
══════════════════════════════════════════════════════════ */
function renderPendingCards() {
  const list = JSON.parse(localStorage.getItem('samassa_recus') || '[]');
  const pending = list.filter(r => !r.retrieved && r.rdvDate);
  const container = document.getElementById('pendingCards-list');
  if (!container) return;

  if (!pending.length) {
    container.innerHTML = `<div style="text-align:center;padding:28px;color:#8099B0"><div style="font-size:32px;opacity:.3;margin-bottom:8px">🪪</div><p style="font-size:13px">Aucune carte en attente de récupération</p></div>`;
    return;
  }

  const now = new Date();
  container.innerHTML = pending.map(r => {
    const rdvDate  = r.rdvDate ? new Date(r.rdvDate) : null;
    const isReady  = rdvDate && rdvDate <= now;
    const isPast   = rdvDate && rdvDate < new Date(now - 86400000*2); /* > 48h */
    const rdvLabel = rdvDate ? rdvDate.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    const statusBg = isPast ? '#FEF2F2' : isReady ? '#F0FDF4' : '#FFFBEB';
    const statusColor = isPast ? '#DC2626' : isReady ? '#16A34A' : '#D97706';
    const statusLabel = isPast ? '⚠️ En retard' : isReady ? '✅ Prête' : '⏳ En attente';
    return `
    <div style="display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid #F0F5FA;transition:background .15s" onmouseover="this.style.background='#F8FBFD'" onmouseout="this.style.background='white'">
      <div style="width:40px;height:40px;border-radius:10px;background:#EDE9FE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🪪</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:#1A2D44">${r.client}</div>
        <div style="font-size:12px;color:#4A6080;margin-top:2px">
          ${r.phone ? `📞 ${r.phone}` : ''}
          ${r.nina  ? ` &nbsp;|&nbsp; NINA: ${r.nina}` : ''}
        </div>
        <div style="font-size:11px;color:#8099B0;margin-top:2px">📅 RDV: ${rdvLabel} &nbsp;|&nbsp; Reçu ${r.number} &nbsp;|&nbsp; ${ST.fmtNum(r.total||0)} FCFA</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${statusBg};color:${statusColor}">${statusLabel}</span>
        <button onclick="confirmCardRetrieval('${r.number}')"
          style="background:#16A34A;color:white;border:none;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">
          ✓ Confirmer récupération
        </button>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   HISTORIQUE JOURNALIER DES RETRAITS
══════════════════════════════════════════════════════════ */
function renderDailyHistory() {
  const histDateEl = document.getElementById('histDate');
  if (!histDateEl) return;
  const selectedDate = histDateEl.value || new Date().toISOString().split('T')[0];

  const list = JSON.parse(localStorage.getItem('samassa_recus') || '[]');
  /* Filtrer par date sélectionnée */
  const dayRecords = list.filter(r => {
    // Support both timestamp (new) and date string (old records)
    const d = r.timestamp ? r.timestamp.split('T')[0] :
      r.date ? r.date.split('/').reverse().join('-') : null;
    return d === selectedDate;
  });

  /* Résumé */
  const totalJ  = dayRecords.reduce((s, r) => s + (r.total||0), 0);
  const byMode  = {};
  dayRecords.forEach(r => { byMode[r.mode] = (byMode[r.mode]||0) + (r.total||0); });
  const topMode = Object.keys(byMode).sort((a,b) => byMode[b]-byMode[a])[0] || '—';

  const summary = document.getElementById('daily-summary');
  if (summary) {
    summary.innerHTML = `
      <div style="background:#F0F5FA;border-radius:9px;padding:12px 14px;text-align:center">
        <div style="font-size:10px;font-weight:700;color:#8099B0;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Transactions</div>
        <div style="font-size:22px;font-weight:800;color:#1A2D44">${dayRecords.length}</div>
      </div>
      <div style="background:#F0FDF4;border-radius:9px;padding:12px 14px;text-align:center">
        <div style="font-size:10px;font-weight:700;color:#15803D;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Total du jour</div>
        <div style="font-size:18px;font-weight:800;color:#16A34A">+${ST.fmtNum(totalJ)} FCFA</div>
      </div>
      <div style="background:#EFF6FF;border-radius:9px;padding:12px 14px;text-align:center">
        <div style="font-size:10px;font-weight:700;color:#1D4ED8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Mode principal</div>
        <div style="font-size:15px;font-weight:800;color:#1A2D44">${PM_ICONS_TXT[topMode]||''} ${topMode}</div>
      </div>`;
  }

  /* Table */
  const tbody = document.getElementById('daily-tbody');
  if (!tbody) return;
  if (!dayRecords.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:#8099B0;font-style:italic">Aucun reçu enregistré pour cette date</td></tr>`;
    return;
  }

  tbody.innerHTML = dayRecords.map(r => {
    const services = (r.services||[]).map(s=>s.desc).join(', ') || '—';
    const pmIcon   = PM_ICONS_TXT[r.mode] || '';
    const stBg     = r.retrieved ? '#F0FDF4' : '#FFFBEB';
    const stColor  = r.retrieved ? '#16A34A' : '#D97706';
    const stLabel  = r.retrieved ? '✅ Récupérée' : '⏳ En attente';
    const hr       = r.timestamp ? new Date(r.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '';
    return `<tr onmouseover="this.style.background='#F8FBFD'" onmouseout="this.style.background='white'" style="transition:background .15s">
      <td style="padding:9px 14px;border-bottom:1px solid #F0F5FA;font-weight:700;color:#1A2D44">${r.number || '—'}<br><span style="font-size:10px;color:#8099B0;font-weight:400">${hr}</span></td>
      <td style="padding:9px 14px;border-bottom:1px solid #F0F5FA">
        <div style="font-weight:600;color:#1A2D44;font-size:13px">${r.client||'—'}</div>
        <div style="font-size:11px;color:#0088CC">${r.phone||''}</div>
      </td>
      <td style="padding:9px 14px;border-bottom:1px solid #F0F5FA;font-size:12px;color:#4A6080">${r.nina||'—'}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #F0F5FA;font-size:12px;color:#4A6080;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${services}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #F0F5FA;text-align:center;font-size:13px">${pmIcon} <span style="font-size:11px">${r.mode||'—'}</span></td>
      <td style="padding:9px 14px;border-bottom:1px solid #F0F5FA;text-align:right;font-weight:700;color:#16A34A;font-size:13px">+${ST.fmtNum(r.total||0)} F</td>
      <td style="padding:9px 14px;border-bottom:1px solid #F0F5FA;text-align:center"><span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;background:${stBg};color:${stColor}">${stLabel}</span></td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   EXPORT CSV JOURNALIER
══════════════════════════════════════════════════════════ */
function exportDailyCSV() {
  const histDateEl = document.getElementById('histDate');
  const selectedDate = histDateEl?.value || new Date().toISOString().split('T')[0];
  const list = JSON.parse(localStorage.getItem('samassa_recus') || '[]');
  const dayRecords = list.filter(r => (r.timestamp||'').startsWith(selectedDate));

  if (!dayRecords.length) { ST.toast('Aucun reçu pour cette date.', 'error'); return; }

  const rows = [['N° Reçu','Client','Téléphone','NINA','Services','Mode Paiement','Montant (FCFA)','Récupérée','Heure']];
  dayRecords.forEach(r => {
    rows.push([
      r.number||'', r.client||'', r.phone||'', r.nina||'',
      (r.services||[]).map(s=>s.desc).join(' / ')||'',
      r.mode||'', r.total||0,
      r.retrieved ? 'Oui' : 'Non',
      r.timestamp ? new Date(r.timestamp).toLocaleTimeString('fr-FR') : ''
    ]);
  });
  const csv = rows.map(row => row.join(';')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'retraits-' + selectedDate + '.csv';
  a.click();
  ST.toast('Export CSV du ' + new Date(selectedDate).toLocaleDateString('fr-FR') + ' ✓');
}

/* ══════════════════════════════════════════════════════════
   WHATSAPP
══════════════════════════════════════════════════════════ */
function shareWhatsApp() {
  if (ST.el('docInner').style.display === 'none') generateReceipt();
  const icons = PM_ICONS_TXT;
  const cl  = ST.v('clientFirstName') + ' ' + ST.v('clientLastName');
  const t   = ST.v('totalAmount');
  const rdv = ST.v('rdvDate');
  const msg =
`*SAMASSA TECHNOLOGIE*
_Tout pour l'informatique_

Bonjour *${cl}*,

🧾 *Reçu N° ${ST.v('receiptNumber')}*
📅 Date : ${ST.fmtDate(ST.v('receiptDate'))}
💰 Montant : *${t}*
${icons[selectedPM]||''} Mode : *${selectedPM}*
${rdv ? '📅 Rendez-vous : *'+fmtRdvDate(rdv)+'*' : ''}

✅ Paiement confirmé.

Merci pour votre confiance ! 🙏
📞 77 29 19 31  /  62 97 06 30`;
  ST.openWhatsApp(msg, ST.v('clientPhone'));
}
