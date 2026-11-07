'use strict';
(function () {
  var K = 'samassa_catalogue', H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function $(i) { return document.getElementById(i); }
  function stock() { try { return JSON.parse(localStorage.getItem('samassa_stock_v2') || '[]'); } catch (e) { return []; } }
  var cfg; try { cfg = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { cfg = {}; } cfg.exclus = cfg.exclus || []; cfg.services = cfg.services || [];
  if (!cfg.init) { cfg.init = 1; cfg.services = [{ n: "Photos d'identité (4 photos)", p: 1000, c: 'Services' }, { n: 'Impression / photocopie (page)', p: 100, c: 'Services' }, { n: 'Réparation ordinateur (diagnostic)', p: 5000, c: 'Services' }]; }
  ['nom', 'tel', 'adr'].forEach(function (k) { if (cfg[k]) $('cg-' + k).value = cfg[k]; });
  function sauver() { cfg.nom = $('cg-nom').value; cfg.tel = $('cg-tel').value; cfg.adr = $('cg-adr').value; try { localStorage.setItem(K, JSON.stringify(cfg)); } catch (e) {} }
  function rendre() {
    var st = stock().filter(function (s) { return Number(s.pv) > 0 && Number(s.qty) > 0; });
    $('cg-stock').innerHTML = st.length ? st.map(function (s) { return '<div class="row"><label><input type="checkbox" data-s="' + s.id + '"' + (cfg.exclus.indexOf(s.id) < 0 ? ' checked' : '') + '> ' + H(s.name) + '</label><span>' + Number(s.pv).toLocaleString('fr-FR') + ' F · ' + s.qty + ' en stock</span></div>'; }).join('') : '<div class="note">Aucun produit en stock avec un prix de vente. Ajoutez-en dans Stock.</div>';
    $('cg-serv').innerHTML = cfg.services.map(function (s, i) { return '<div class="row"><span>' + H(s.n) + '</span><span>' + Number(s.p).toLocaleString('fr-FR') + ' F <button class="b g2" data-x="' + i + '">🗑️</button></span></div>'; }).join('') || '<div class="note">Aucun service.</div>';
  }
  document.addEventListener('change', function (e) { var s = e.target.dataset && e.target.dataset.s; if (s === undefined) return; var id = isNaN(s) ? s : Number(s), i = cfg.exclus.indexOf(id); if (e.target.checked && i >= 0) cfg.exclus.splice(i, 1); if (!e.target.checked && i < 0) cfg.exclus.push(id); sauver(); });
  document.addEventListener('click', async function (e) {
    var t = e.target; if (t.dataset && t.dataset.x !== undefined) { cfg.services.splice(Number(t.dataset.x), 1); sauver(); rendre(); return; }
    if (t.id === 'cg-add') { var n = $('cg-sn').value.trim(), p = Number($('cg-sp').value); if (!n || !(p >= 0)) return; cfg.services.push({ n: n, p: p, c: 'Services' }); $('cg-sn').value = ''; $('cg-sp').value = ''; sauver(); rendre(); return; }
    if (t.id === 'cg-gen') {
      sauver(); var l = Catalogue.articles(stock(), cfg); if (!l.length) { alert('Rien à publier : cochez des produits ou ajoutez un service.'); return; }
      var code = await Catalogue.encoder({ s: { n: cfg.nom, t: cfg.tel, a: cfg.adr }, i: l }), url = location.origin + '/catalogue.html#c=' + code;
      $('cg-lien').style.display = 'block'; $('cg-lien').value = url; $('cg-act').style.display = 'block'; $('cg-open').href = url;
      $('cg-note').textContent = l.length + ' article(s) · lien de ' + url.length + ' caractères' + (url.length > 7000 ? ' — long : décochez quelques produits pour un partage fiable.' : '.') + ' Le catalogue est figé : régénérez-le après un changement de prix ou de stock.';
      var q = $('cg-qr'); q.innerHTML = ''; try { if (url.length < 2000) new QRCode(q, { text: url, width: 160, height: 160 }); } catch (x) {}
    }
    if (t.id === 'cg-copy') { try { await navigator.clipboard.writeText($('cg-lien').value); t.textContent = '✔ Copié'; } catch (x) { $('cg-lien').select(); } }
    if (t.id === 'cg-wa') window.open('https://wa.me/?text=' + encodeURIComponent('🛍️ Notre catalogue ' + cfg.nom + ' : ' + $('cg-lien').value), '_blank');
  });
  ['cg-nom', 'cg-tel', 'cg-adr'].forEach(function (i) { $(i).addEventListener('input', sauver); });
  rendre();
})();
