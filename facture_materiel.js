/* ============================================================
   SAMASSA TECHNOLOGIE — facture_materiel.js v1.0
   Facture vente de matériels informatiques
   Fonctionnalités : catalogue, N° série, garantie, état, TVA optionnelle
   ============================================================ */
'use strict';

var selectedPM = 'Wave';
var _itemCount = 0;

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  ST.setTodayDate('invoiceDate');
  ST.el('invoiceNumber').value = ST.nextNumber('samassa_factures_mat', 'FAC-MAT-');

  /* Ajouter un premier article vide par défaut */
  addMatProduct('💻 Ordinateur Portable', '', 0);

  /* Sélecteur mode de paiement */
  document.querySelectorAll('.pm-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      document.querySelectorAll('.pm-option').forEach(function (o) {
        o.classList.remove('selected', 'sel-orange', 'sel-moov', 'sel-cash');
      });
      selectedPM = opt.dataset.pm;
      var cls = { Wave:'selected','Orange Money':'sel-orange','Moov Money':'sel-moov','Espèces':'sel-cash' };
      opt.classList.add(cls[selectedPM] || 'selected');
      ST.el('paymentMethod').value = selectedPM;
    });
  });
});

/* ════════════════════════════════════════
   CATALOGUE — AJOUTER UN PRODUIT
════════════════════════════════════════ */
window.addMatProduct = function (description, marque, prix) {
  _itemCount++;
  var n = _itemCount;
  var container = document.getElementById('matItemsContainer');

  var row = document.createElement('div');
  row.className = 'mat-item-row';
  row.dataset.idx = n;

  row.innerHTML = [
    '<div class="mat-item-badge">' + n + '</div>',
    '<button class="mat-remove-btn" onclick="removeMatItem(this)" title="Supprimer">✕</button>',

    /* Ligne 1 : Description */
    '<div class="mat-item-header">',
      '<div class="mat-item-desc">',
        '<div class="mat-field-lbl">Désignation du produit</div>',
        '<input type="text" placeholder="Ex: Ordinateur Portable HP EliteBook 840 G8"',
          ' value="' + description + '" oninput="recalcMat()">',
      '</div>',
    '</div>',

    /* Ligne 2 : Marque, Modèle, N° Série */
    '<div class="mat-row2">',
      '<div>',
        '<div class="mat-field-lbl">Marque</div>',
        '<input type="text" placeholder="HP, Dell, Lenovo…" value="' + marque + '">',
      '</div>',
      '<div>',
        '<div class="mat-field-lbl">Modèle</div>',
        '<input type="text" placeholder="Ex: EliteBook 840 G8">',
      '</div>',
      '<div>',
        '<div class="mat-field-lbl">N° de série</div>',
        '<input type="text" placeholder="SN: XXXXXXXXXX" style="font-family:monospace;font-size:11px">',
      '</div>',
    '</div>',

    /* Ligne 3 : État, Garantie, Qté, Prix, Total */
    '<div class="mat-row3">',
      '<div>',
        '<div class="mat-field-lbl">État</div>',
        '<select style="width:100%;padding:7px 8px;border-radius:8px;border:1.5px solid #C8D8EA;font-size:11px;font-family:inherit;background:white;font-weight:600">',
          '<option value="Neuf">✨ Neuf</option>',
          '<option value="Reconditionné">♻️ Recon.</option>',
          '<option value="Occasion">📦 Occasion</option>',
        '</select>',
      '</div>',
      '<div>',
        '<div class="mat-field-lbl">Garantie</div>',
        '<select style="width:100%;padding:7px 8px;border-radius:8px;border:1.5px solid #C8D8EA;font-size:11px;font-family:inherit;background:white;font-weight:600">',
          '<option value="Sans garantie">Aucune</option>',
          '<option value="1 mois">1 mois</option>',
          '<option value="3 mois" selected>3 mois</option>',
          '<option value="6 mois">6 mois</option>',
          '<option value="12 mois">12 mois</option>',
          '<option value="24 mois">24 mois</option>',
        '</select>',
      '</div>',
      '<div>',
        '<div class="mat-field-lbl">Quantité</div>',
        '<input type="number" value="1" min="1" placeholder="Qté" oninput="recalcMat()" class="mat-qty">',
      '</div>',
      '<div>',
        '<div class="mat-field-lbl">Prix unitaire</div>',
        '<input type="number" value="' + (prix || 0) + '" min="0" placeholder="FCFA" oninput="recalcMat()" class="mat-price">',
      '</div>',
    '</div>',

    /* Total ligne */
    '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #EEF3F9">',
      '<span style="font-size:11px;color:#7A94AF;font-weight:600">Total ligne :</span>',
      '<span class="mat-line-total" style="font-size:15px;font-weight:900;color:#0A1628">0 FCFA</span>',
    '</div>'
  ].join('');

  container.appendChild(row);
  recalcMat();

  /* Focus sur la description */
  row.querySelector('input[type=text]').focus();
};

/* ════════════════════════════════════════
   SUPPRIMER UN ARTICLE
════════════════════════════════════════ */
window.removeMatItem = function (btn) {
  btn.closest('.mat-item-row').remove();
  /* Renuméroter */
  document.querySelectorAll('.mat-item-row').forEach(function (r, i) {
    var badge = r.querySelector('.mat-item-badge');
    if (badge) badge.textContent = i + 1;
  });
  recalcMat();
};

/* ════════════════════════════════════════
   RECALCUL TOTAUX
════════════════════════════════════════ */
window.recalcMat = function () {
  var ht = 0;
  document.querySelectorAll('.mat-item-row').forEach(function (row) {
    var qty   = parseFloat(row.querySelector('.mat-qty')?.value   || 0) || 0;
    var price = parseFloat(row.querySelector('.mat-price')?.value || 0) || 0;
    var total = qty * price;
    ht += total;
    var totalEl = row.querySelector('.mat-line-total');
    if (totalEl) totalEl.textContent = ST.fmtNum(total) + ' FCFA';
  });

  var applyTVA = ST.el('applyTVA') && ST.el('applyTVA').checked;
  var tva = applyTVA ? ht * 0.18 : 0;
  var ttc = ht + tva;

  ST.el('totalHT').value  = ST.fmtNum(ht)  + ' FCFA';
  ST.el('totalTVA').value = ST.fmtNum(tva) + ' FCFA';
  ST.el('totalTTC').value = ST.fmtNum(ttc) + ' FCFA';
};

/* ════════════════════════════════════════
   GÉNÉRER LA FACTURE
════════════════════════════════════════ */
window.generateMatInvoice = function () {
  recalcMat();
  var v = ST.v;

  /* En-tête société */
  ST.el('d-coName').textContent  = v('companyName');
  ST.el('d-coTag').textContent   = v('companyTagline');
  ST.el('d-coAddr').innerHTML    = ST.nl2br(v('companyAddress'));
  ST.el('d-coPhone').textContent = v('companyPhone');
  ST.el('d-coEmail').textContent = v('companyEmail');

  /* Référence */
  ST.el('d-num').textContent     = v('invoiceNumber');
  ST.el('d-date').textContent    = ST.fmtDate(v('invoiceDate'));
  ST.el('d-manager').textContent = v('managerName');

  /* Client */
  ST.el('d-client').textContent  = v('clientName') || '—';
  var clientDetails = [];
  if (v('clientPhone'))   clientDetails.push('📞 ' + v('clientPhone'));
  if (v('clientAddress')) clientDetails.push('📍 ' + v('clientAddress'));
  ST.el('d-client-details').textContent = clientDetails.join('  ·  ');

  /* Mode de paiement */
  ST.el('d-payment').textContent = selectedPM || 'Wave';

  /* Notes */
  var notes = v('invoiceNotes');
  if (notes) {
    ST.el('d-notes-section').style.display = 'block';
    ST.el('d-notes').textContent = notes;
  } else {
    ST.el('d-notes-section').style.display = 'none';
  }

  /* Conditions de garantie — affichées seulement si case cochée */
  var showGarantie = ST.el('showGarantie') && ST.el('showGarantie').checked;
  var garantieBox  = ST.el('d-garantie-box');
  if (garantieBox) garantieBox.style.display = showGarantie ? 'block' : 'none';

  /* ── Lignes articles ── */
  var tbody = ST.el('d-items');
  tbody.innerHTML = '';
  var ht = 0;
  var summaryItems = [];

  document.querySelectorAll('.mat-item-row').forEach(function (row, idx) {
    var inputs  = row.querySelectorAll('input[type=text]');
    var selects = row.querySelectorAll('select');
    var desc    = (inputs[0] && inputs[0].value) || '—';
    var marque  = (inputs[1] && inputs[1].value) || '';
    var modele  = (inputs[2] && inputs[2].value) || '';
    var serial  = (inputs[3] && inputs[3].value) || '—';
    var etat    = (selects[0] && selects[0].value) || 'Neuf';
    var garantie= (selects[1] && selects[1].value) || 'Sans garantie';
    var qty     = parseFloat(row.querySelector('.mat-qty')?.value   || 1) || 1;
    var price   = parseFloat(row.querySelector('.mat-price')?.value || 0) || 0;
    var total   = qty * price;
    ht += total;

    var etatBadge = etat === 'Neuf'
      ? '<span class="doc-badge-neuf">✨ Neuf</span>'
      : etat === 'Reconditionné'
        ? '<span class="doc-badge-recon">♻️ Recon.</span>'
        : '<span class="doc-badge-usage">📦 Occasion</span>';

    var garantieBadge = garantie !== 'Sans garantie'
      ? '<span class="garantie-badge">🛡️ ' + garantie + '</span>'
      : '<span style="font-size:10px;color:#7A94AF">—</span>';

    var marqueModele = [marque, modele].filter(Boolean).join(' ');

    tbody.innerHTML += [
      '<tr style="border-bottom:1px solid #EEF3F9">',
        '<td style="text-align:center;font-weight:800;color:#0070C0;padding:9px 6px;font-size:13px">' + (idx + 1) + '</td>',
        '<td style="padding:9px 8px">',
          '<div style="font-weight:700;color:#0A1628;font-size:13px">' + desc + '</div>',
        '</td>',
        '<td style="font-size:11px;color:#3D5470;text-align:center;padding:9px 6px">' + (marqueModele || '—') + '</td>',
        '<td style="text-align:center;font-family:monospace;font-size:10px;color:#7A94AF;padding:9px 6px">' + serial + '</td>',
        '<td style="text-align:center;padding:9px 6px">' + etatBadge + '</td>',
        '<td style="text-align:center;padding:9px 6px">' + garantieBadge + '</td>',
        '<td style="text-align:center;font-weight:700;padding:9px 6px">' + qty + '</td>',
        '<td style="text-align:center;font-size:12px;padding:9px 6px">' + ST.fmtNum(price) + ' F</td>',
        '<td style="text-align:center;font-weight:900;color:#0A1628;font-size:13px;padding:9px 6px">' + ST.fmtNum(total) + ' F</td>',
      '</tr>'
    ].join('');

    summaryItems.push({ desc: desc, marque: marqueModele, serial: serial, garantie: garantie, etat: etat, qty: qty, total: total });
  });

  /* Totaux */
  var applyTVA = ST.el('applyTVA') && ST.el('applyTVA').checked;
  var tva = applyTVA ? ht * 0.18 : 0;
  var ttc = ht + tva;

  ST.el('d-ht').textContent   = ST.fmt(ht);
  ST.el('d-tva').textContent  = ST.fmt(tva);
  ST.el('d-ttc').textContent  = ST.fmt(ttc);
  /* ← Fix : ST.fmt() inclut déjà "FCFA", pas besoin d'en ajouter */
  ST.el('d-ttc-foot').textContent = ST.fmt(ttc);

  /* TVA row visible ? */
  var tvaRow = ST.el('d-tva-row');
  if (tvaRow) tvaRow.style.display = applyTVA ? '' : 'none';

  /* ── Résumé des articles ── */
  var summaryHtml = '<strong>📦 Récapitulatif des articles (' + summaryItems.length + ' article(s))</strong>';
  summaryItems.forEach(function (s) {
    summaryHtml += [
      '<div class="mat-summary-item">',
        '<span>',
          s.desc,
          s.marque ? ' <em style="color:#7A94AF;font-size:10px">(' + s.marque + ')</em>' : '',
          ' &nbsp;',
          s.etat === 'Neuf' ? '<span class="doc-badge-neuf" style="font-size:8px">Neuf</span>' : '',
          s.garantie !== 'Sans garantie' ? ' <span class="garantie-badge" style="font-size:8px;padding:1px 5px">🛡️ ' + s.garantie + '</span>' : '',
        '</span>',
        /* ← Fix : ST.fmt() inclut déjà "FCFA" */
        '<span style="font-weight:700;color:#0A1628">' + (s.qty > 1 ? s.qty + '×  ' : '') + ST.fmt(s.total) + '</span>',
      '</div>'
    ].join('');
  });
  /* ← Fix : pas de " FCFA" supplémentaire */
  summaryHtml += '<div class="mat-summary-item"><span style="font-weight:800">TOTAL</span><span style="font-weight:900;color:#0A1628">' + ST.fmt(ttc) + '</span></div>';
  ST.el('d-summary').innerHTML = summaryHtml;

  ST.showDoc();
};

/* ════════════════════════════════════════
   IMPRIMER
════════════════════════════════════════ */
window.printDoc = function () {
  if (ST.el('docInner').style.display === 'none') generateMatInvoice();
  setTimeout(function () { window.print(); }, 150);
};

/* ════════════════════════════════════════
   ENREGISTRER
════════════════════════════════════════ */
window.saveDoc = function () {
  if (ST.el('docInner').style.display === 'none') generateMatInvoice();
  var ttcRaw = parseFloat(ST.v('totalTTC').replace(/\D/g, '')) || 0;
  if (!ttcRaw) { ST.toast('Ajoutez au moins un article avant d\'enregistrer.', 'error'); return; }

  var num  = ST.v('invoiceNumber');
  var list = JSON.parse(localStorage.getItem('samassa_factures_mat') || '[]');
  if (list.find(function (f) { return f.number === num; })) {
    ST.toast('Facture ' + num + ' déjà enregistrée.', 'info'); return;
  }

  /* Collecter les articles pour l'historique */
  var articles = [];
  document.querySelectorAll('.mat-item-row').forEach(function (row) {
    var inputs  = row.querySelectorAll('input[type=text]');
    var selects = row.querySelectorAll('select');
    articles.push({
      desc:     (inputs[0] && inputs[0].value) || '',
      marque:   (inputs[1] && inputs[1].value) || '',
      modele:   (inputs[2] && inputs[2].value) || '',
      serial:   (inputs[3] && inputs[3].value) || '',
      etat:     (selects[0] && selects[0].value) || '',
      garantie: (selects[1] && selects[1].value) || '',
      qty:      parseFloat(row.querySelector('.mat-qty')?.value   || 1) || 1,
      price:    parseFloat(row.querySelector('.mat-price')?.value || 0) || 0
    });
  });

  list.push({
    number:    num,
    client:    ST.v('clientName'),
    phone:     ST.v('clientPhone'),
    date:      ST.fmtDate(ST.v('invoiceDate')),
    total:     ttcRaw,
    payment:   selectedPM,
    articles:  articles,
    statut:    'Payé',
    type:      'Facture Matériel',
    timestamp: new Date().toISOString()
  });

  localStorage.setItem('samassa_factures_mat', JSON.stringify(list));

  /* Aussi enregistrer en caisse */
  try {
    var caisse = JSON.parse(localStorage.getItem('_samassa_mouvements') || '[]');
    caisse.push({
      id:        'MAT-' + Date.now(),
      type:      'entree',
      montant:   ttcRaw,
      motif:     'Vente matériel · ' + num,
      date:      new Date().toISOString().slice(0, 10),
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('_samassa_mouvements', JSON.stringify(caisse));
  } catch (e) {}

  ST.toast('✅ Facture ' + num + ' enregistrée en caisse', 'success');
  ST.el('invoiceNumber').value = ST.nextNumber('samassa_factures_mat', 'FAC-MAT-');
};

/* ════════════════════════════════════════
   PARTAGE WHATSAPP
════════════════════════════════════════ */
window.shareWhatsApp = function () {
  if (ST.el('docInner').style.display === 'none') generateMatInvoice();

  var n   = ST.v('invoiceNumber');
  var cl  = ST.v('clientName') || 'Client';
  var ttc = ST.v('totalTTC');
  var d   = ST.fmtDate(ST.v('invoiceDate'));
  var pm  = selectedPM || 'Wave';

  /* Liste des articles pour WhatsApp */
  var lignes = [];
  document.querySelectorAll('.mat-item-row').forEach(function (row, idx) {
    var inputs  = row.querySelectorAll('input[type=text]');
    var desc    = (inputs[0] && inputs[0].value) || '—';
    var marque  = (inputs[1] && inputs[1].value) || '';
    var qty     = row.querySelector('.mat-qty')?.value   || 1;
    var price   = row.querySelector('.mat-price')?.value || 0;
    var total   = (parseFloat(qty) * parseFloat(price));
    lignes.push('  ' + (idx+1) + '. ' + desc + (marque ? ' (' + marque + ')' : '') + '\n'
              + '     Qté: ' + qty + '  ×  ' + ST.fmtNum(price) + ' F = *' + ST.fmtNum(total) + ' FCFA*');
  });

  var msg = [
    '*SAMASSA TECHNOLOGIE*',
    '_Tout pour l\'informatique_',
    '',
    'Bonjour *' + cl + '*,',
    '',
    '🖥️ *Facture Matériel N° ' + n + '*',
    '📅 Date : ' + d,
    '',
    '*Articles vendus :*',
    lignes.join('\n'),
    '',
    '💰 *Total TTC : ' + ttc + '*',
    '💳 Paiement : ' + pm,
    '',
    '_Garantie et conditions disponibles sur votre facture_',
    '',
    'Merci pour votre confiance ! 🙏',
    '📞 77 29 19 31  /  62 97 06 30',
    '📧 samassatechnologie10@gmail.com'
  ].join('\n');

  ST.openWhatsApp(msg);
};
