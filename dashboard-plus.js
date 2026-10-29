/* ==================================================================
   dashboard-plus.js (v1.0) : « Bilan du mois » sur le tableau de bord
   - Entrées, sorties et bénéfice net du mois, comparés à la même période du mois dernier
   - Objectif mensuel (modifiable) avec barre de progression et prévision de fin de mois
   - Meilleur jour, dépenses principales
   - Factures cyber à encaisser (montant restant dû, retards signalés)
   Lit seulement les données existantes (samassa_mouvements, samassa_factures_cyber).
   ================================================================== */
(function () {
  'use strict';
  if (window.__dashPlus) return; window.__dashPlus = true;

  const lire = k => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const fmt = n => Math.round(Number(n) || 0).toLocaleString('fr-FR');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const jourDe = m => String(m.date || m.timestamp || '').slice(0, 10);
  const montant = m => Number(m.amount != null ? m.amount : m.montant) || 0;
  const cleMois = (a, m) => a + '-' + String(m + 1).padStart(2, '0');
  const pad = n => String(n).padStart(2, '0');

  // Calcul pur (testable) : maintenant = Date
  function calculer(mouvements, factures, objectif, maintenant) {
    const a = maintenant.getFullYear(), m = maintenant.getMonth(), j = maintenant.getDate();
    const mois = cleMois(a, m);
    const pa = m === 0 ? a - 1 : a, pm = m === 0 ? 11 : m - 1;
    const moisPrec = cleMois(pa, pm);
    const joursMois = new Date(a, m + 1, 0).getDate();
    const joursPrec = new Date(pa, pm + 1, 0).getDate();
    const jusquA = Math.min(j, joursPrec);                       // même période du mois dernier
    const R = { entrees: 0, sorties: 0, entreesPrec: 0, sortiesPrec: 0, parJour: {}, cats: {} };
    mouvements.forEach(x => {
      const d = jourDe(x), v = montant(x); if (!d || !v) return;
      const ent = x.type === 'entree', sor = x.type === 'sortie';
      if (d.startsWith(mois)) {
        if (ent) { R.entrees += v; R.parJour[d] = (R.parJour[d] || 0) + v; }
        if (sor) { R.sorties += v; const c = x.cat || 'Autres'; R.cats[c] = (R.cats[c] || 0) + v; }
      } else if (d.startsWith(moisPrec) && parseInt(d.slice(8, 10), 10) <= jusquA) {
        if (ent) R.entreesPrec += v; if (sor) R.sortiesPrec += v;
      }
    });
    R.benefice = R.entrees - R.sorties; R.beneficePrec = R.entreesPrec - R.sortiesPrec;
    R.objectif = Number(objectif) || 0;
    R.progression = R.objectif ? Math.min(100, Math.round(R.entrees / R.objectif * 100)) : 0;
    R.prevision = j ? Math.round(R.entrees / j * joursMois) : 0;
    const best = Object.entries(R.parJour).sort((x, y) => y[1] - x[1])[0];
    R.meilleurJour = best ? { jour: best[0], total: best[1] } : null;
    R.topDepenses = Object.entries(R.cats).sort((x, y) => y[1] - x[1]).slice(0, 3);
    const aujourdhui = a + '-' + pad(m + 1) + '-' + pad(j);
    R.aEncaisser = 0; R.nbImpayes = 0; R.liste = [];
    factures.forEach(f => {
      const du = Number(f.amountDue) || 0; if (du <= 0) return;
      R.aEncaisser += du; R.nbImpayes++;
      const retard = !!(f.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(f.dueDate) && f.dueDate < aujourdhui);
      R.liste.push({ n: f.number, client: f.client, du, retard, echeance: f.dueDate || '' });
    });
    R.liste.sort((x, y) => (y.retard - x.retard) || (y.du - x.du));
    R.nbRetard = R.liste.filter(x => x.retard).length;
    R.moisLibelle = maintenant.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return R;
  }

  const variation = (cur, prev, inverse) => {
    if (!prev && !cur) return '<span style="color:#8099B0">—</span>';
    if (!prev) return '<span style="color:#8099B0">nouveau</span>';
    const p = Math.round((cur - prev) / Math.abs(prev) * 100), bon = inverse ? p <= 0 : p >= 0;
    return '<span style="color:' + (bon ? '#16A34A' : '#DC2626') + ';font-weight:700">' + (p >= 0 ? '▲ +' : '▼ ') + p + ' %</span>';
  };
  const tuile = (titre, valeur, couleur, sous) =>
    '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:12px 14px;min-width:0">' +
    '<div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.04em">' + titre + '</div>' +
    '<div style="font-size:19px;font-weight:800;color:' + couleur + ';margin:3px 0;word-break:break-word">' + valeur + '</div>' +
    '<div style="font-size:11px;color:#64748B">' + sous + '</div></div>';

  function html(R) {
    const objectifTxt = R.objectif
      ? '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span>🎯 Objectif : <b>' + fmt(R.objectif) + ' F</b></span><span><b>' + R.progression + ' %</b></span></div>' +
        '<div style="height:10px;background:#E2E8F0;border-radius:99px;overflow:hidden"><div style="height:100%;width:' + R.progression + '%;background:linear-gradient(90deg,#0088CC,#16A34A);border-radius:99px"></div></div>' +
        '<div style="font-size:11px;color:#64748B;margin-top:5px">Prévision fin de mois au rythme actuel : <b>' + fmt(R.prevision) + ' F</b> ' +
        (R.prevision >= R.objectif ? '<span style="color:#16A34A">(objectif atteignable)</span>' : '<span style="color:#D97706">(en dessous de l\'objectif)</span>') + '</div>'
      : '<div style="font-size:12px;color:#64748B">Aucun objectif défini pour ce mois.</div>';
    const meilleur = R.meilleurJour ? 'Meilleur jour : <b>' + R.meilleurJour.jour.split('-').reverse().join('/') + '</b> (' + fmt(R.meilleurJour.total) + ' F)' : 'Pas encore d\'entrée ce mois-ci';
    const dep = R.topDepenses.length ? R.topDepenses.map(([c, v]) => esc(c) + ' ' + fmt(v) + ' F').join(' · ') : 'Aucune dépense enregistrée';
    const impayes = R.nbImpayes
      ? '<div style="margin-top:14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px">' +
        '<div style="font-weight:800;color:#B45309;font-size:13px">💸 À encaisser : ' + fmt(R.aEncaisser) + ' F <span style="font-weight:600">(' + R.nbImpayes + ' facture' + (R.nbImpayes > 1 ? 's' : '') + (R.nbRetard ? ', dont ' + R.nbRetard + ' en retard' : '') + ')</span></div>' +
        R.liste.slice(0, 3).map(x => '<div style="font-size:12px;color:#92400E;margin-top:4px">' + (x.retard ? '🔴' : '🟡') + ' ' + esc(x.n) + ' – ' + esc(x.client || 'Client') + ' : <b>' + fmt(x.du) + ' F</b>' + (x.echeance ? ' (échéance ' + esc(x.echeance.split('-').reverse().join('/')) + ')' : '') + '</div>').join('') + '</div>'
      : '';
    return '<div class="card" style="margin-bottom:20px"><div class="card-header"><span class="card-title">📅 Bilan de ' + esc(R.moisLibelle) + '</span>' +
      '<button type="button" id="dp-obj" class="card-link">🎯 Objectif</button></div><div class="card-body">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">' +
      tuile('Entrées', fmt(R.entrees) + ' F', '#16A34A', variation(R.entrees, R.entreesPrec) + ' vs même période mois dernier') +
      tuile('Sorties', fmt(R.sorties) + ' F', '#DC2626', variation(R.sorties, R.sortiesPrec, true) + ' vs même période mois dernier') +
      tuile('Bénéfice net', (R.benefice < 0 ? '−' : '') + fmt(Math.abs(R.benefice)) + ' F', R.benefice >= 0 ? '#0369A1' : '#DC2626', variation(R.benefice, R.beneficePrec) + ' vs même période mois dernier') + '</div>' +
      objectifTxt +
      '<div style="font-size:12px;color:#475569;margin-top:12px">⭐ ' + meilleur + '</div>' +
      '<div style="font-size:12px;color:#475569;margin-top:4px">📉 Principales dépenses : ' + dep + '</div>' + impayes + '</div></div>';
  }

  function dessiner() {
    const tab = document.getElementById('tab-dashboard'); if (!tab) return;
    let zone = document.getElementById('bilan-mois');
    if (!zone) {
      zone = document.createElement('div'); zone.id = 'bilan-mois';
      const repere = tab.querySelector('.dashboard-section-label');
      if (repere) repere.parentNode.insertBefore(zone, repere); else tab.appendChild(zone);
    }
    let objectif = 0; try { objectif = Number(localStorage.getItem('samassa_objectif_mois')) || 0; } catch (e) {}
    zone.innerHTML = html(calculer(lire('samassa_mouvements'), lire('samassa_factures_cyber'), objectif, new Date()));
    const b = document.getElementById('dp-obj');
    if (b) b.onclick = () => {
      const v = prompt('Objectif d\'entrées pour le mois (en FCFA) :', objectif || '');
      if (v === null) return;
      const n = Math.max(0, parseInt(String(v).replace(/\s/g, ''), 10) || 0);
      try { localStorage.setItem('samassa_objectif_mois', String(n)); } catch (e) {}
      dessiner();
    };
  }

  /* ---------- Raccourcis : masquage selon le rôle + « utilisés récemment » ---------- */
  const fichierDe = a => (a.getAttribute('href') || '').split('?')[0].split('/').pop();
  const liens = () => Array.from(document.querySelectorAll('#tab-dashboard a.qa, #tab-dashboard a.tool'));

  function filtrerParRole() {
    if (typeof Auth === 'undefined' || !Auth.canPage || !Auth.role) return false;
    document.querySelectorAll('#tab-dashboard a[href]').forEach(a => { const f = fichierDe(a); if (f.endsWith('.html') && !Auth.canPage(f)) a.style.display = 'none'; });
    // bloc « Administration & sécurité » et bandeau stock : cachés entièrement si aucun lien n'est permis
    ['#admin-access-card', '#stock-alert-section > div'].forEach(sel => {
      const bloc = document.querySelector('#tab-dashboard ' + sel); if (!bloc) return;
      const ls = Array.from(bloc.querySelectorAll('a[href]'));
      if (ls.length && ls.every(a => a.style.display === 'none')) { const cible = sel === '#admin-access-card' ? bloc : bloc.parentElement; cible.setAttribute('data-role-cache', '1'); cible.style.setProperty('display', 'none', 'important'); }
    });
    // masque les titres de groupes dont tous les raccourcis sont cachés
    document.querySelectorAll('#tab-dashboard .qa-group').forEach(t => {
      const grille = t.nextElementSibling; if (!grille) return;
      const visibles = Array.from(grille.children).some(c => c.style.display !== 'none');
      t.style.display = grille.style.display = visibles ? '' : 'none';
    });
    const outils = document.querySelector('#tab-dashboard .tools-grid');
    if (outils) { const v = Array.from(outils.children).some(c => c.style.display !== 'none'); outils.style.display = v ? '' : 'none'; if (outils.previousElementSibling) outils.previousElementSibling.style.display = v ? '' : 'none'; }
    dessinerRecents();
    return true;
  }

  function recents() { try { const r = JSON.parse(localStorage.getItem('samassa_outils_recents') || '[]'); return Array.isArray(r) ? r.filter(x => typeof x === 'string').slice(0, 4) : []; } catch (e) { return []; } }
  function noter(href) {
    const l = [href].concat(recents().filter(x => x !== href)).slice(0, 4);
    try { localStorage.setItem('samassa_outils_recents', JSON.stringify(l)); } catch (e) {}
  }
  function dessinerRecents() {
    const zone = document.getElementById('qa-recents'), grille = document.getElementById('qa-recents-grid'); if (!zone || !grille) return;
    const tous = liens();
    const cartes = recents().map(h => tous.find(a => a.getAttribute('href') === h && a.style.display !== 'none' && !a.closest('#qa-recents'))).filter(Boolean);
    grille.innerHTML = '';
    cartes.forEach(a => {
      const ico = a.querySelector('.qa-icon, .tool-icon'), lab = a.querySelector('.qa-label, .tool-title');
      const n = document.createElement('a'); n.className = 'qa'; n.setAttribute('href', a.getAttribute('href'));
      const i = document.createElement('div'); i.className = 'qa-icon'; i.setAttribute('style', ico ? ico.getAttribute('style') || '' : ''); i.textContent = ico ? ico.textContent : '';
      const t = document.createElement('div'); t.className = 'qa-label';
      t.textContent = lab ? Array.from(lab.childNodes).filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim() || lab.textContent.trim() : '';
      n.appendChild(i); n.appendChild(t); grille.appendChild(n);
    });
    zone.style.display = cartes.length ? '' : 'none';
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('#tab-dashboard a.qa, #tab-dashboard a.tool');
    if (a && !a.hasAttribute('data-no-recent') && !a.closest('#qa-recents') && (a.getAttribute('href') || '').indexOf('#') !== 0) noter(a.getAttribute('href'));
  }, true);
  (function attendreRole(n) { if (!filtrerParRole() && n < 40) setTimeout(() => attendreRole(n + 1), 500); else dessinerRecents(); })(0);
  window.__dashPlusRaccourcis = { filtrerParRole, noter, dessinerRecents };

  window.__dashPlusCalculer = calculer;
  const base = window.loadDashboard;
  if (typeof base === 'function') window.loadDashboard = function () { const r = base.apply(this, arguments); try { dessiner(); } catch (e) {} return r; };
  try { dessiner(); } catch (e) {}
})();
