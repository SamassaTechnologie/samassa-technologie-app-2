/* ============================================================
   SAMASSA TECHNOLOGIE — stock.js v2.0
   Gestion stock : prix achat/vente, mouvements, alertes, caisse
   ============================================================ */
'use strict';

const STOCK_KEY = 'samassa_stock_v2';
const MVT_KEY   = 'samassa_stock_mouvements';

function $ (id) { return document.getElementById(id); }
function fmt(n) { return Number(n||0).toLocaleString('fr-FR') + ' FCFA'; }
function today() { return new Date().toISOString().split('T')[0]; }
function esc(s) { return String(s||'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":"&#39;",'"':'&quot;'}[c])); }

/* ── Données ── */
function readStock() { return JSON.parse(localStorage.getItem(STOCK_KEY) || '[]'); }
function saveStock(data) { localStorage.setItem(STOCK_KEY, JSON.stringify(data)); renderAll(); }
function readMvt() { return JSON.parse(localStorage.getItem(MVT_KEY) || '[]'); }
function saveMvt(data) { localStorage.setItem(MVT_KEY, JSON.stringify(data)); renderMouvements(); }

/* ── Ajouter/mettre à jour un article ── */
window.addStock = function () {
  const name   = $('s-name').value.trim();
  const cat    = $('s-cat').value;
  const qty    = Math.max(0, +$('s-qty').value  || 0);
  const min    = Math.max(0, +$('s-min').value  || 1);
  const pa     = Math.max(0, +$('s-pa').value   || 0);
  const pv     = Math.max(0, +$('s-pv').value   || 0);

  if (!name) { alert('Indiquez le nom du produit.'); $('s-name').focus(); return; }

  const list = readStock();
  const existing = list.find(x => x.name.toLowerCase() === name.toLowerCase() && x.cat === cat);

  if (existing) {
    const oldQty = existing.qty;
    existing.qty  += qty;
    existing.min   = min;
    existing.pa    = pa || existing.pa;
    existing.pv    = pv || existing.pv;
    existing.updated = new Date().toISOString();
    // Enregistrer le mouvement
    addMouvement('entree', existing.id, name, qty, pa, 'Réapprovisionnement');
    saveStock(list);
    showToast(`✅ Stock ${name} mis à jour : +${qty} unités`, 'success');
  } else {
    const item = {
      id: Date.now(), name, cat, qty, min, pa, pv,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    list.push(item);
    saveStock(list);
    if (qty > 0) addMouvement('entree', item.id, name, qty, pa, 'Stock initial');
    showToast(`✅ ${name} ajouté au stock`, 'success');
  }
  // Reset
  $('s-name').value = ''; $('s-qty').value = 1; $('s-pa').value = 0; $('s-pv').value = 0;
};

/* ── Sortie stock ── */
window.sortieStock = function (id) {
  const list = readStock();
  const item = list.find(x => x.id === id);
  if (!item) return;
  const qty = parseInt(prompt(`Quantité à sortir du stock (${item.name}) — Dispo : ${item.qty}`, 1));
  if (isNaN(qty) || qty <= 0) return;
  if (qty > item.qty) { alert('Quantité insuffisante en stock.'); return; }
  const motif = prompt('Motif de sortie :', 'Vente') || 'Vente';
  item.qty -= qty;
  item.updated = new Date().toISOString();
  saveStock(list);
  addMouvement('sortie', id, item.name, qty, item.pv, motif);
  // Ajouter à la caisse si c'est une vente
  if (motif.toLowerCase().includes('vente') && item.pv > 0) {
    const caisse = JSON.parse(localStorage.getItem('samassa_mouvements') || '[]');
    caisse.push({
      id: Date.now(), date: today(), type: 'entree',
      desc: `Vente stock : ${item.name} × ${qty}`,
      amount: qty * item.pv, pm: 'Espèces', cat: 'Vente stock',
      auto: true, timestamp: new Date().toISOString()
    });
    localStorage.setItem('samassa_mouvements', JSON.stringify(caisse));
    showToast(`💰 ${fmt(qty * item.pv)} ajouté en caisse`, 'success');
  }
};

/* ── Supprimer ── */
window.removeStock = function (id) {
  if (!confirm('Supprimer cette référence définitivement ?')) return;
  saveStock(readStock().filter(x => x.id !== id));
  showToast('Article supprimé', 'info');
};

/* ── Mouvements ── */
function addMouvement(type, articleId, name, qty, prix, motif) {
  const mvts = readMvt();
  mvts.unshift({
    id: Date.now(), type, articleId, name, qty,
    prix, total: qty * prix, motif,
    date: today(), timestamp: new Date().toISOString()
  });
  localStorage.setItem(MVT_KEY, JSON.stringify(mvts.slice(0, 200))); // garder 200
  renderMouvements();
}

/* ── Rendu inventaire ── */
function renderInventaire() {
  const list = readStock();
  const search = ($('s-search') || {}).value || '';
  const catFilter = ($('s-cat-filter') || {}).value || '';

  let filtered = list;
  if (search) filtered = filtered.filter(x => x.name.toLowerCase().includes(search.toLowerCase()));
  if (catFilter) filtered = filtered.filter(x => x.cat === catFilter);

  // KPIs
  $('kProducts').textContent = list.length;
  $('kUnits').textContent    = list.reduce((s,x) => s + x.qty, 0).toLocaleString('fr-FR');
  $('kValue').textContent    = fmt(list.reduce((s,x) => s + x.qty * x.pa, 0));
  const alertCount           = list.filter(x => x.qty <= x.min).length;
  $('kLow').textContent      = alertCount;
  $('kLow').closest('.stock-kpi').style.background = alertCount > 0 ? '#FEF3C7' : '';

  const body = $('stockBody');
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#8099B0;padding:28px">Aucun article trouvé</td></tr>';
    return;
  }

  const marge = x => x.pa > 0 && x.pv > 0
    ? `<span style="color:${x.pv>x.pa?'#059652':'#DC2626'};font-weight:700">${Math.round((x.pv-x.pa)/x.pa*100)}%</span>`
    : '—';

  body.innerHTML = filtered.map(x => `
    <tr style="${x.qty <= x.min ? 'background:#FFFBEB' : ''}">
      <td><strong>${esc(x.name)}</strong></td>
      <td style="color:#7A94AF;font-size:11px">${esc(x.cat)}</td>
      <td style="font-weight:900;font-size:15px;${x.qty<=x.min?'color:#B45309':'color:#0A1628'}">${x.qty}</td>
      <td style="color:#7A94AF">${x.min}</td>
      <td style="font-size:12px">${x.pa ? fmt(x.pa) : '—'}</td>
      <td style="font-size:12px">${x.pv ? fmt(x.pv) : '—'}</td>
      <td>${marge(x)}</td>
      <td style="font-size:12px;color:#3D5470">${fmt(x.qty * x.pa)}</td>
      <td><span style="background:${x.qty<=x.min?'#FEF3C7':'#DCFCE7'};color:${x.qty<=x.min?'#92400E':'#166534'};padding:3px 9px;border-radius:10px;font-size:10px;font-weight:800">${x.qty<=x.min?'⚠️ Réappro':'✓ Dispo'}</span></td>
      <td>
        <div style="display:flex;gap:5px">
          <button onclick="sortieStock(${x.id})" class="btn-sortie">− Sortie</button>
          <button onclick="removeStock(${x.id})" class="btn-del">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ── Rendu mouvements ── */
function renderMouvements() {
  const body = $('mvtBody');
  if (!body) return;
  const mvts = readMvt();
  if (!mvts.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#8099B0;padding:20px">Aucun mouvement</td></tr>';
    return;
  }
  body.innerHTML = mvts.slice(0, 50).map(m => `
    <tr>
      <td style="color:#7A94AF;font-size:11px">${m.date || '—'}</td>
      <td><span style="background:${m.type==='entree'?'#F0FDF4':'#FEF2F2'};color:${m.type==='entree'?'#059652':'#DC2626'};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${m.type==='entree'?'▲ Entrée':'▼ Sortie'}</span></td>
      <td style="font-weight:600">${esc(m.name)}</td>
      <td style="font-weight:700">${m.qty}</td>
      <td>${m.prix ? fmt(m.prix) : '—'}</td>
      <td style="color:#7A94AF;font-size:11px">${esc(m.motif||'—')}</td>
    </tr>`).join('');
}

function renderAll() { renderInventaire(); renderMouvements(); }

/* ── Export CSV ── */
window.exportRestockCSV = function () {
  const list=readStock().filter(x=>Number(x.qty||0)<=Number(x.min||0));
  if(!list.length){showToast('✅ Aucun article à réapprovisionner','success');return;}
  const rows=[['Produit','Catégorie','Stock actuel','Seuil minimum','Quantité à acheter','Prix achat unitaire','Budget estimé']];
  list.forEach(x=>{const q=Math.max(1,Number(x.min||0)-Number(x.qty||0));rows.push([x.name,x.cat,x.qty,x.min,q,x.pa,q*Number(x.pa||0)]);});
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download='liste-reapprovisionnement-'+today()+'.csv';a.click();showToast('🛒 Liste d’achats téléchargée','success');
};

window.exportCSV = function () {
  const list = readStock();
  const rows = [['Produit','Catégorie','Qté','Seuil','Prix achat','Prix vente','Valeur stock','État']];
  list.forEach(x => rows.push([
    x.name, x.cat, x.qty, x.min, x.pa, x.pv,
    x.qty * x.pa,
    x.qty <= x.min ? 'À réapprovisionner' : 'Disponible'
  ]));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = 'stock_samassa_' + today() + '.csv';
  a.click();
  showToast('📊 Export CSV téléchargé', 'success');
};

/* ── Toast ── */
function showToast(msg, type) {
  let t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:24px;right:20px;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:700;color:white;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.2);animation:toastIn .3s ease;background:${{ success:'#059652', error:'#DC2626', info:'#0070C0' }[type]||'#0070C0'}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ── Filtres ── */
window.filterStock = function() { renderInventaire(); };

document.addEventListener('DOMContentLoaded', renderAll);
