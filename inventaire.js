/* Inventaire par code-barres : comptage avec la caméra (ZXing), écarts, ajustement du stock avec mouvements « Inventaire ». */
'use strict';
(function () {
  var SK = 'samassa_stock_v2', MK = 'samassa_stock_mouvements', SESSION = 'samassa_inventaire_session';
  var H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  /* Purs */
  function norm(c) { return String(c || '').trim().replace(/^0+(?=\d{12})/, ''); }
  function trouver(stock, code) { var n = norm(code); if (!n) return null; return stock.find(function (s) { return s.barcode && norm(s.barcode) === n; }) || null; }
  function lignes(stock, comptes, tousArticles) {
    return stock.filter(function (s) { return tousArticles || comptes[s.id] !== undefined; }).map(function (s) {
      var c = comptes[s.id], attendu = Number(s.qty) || 0; return { id: s.id, name: s.name, attendu: attendu, compte: c === undefined ? null : c, ecart: c === undefined ? null : c - attendu };
    });
  }
  /* Applique les écarts (uniquement les articles comptés, ou tous si zeroNonComptes) ; renvoie {stock, mouvements} */
  function appliquer(stock, comptes, zeroNonComptes, auj) {
    var mv = [], now = new Date().toISOString(), n = 0;
    var ns = stock.map(function (s) {
      var c = comptes[s.id]; if (c === undefined) { if (!zeroNonComptes) return s; c = 0; }
      var ecart = c - (Number(s.qty) || 0); if (!ecart) return s;
      mv.push({ id: Date.now() + (n++), type: ecart > 0 ? 'entree' : 'sortie', articleId: s.id, name: s.name, qty: Math.abs(ecart), prix: Number(s.pa) || 0, total: Math.abs(ecart) * (Number(s.pa) || 0), motif: 'Inventaire (' + (ecart > 0 ? '+' : '') + ecart + ')', date: auj, timestamp: now });
      return Object.assign({}, s, { qty: c });
    });
    return { stock: ns, mouvements: mv };
  }
  function valeurEcarts(l, stock) { return l.reduce(function (t, x) { var s = stock.find(function (y) { return y.id === x.id; }); return t + (x.ecart || 0) * (s ? Number(s.pa) || 0 : 0); }, 0); }
  window.Inventaire = { norm: norm, trouver: trouver, lignes: lignes, appliquer: appliquer, valeurEcarts: valeurEcarts };

  if (typeof document === 'undefined' || !document.getElementById('iv-app')) return;
  function $(i) { return document.getElementById(i); }
  function auj() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var S = { comptes: {}, inconnus: [] }; try { var sv = JSON.parse(localStorage.getItem(SESSION) || 'null'); if (sv && sv.comptes) S = sv; } catch (e) {}
  function sauver() { try { localStorage.setItem(SESSION, JSON.stringify(S)); } catch (e) {} }
  var lecteur = null, dernier = { code: '', t: 0 };
  function bip() { try { var a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(); setTimeout(function () { o.stop(); a.close(); }, 90); } catch (e) {} try { navigator.vibrate && navigator.vibrate(40); } catch (e) {} }
  function code(c) {
    var t = Date.now(); if (c === dernier.code && t - dernier.t < 1500) return; dernier = { code: c, t: t };
    var a = trouver(lire(SK), c);
    if (a) { S.comptes[a.id] = (S.comptes[a.id] || 0) + 1; $('iv-last').textContent = '✔ ' + a.name + ' → ' + S.comptes[a.id]; bip(); }
    else { if (S.inconnus.indexOf(c) < 0) S.inconnus.push(c); $('iv-last').textContent = '❓ Code inconnu : ' + c; }
    sauver(); rendre();
  }
  function rendre() {
    var st = lire(SK), l = lignes(st, S.comptes, $('iv-tous').checked), ecarts = l.filter(function (x) { return x.ecart }).length, compte = Object.keys(S.comptes).length;
    $('iv-kpi').innerHTML = '<div class="k"><b>' + compte + '</b><span>Articles comptés / ' + st.length + '</span></div><div class="k"><b>' + ecarts + '</b><span>Écarts</span></div><div class="k"><b>' + Math.round(valeurEcarts(l, st)).toLocaleString('fr-FR') + ' F</b><span>Valeur des écarts (achat)</span></div>';
    $('iv-liste').innerHTML = l.length ? l.map(function (x) {
      var cl = x.ecart === null ? '' : x.ecart === 0 ? 'g' : 'r';
      return '<div class="row" data-id="' + x.id + '"><div class="inf"><b>' + H(x.name) + '</b><div class="m">Attendu ' + x.attendu + (x.compte !== null ? ' · compté ' + x.compte : ' · non compté') + '</div></div><div class="act">' + (x.ecart !== null ? '<span class="p ' + cl + '">' + (x.ecart > 0 ? '+' : '') + x.ecart + '</span>' : '') + '<button class="b g2" data-d="-1">−</button><button class="b ok" data-d="1">+</button></div></div>';
    }).join('') : '<div class="vide">Scannez un article ou passez-le en « tous les articles ». Pensez à renseigner le code-barres de chaque article dans Stock.</div>';
    $('iv-inc').innerHTML = S.inconnus.length ? '<div class="m">Codes inconnus : ' + S.inconnus.map(H).join(', ') + '</div>' : '';
  }
  function arreter() { try { if (lecteur) lecteur.reset(); } catch (e) {} lecteur = null; $('iv-video').style.display = 'none'; $('iv-cam').textContent = '📷 Scanner'; }
  function demarrer() {
    if (typeof ZXing === 'undefined') { alert('Lecteur de codes-barres non chargé.'); return; }
    var h = new Map(); h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39, ZXing.BarcodeFormat.QR_CODE]); h.set(ZXing.DecodeHintType.TRY_HARDER, true);
    lecteur = new ZXing.BrowserMultiFormatReader(h); $('iv-video').style.display = 'block'; $('iv-cam').textContent = '⏹ Arrêter';
    lecteur.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, 'iv-video', function (r) { if (r) code(r.getText()); }).catch(function () { arreter(); alert('Caméra inaccessible : autorisez-la dans les réglages du navigateur, ou saisissez le code à la main.'); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'iv-cam') { lecteur ? arreter() : demarrer(); return; }
    if (t.id === 'iv-man') { var c = $('iv-code').value.trim(); if (c) { dernier = { code: '', t: 0 }; code(c); $('iv-code').value = ''; } return; }
    if (t.id === 'iv-reset') { if (confirm('Effacer le comptage en cours ?')) { S = { comptes: {}, inconnus: [] }; sauver(); rendre(); } return; }
    if (t.id === 'iv-apply') {
      var z = $('iv-zero').checked, r = appliquer(lire(SK), S.comptes, z, auj()); if (!r.mouvements.length) { alert('Aucun écart à appliquer.'); return; }
      if (!confirm(r.mouvements.length + ' article(s) seront ajustés dans le stock. Continuer ?')) return;
      localStorage.setItem(SK, JSON.stringify(r.stock)); localStorage.setItem(MK, JSON.stringify(r.mouvements.concat(lire(MK)).slice(0, 200))); S = { comptes: {}, inconnus: [] }; sauver(); $('iv-last').textContent = '✔ Stock ajusté.'; rendre(); return;
    }
    var d = t.dataset && t.dataset.d; if (d) { var id = t.closest('.row').dataset.id, k = isNaN(id) ? id : Number(id); S.comptes[k] = Math.max(0, (S.comptes[k] === undefined ? (Number((lire(SK).find(function (s) { return s.id === k; }) || {}).qty) || 0) : S.comptes[k]) + Number(d)); sauver(); rendre(); }
  });
  document.addEventListener('change', function (e) { if (e.target.id === 'iv-tous') rendre(); });
  window.addEventListener('pagehide', arreter);
  window.Inventaire._code = code;
  if (document.readyState !== 'loading') rendre(); else document.addEventListener('DOMContentLoaded', rendre);
})();
