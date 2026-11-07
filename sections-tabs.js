/* Sections de l'application organisées en sous-onglets : Caisse, RDV, Historique (accueil) et PDF & Scan. */
'use strict';
(function () {
  var CSS = '.st-bar{display:flex;gap:6px;margin:0 0 14px;padding:4px;background:#E8EEF5;border-radius:12px;overflow-x:auto;-webkit-overflow-scrolling:touch}' +
    '.st-b{flex:1 0 auto;border:0;background:none;border-radius:9px;padding:9px 12px;font:inherit;font-size:13px;font-weight:800;color:#475569;cursor:pointer;white-space:nowrap}' +
    '.st-b.on{background:#fff;color:#0A1628;box-shadow:0 1px 4px rgba(10,22,40,.15)}.st-n{display:inline-block;margin-left:5px;min-width:18px;padding:0 6px;border-radius:99px;background:#0877B9;color:#fff;font-size:10px;font-weight:800;line-height:18px}' +
    '.st-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 12px}.st-k{background:#fff;border:1px solid #D7E3EE;border-radius:12px;padding:10px 12px}.st-kv{font-size:17px;font-weight:900;color:#0A1628;white-space:nowrap}.st-kl{font-size:11px;font-weight:700;color:#64748B;margin-top:2px}.st-k.e .st-kv{color:#16A34A}.st-k.s .st-kv{color:#DC2626}' +
    '.st-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.st-chip{border:1.5px solid #D7E3EE;background:#fff;border-radius:99px;padding:7px 12px;font:inherit;font-size:12px;font-weight:800;color:#334155;cursor:pointer}.st-chip.on{background:#0A1628;border-color:#0A1628;color:#fff}' +
    '.st-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.st-link{display:flex;gap:12px;align-items:center;background:#fff;border:1px solid #D7E3EE;border-radius:14px;padding:16px;text-decoration:none;color:#0A1628}.st-link b{display:block;font-size:14px}.st-link small{color:#64748B}.st-link span{font-size:28px}';
  var css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
  var ls = function (k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  var fmt = function (n) { return Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' F'; };
  var ssGet = function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, ssSet = function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} };

  /* panes : tableau d'éléments ; onglets : [{id,label}] ; renvoie {voir(id)} */
  function sousOnglets(avant, panes, onglets, cle, defaut) {
    var bar = document.createElement('div'); bar.className = 'st-bar'; bar.setAttribute('role', 'tablist');
    function voir(id) { onglets.forEach(function (o, i) { var on = o.id === id; panes[i].style.display = on ? '' : 'none'; o.btn.classList.toggle('on', on); o.btn.setAttribute('aria-selected', on ? 'true' : 'false'); }); ssSet(cle, id); }
    onglets.forEach(function (o) { var b = document.createElement('button'); b.type = 'button'; b.className = 'st-b'; b.setAttribute('role', 'tab'); b.innerHTML = o.label; b.onclick = function () { voir(o.id); }; o.btn = b; bar.appendChild(b); });
    avant.parentNode.insertBefore(bar, avant);
    var init = ssGet(cle); voir(onglets.some(function (o) { return o.id === init; }) ? init : defaut);
    return { voir: voir, bar: bar };
  }
  var cartes = function (tab) { return [].filter.call(tab.children, function (e) { return e.classList.contains('card'); }); };

  /* ===== Caisse ===== */
  function caisse() {
    var tab = document.getElementById('tab-mouvements'); if (!tab) return; var c = cartes(tab); if (c.length < 3) return;
    var k = document.createElement('div'); k.className = 'st-kpis'; k.id = 'st-caisse-kpi';
    k.innerHTML = '<div class="st-k"><div class="st-kv" id="stk-solde">—</div><div class="st-kl">Solde du jour</div></div><div class="st-k e"><div class="st-kv" id="stk-e">—</div><div class="st-kl">Entrées du jour</div></div><div class="st-k s"><div class="st-kv" id="stk-s">—</div><div class="st-kl">Sorties du jour</div></div>';
    tab.insertBefore(k, c[0]);
    var ong = [{ id: 'saisie', label: '➕ Saisie' }, { id: 'liste', label: '📊 Mouvements' }, { id: 'cloture', label: '🔒 Clôture' }];
    sousOnglets(c[0], [c[0], c[2], c[1]], ong, 'st_caisse', 'saisie');
    function maj() {
      var auj = new Date().toISOString().slice(0, 10), m = ls('samassa_mouvements').filter(function (x) { return String(x.date).slice(0, 10) === auj; }), e = 0, s = 0;
      m.forEach(function (x) { if (x.type === 'entree') e += +x.amount || 0; else s += +x.amount || 0; });
      document.getElementById('stk-e').textContent = fmt(e); document.getElementById('stk-s').textContent = fmt(s); document.getElementById('stk-solde').textContent = fmt(e - s);
    }
    var base = window.renderMouvements; if (typeof base === 'function') window.renderMouvements = function () { var r = base.apply(this, arguments); try { maj(); } catch (e) {} return r; };
    maj();
  }
  /* ===== RDV ===== */
  function rdv() {
    var tab = document.getElementById('tab-retraits'); if (!tab) return; var c = cartes(tab); if (c.length < 2) return;
    var s = sousOnglets(c[0], [c[0], c[1]], [{ id: 'attente', label: '⏳ En attente' }, { id: 'hist', label: '📋 Historique journalier' }], 'st_rdv', 'attente');
    var att = s.bar.querySelector('.st-b'), base = window.renderRetraits;
    function n() { var v = (document.getElementById('rt-att') || {}).textContent; if (v && v !== '—') { var sp = att.querySelector('.st-n'); if (!sp) { sp = document.createElement('span'); sp.className = 'st-n'; att.appendChild(sp); } sp.textContent = v; } }
    if (typeof base === 'function') window.renderRetraits = function () { var r = base.apply(this, arguments); try { n(); } catch (e) {} return r; };
    n();
  }
  /* ===== Historique : filtres par catégorie ===== */
  function historique() {
    var sel = document.getElementById('h-type'), tab = document.getElementById('tab-historique'); if (!sel || !tab) return;
    var G = window.HIST_GROUPES = {
      'grp:ventes': ['samassa_recus', 'samassa_recus_vente', 'samassa_factures', 'samassa_factures_mat', 'samassa_devis'],
      'grp:atelier': ['samassa_bons_reparation', 'samassa_interventions'],
      'grp:cyber': ['samassa_recus_cyber', 'samassa_factures_cyber'],
      'grp:autres': ['samassa_docs_admin', 'samassa_clients']
    };
    var L = [['', '📂 Tous'], ['grp:ventes', '💰 Ventes'], ['grp:atelier', '🔧 Atelier'], ['grp:cyber', '☕ Cyber'], ['grp:autres', '📝 Autres']];
    Object.keys(G).forEach(function (g, i) { var o = document.createElement('option'); o.value = g; o.textContent = L[i + 1][1]; sel.insertBefore(o, sel.children[1]); });
    var zone = document.createElement('div'); zone.className = 'st-chips'; zone.id = 'st-hist-chips';
    function compte(cles) { return cles.reduce(function (a, k) { return a + ls(k).length; }, 0); }
    function dessiner() {
      zone.textContent = '';
      L.forEach(function (x) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'st-chip' + (sel.value === x[0] ? ' on' : '');
        var cles = x[0] ? G[x[0]] : [].concat.apply([], Object.keys(G).map(function (g) { return G[g]; }));
        b.textContent = x[1] + ' (' + compte(cles) + ')'; b.onclick = function () { sel.value = x[0]; if (typeof window.renderHistory === 'function') window.renderHistory(); dessiner(); }; zone.appendChild(b);
      });
    }
    tab.insertBefore(zone, tab.firstChild); dessiner();
    sel.addEventListener('change', dessiner);
    var base = window.renderHistory; if (typeof base === 'function') window.renderHistory = function () { var r = base.apply(this, arguments); try { dessiner(); } catch (e) {} return r; };
  }
  /* ===== PDF & Scan ===== */
  function pdf() {
    var main = document.querySelector('main.il-wrap'); if (!main) return; var c = [].filter.call(main.children, function (e) { return e.classList.contains('il-card'); }); if (c.length < 2) return;
    var liens = document.createElement('div'); liens.className = 'il-card'; liens.innerHTML = '<div class="st-links"><a class="st-link" href="scanner.html"><span>📷</span><div><b>Scanner intelligent</b><small>Photos de documents → PDF multi-pages, OCR</small></div></a><a class="st-link" href="photo-identite.html"><span>🪪</span><div><b>Photos d\'identité</b><small>Formats par pays, planches d\'impression</small></div></a><a class="st-link" href="redacteur-ia-mali/index.html"><span>✍️</span><div><b>Rédacteur IA Mali</b><small>Lettres et documents administratifs</small></div></a></div>';
    main.appendChild(liens);
    sousOnglets(c[0], [c[0], c[1], liens], [{ id: 'local', label: '⚡ Outils instantanés' }, { id: 'web', label: '🌐 Service en ligne' }, { id: 'scan', label: '📷 Scan &amp; photos' }], 'st_pdf', 'local');
    c[0].style.marginBottom = '0'; c[1].style.marginBottom = '0';
  }
  document.addEventListener('DOMContentLoaded', function () { try { caisse(); rdv(); historique(); pdf(); } catch (e) { console.error('Sections :', e); } });
})();
