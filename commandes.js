/* Commandes fournisseurs : commande, réception (stock + prix d'achat moyen), règlement */
'use strict';
(function () {
  var KEY = 'samassa_commandes', STOCK = 'samassa_stock_v2', MVT = 'samassa_stock_mouvements', H = window.escHtml;
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function ecrire(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function money(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function aujourdhui() { return new Date().toISOString().slice(0, 10); }
  function fr(s) { return s ? new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  function totalCmd(c) { return (c.lignes || []).reduce(function (s, l) { return s + (Number(l.qte) || 0) * (Number(l.prix) || 0); }, 0); }

  /* Réception : fonction pure sur copies, testable. Renvoie { stock, mvts }. */
  function appliquerReception(cmd, stock, mvts, maintenant) {
    stock = stock.map(function (a) { return Object.assign({}, a); }); mvts = mvts.slice();
    var t = maintenant || new Date().toISOString(), d = t.slice(0, 10), n = 0;
    (cmd.lignes || []).forEach(function (l) {
      var q = Math.floor(Number(l.qte) || 0), p = Number(l.prix) || 0; if (q <= 0) return;
      var nom = String(l.nom || '').trim();
      var a = stock.find(function (x) { return (l.articleId != null && x.id === l.articleId) || String(x.name).toLowerCase() === nom.toLowerCase(); });
      if (!a) { a = { id: Date.now() + (n++), name: nom, cat: 'Divers', barcode: '', qty: 0, min: 0, pa: 0, pv: Number(l.pv) || 0, created: t }; stock.push(a); }
      var ancien = Math.max(0, Number(a.qty) || 0);
      a.pa = ancien > 0 ? Math.round((ancien * (Number(a.pa) || 0) + q * p) / (ancien + q)) : p;
      a.qty = ancien + q; a.updated = t;
      if (!(Number(a.pv) > 0) && Number(l.pv) > 0) a.pv = Number(l.pv);
      mvts.unshift({ id: Date.now() + (n++), type: 'entree', articleId: a.id, name: a.name, qty: q, prix: p, total: q * p, motif: 'Réception ' + cmd.numero, date: d, timestamp: t });
    });
    return { stock: stock, mvts: mvts.slice(0, 200) };
  }

  function recevoir(id) {
    var l = lire(KEY), c = l.find(function (x) { return x.id === id; }); if (!c || c.statut !== 'Commandée') return;
    if (!confirm('Réceptionner la commande ' + c.numero + ' ? Le stock et les prix d\'achat seront mis à jour.')) return;
    var r = appliquerReception(c, lire(STOCK), lire(MVT));
    ecrire(STOCK, r.stock); ecrire(MVT, r.mvts);
    c.statut = 'Reçue'; c.recue = new Date().toISOString(); ecrire(KEY, l); rendre();
    if (window.ST && ST.toast) ST.toast('✅ Stock mis à jour', 'success');
  }
  function regler(id) {
    var l = lire(KEY), c = l.find(function (x) { return x.id === id; }); if (!c) return;
    var reste = totalCmd(c) - (Number(c.paye) || 0); if (reste <= 0) return;
    var v = prompt('Montant réglé au fournisseur (reste ' + money(reste) + ') :', String(reste)); if (v === null) return;
    var m = Math.min(reste, Math.max(0, parseFloat(String(v).replace(/\s/g, '')) || 0)); if (!(m > 0)) return;
    c.paye = (Number(c.paye) || 0) + m; ecrire(KEY, l);
    var caisse = lire('samassa_mouvements');
    caisse.push({ id: 'ACH-' + Date.now(), date: aujourdhui(), type: 'sortie', desc: 'Achat stock — ' + c.fournisseur + ' (' + c.numero + ')', amount: m, pm: 'Espèces', cat: 'Achat stock', auto: true, timestamp: new Date().toISOString() });
    ecrire('samassa_mouvements', caisse); rendre();
  }
  function annuler(id) { var l = lire(KEY), c = l.find(function (x) { return x.id === id; }); if (!c || c.statut !== 'Commandée' || !confirm('Annuler la commande ' + c.numero + ' ?')) return; c.statut = 'Annulée'; ecrire(KEY, l); rendre(); }
  function supprimer(id) { var c = lire(KEY).find(function (x) { return x.id === id; }); if (!c || c.statut === 'Reçue' || !confirm('Supprimer la commande ' + c.numero + ' ?')) return; ecrire(KEY, lire(KEY).filter(function (x) { return x.id !== id; })); rendre(); }

  function carte(c) {
    var tot = totalCmd(c), reste = tot - (Number(c.paye) || 0), cl = c.statut === 'Reçue' ? 'recu' : c.statut === 'Annulée' ? 'ann' : 'att', pill = c.statut === 'Reçue' ? 'g' : c.statut === 'Annulée' ? 'x' : '';
    return '<div class="card ' + cl + '" data-id="' + H(c.id) + '"><div class="top"><div><div class="nm">' + H(c.fournisseur) + ' <span style="color:#0070C0;font-weight:600">· ' + H(c.numero) + '</span></div><div class="sub">Commandée le ' + fr(c.date) + (c.recue ? ' · reçue le ' + fr(c.recue) : '') + '</div></div>' +
      '<div style="text-align:right"><span class="pill ' + pill + '">' + H(c.statut) + '</span><div class="sub" style="margin-top:6px"><b>' + money(tot) + '</b>' + (c.statut !== 'Annulée' && reste > 0 ? '<br><b style="color:#DC2626">Reste à payer : ' + money(reste) + '</b>' : c.statut !== 'Annulée' ? '<br><span style="color:#166534">Payée</span>' : '') + '</div></div></div>' +
      '<div class="lines">' + (c.lignes || []).map(function (l) { return '<div><span>' + H(l.nom) + ' × ' + H(l.qte) + '</span><span>' + money((l.qte || 0) * (l.prix || 0)) + '</span></div>'; }).join('') + '</div>' +
      '<div class="acts">' + (c.statut === 'Commandée' ? '<button class="ok" data-a="rec">📥 Réceptionner</button><button data-a="ann">Annuler</button>' : '') + (c.statut !== 'Annulée' && reste > 0 ? '<button data-a="pay">💰 Régler le fournisseur</button>' : '') + (c.statut !== 'Reçue' ? '<button class="x" data-a="del">🗑</button>' : '') + '</div></div>';
  }
  function rendre() {
    var tous = lire(KEY), q = (document.getElementById('q').value || '').toLowerCase(), f = document.getElementById('flt').value;
    var att = tous.filter(function (c) { return c.statut === 'Commandée'; }), dette = tous.filter(function (c) { return c.statut !== 'Annulée'; }).reduce(function (s, c) { return s + Math.max(0, totalCmd(c) - (Number(c.paye) || 0)); }, 0);
    var mois = aujourdhui().slice(0, 7), achats = tous.filter(function (c) { return c.statut === 'Reçue' && (c.recue || '').slice(0, 7) === mois; }).reduce(function (s, c) { return s + totalCmd(c); }, 0);
    document.getElementById('kpis').innerHTML = '<div class="kpi"><b>' + att.length + '</b><span>À recevoir</span></div><div class="kpi ' + (dette ? 'warn' : '') + '"><b>' + money(dette) + '</b><span>Dû aux fournisseurs</span></div><div class="kpi"><b>' + money(achats) + '</b><span>Reçu ce mois</span></div><div class="kpi"><b>' + tous.length + '</b><span>Commandes</span></div>';
    var l = tous.filter(function (c) { return (!f || c.statut === f) && (!q || [c.fournisseur, c.numero].concat((c.lignes || []).map(function (x) { return x.nom; })).join(' ').toLowerCase().indexOf(q) >= 0); });
    l.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.numero).localeCompare(String(a.numero)); });
    document.getElementById('liste').innerHTML = l.length ? l.map(carte).join('') : '<div class="empty">Aucune commande. Cliquez sur « Nouvelle commande ».</div>';
  }

  function ligne() {
    var d = document.createElement('div'); d.className = 'ln';
    d.innerHTML = '<div><label>Article</label><input class="l-nom" list="f-art" maxlength="80" autocomplete="off"></div><div><label>Qté</label><input class="l-q" type="number" min="1" value="1"></div><div><label>Prix d\'achat</label><input class="l-p" type="number" min="0"></div><div><label>Prix de vente</label><input class="l-v" type="number" min="0" placeholder="facultatif"></div><button type="button" aria-label="Retirer">✕</button>';
    d.querySelector('button').onclick = function () { d.remove(); total(); };
    d.querySelector('.l-nom').addEventListener('change', function () { var a = lire(STOCK).find(function (x) { return String(x.name).toLowerCase() === this.value.trim().toLowerCase(); }, this); if (a) { var p = d.querySelector('.l-p'), v = d.querySelector('.l-v'); if (!p.value) p.value = a.pa || ''; if (!v.value) v.value = a.pv || ''; total(); } });
    d.addEventListener('input', total); document.getElementById('f-lines').appendChild(d);
  }
  function lignesForm() {
    return Array.prototype.map.call(document.querySelectorAll('#f-lines .ln'), function (d) {
      return { nom: d.querySelector('.l-nom').value.trim().slice(0, 80), qte: Math.floor(+d.querySelector('.l-q').value || 0), prix: +d.querySelector('.l-p').value || 0, pv: +d.querySelector('.l-v').value || 0 };
    }).filter(function (l) { return l.nom && l.qte > 0; });
  }
  function total() { document.getElementById('f-tot').textContent = money(lignesForm().reduce(function (s, l) { return s + l.qte * l.prix; }, 0)); }
  function ouvrir() {
    document.getElementById('f-four').value = ''; document.getElementById('f-lines').innerHTML = ''; ligne(); total();
    document.getElementById('f-four-l').innerHTML = lire('samassa_fournisseurs').map(function (s) { return '<option value="' + H(s.name) + '">'; }).join('');
    document.getElementById('f-art').innerHTML = lire(STOCK).map(function (a) { return '<option value="' + H(a.name) + '">'; }).join('');
    document.getElementById('dlg').showModal();
  }
  function enregistrer() {
    var four = document.getElementById('f-four').value.trim().slice(0, 80), lg = lignesForm();
    if (!four || !lg.length) { alert('Indiquez le fournisseur et au moins un article avec sa quantité.'); return; }
    var stock = lire(STOCK);
    lg.forEach(function (l) { var a = stock.find(function (x) { return String(x.name).toLowerCase() === l.nom.toLowerCase(); }); if (a) l.articleId = a.id; });
    var l = lire(KEY), num = 'CMD-' + String(l.length + 1).padStart(3, '0');
    while (l.some(function (x) { return x.numero === num; })) num = 'CMD-' + String(parseInt(num.slice(4), 10) + 1).padStart(3, '0');
    l.push({ id: 'C' + Date.now(), numero: num, fournisseur: four, date: aujourdhui(), statut: 'Commandée', lignes: lg, paye: 0, cree: new Date().toISOString() });
    ecrire(KEY, l); document.getElementById('dlg').close(); rendre();
  }
  window.Commandes = { appliquerReception: appliquerReception, totalCmd: totalCmd };
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('q').addEventListener('input', rendre); document.getElementById('flt').addEventListener('change', rendre);
    document.getElementById('nouv').onclick = ouvrir; document.getElementById('f-add').onclick = ligne;
    document.getElementById('d-ok').onclick = enregistrer; document.getElementById('d-no').onclick = function () { document.getElementById('dlg').close(); };
    document.addEventListener('click', function (e) { var b = e.target.closest('button[data-a]'); if (!b) return; var id = b.closest('.card').dataset.id, a = b.dataset.a; if (a === 'rec') recevoir(id); else if (a === 'pay') regler(id); else if (a === 'ann') annuler(id); else if (a === 'del') supprimer(id); });
    window.addEventListener('storage', rendre); rendre();
  });
})();
