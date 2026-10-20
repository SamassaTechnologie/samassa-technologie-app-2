/* ==================================================================
   RÉDACTEUR IA – MALI  |  fonctions-plus.js  (v1.0)
   Ajoute, sans toucher à app.js :
   1. Historique des documents générés (rouvrir, rechercher, supprimer)
   2. Brouillon automatique (reprendre ce qui était en cours de saisie)
   3. Carnet de clients (suggestions + remplissage automatique)
   4. Partage du Word par WhatsApp / e-mail (ou téléchargement)
   5. Bilan des impressions et recettes par jour, avec export CSV
   6. Sauvegarde et restauration de toutes les données (fichier JSON)
   7. Favoris et modèles récents
   8. Assistant IA de rédaction (facultatif, nécessite internet)
   À charger APRÈS app.js et modeles-ventes.js.
   ================================================================== */
(function () {
  'use strict';
  if (typeof MODELES === 'undefined' || typeof LS === 'undefined' || window.__fonctionsPlus) return;
  window.__fonctionsPlus = true;

  /* ---------- Outils ---------- */
  const AUJ = () => new Date().toISOString().slice(0, 10);
  const MAINT = () => new Date().toISOString();
  const quand = iso => { const d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}); };
  const jourFR = k => k.split('-').reverse().join('/');
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  function sauver(nom, texte, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texte], {type: mime || 'text/plain;charset=utf-8'}));
    a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  function dlg(id, titre, html) {
    let d = document.getElementById(id);
    if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); }
    d.innerHTML = '<h3>' + titre + '</h3>' + html + '<div class="actions"><button type="button" class="btn sec" data-fermer>Fermer</button></div>';
    d.querySelector('[data-fermer]').onclick = () => d.close();
    d.showModal();
    return d;
  }

  const css = document.createElement('style');
  css.textContent = [
    '.carte{position:relative}',
    '.carte .fav{position:absolute;top:6px;right:8px;font-size:1.2rem;color:#c9a227;cursor:pointer;line-height:1;padding:2px 4px}',
    '.fp-liste{max-height:55vh;overflow:auto;margin:10px 0}',
    '.fp-item{display:flex;gap:8px;align-items:center;justify-content:space-between;border:1px solid var(--bord);border-radius:8px;padding:8px 10px;margin-bottom:6px;background:#fff}',
    '.fp-item small{color:#6a7a88;display:block}',
    '.fp-item .btn{padding:6px 10px;font-size:.85rem}',
    '.fp-banner{background:#fff8e1;border:1px solid #f0d78c;border-radius:8px;padding:8px 12px;margin:10px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.fp-banner .btn{padding:5px 10px;font-size:.85rem}',
    '.fp-ia{align-self:flex-start;background:#f5f0ff;border:1px solid #7c3aed;border-radius:8px;color:#6d28d9;cursor:pointer;font-size:.9rem;font-weight:600;padding:7px 12px;margin-top:6px}',
    '.fp-ia:disabled{color:#999;cursor:wait}',
    '.fp-table{width:100%;border-collapse:collapse;font-size:.9rem;margin:8px 0}',
    '.fp-table th,.fp-table td{border-bottom:1px solid var(--bord);padding:5px 6px;text-align:left}',
    '.fp-table .n{text-align:right}',
    '.fp-resume{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0}',
    '.fp-resume div{background:var(--clair);border-radius:8px;padding:8px 10px}',
    '.fp-resume b{display:block;font-size:1.05rem;color:var(--b)}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- Lecture / remplissage du formulaire ---------- */
  function valeursBrutes() {
    const champs = {};
    $$('#champs [data-k]').forEach(e => { champs[e.dataset.k] = e.value; });
    const lignes = $$('#lignes .ligne').map(r => ({
      d: r.querySelector('.ld').value, q: r.querySelector('.lq').value,
      p: r.querySelector('.lp') ? r.querySelector('.lp').value : ''
    }));
    return {champs: champs, lignes: lignes};
  }
  function remplir(val) {
    $$('#champs [data-k]').forEach(e => { if (val.champs && val.champs[e.dataset.k] !== undefined) e.value = val.champs[e.dataset.k]; });
    if (val.lignes && val.lignes.length && $('#lignes')) {
      $('#lignes').innerHTML = '';
      val.lignes.forEach(l => {
        ajouterLigne();
        const r = $('#lignes').lastElementChild;
        r.querySelector('.ld').value = l.d; r.querySelector('.lq').value = l.q;
        if (r.querySelector('.lp')) r.querySelector('.lp').value = l.p;
      });
    }
  }

  /* ---------- 1. Historique ---------- */
  const HIST_MAX = 150;
  function enregistrerHistorique() {
    if (!modele) return;
    const val = valeursBrutes(), c = val.champs;
    let client = c.CLIENT || c.ACHETEUR || (c.NOM !== P.nom ? c.NOM : '') || c.DESTINATAIRE || c.SIGNATAIRE || '';
    let montant = Number(c.PRIX || c.MONTANT || 0) || 0;
    if (!montant) montant = val.lignes.reduce((s, l) => s + (parseFloat(l.q) || 0) * (parseFloat(l.p) || 0), 0);
    const h = LS.get('hist', []);
    const f = {id: Date.now(), t: modele.titre, cat: modele.cat, client: String(client).slice(0, 60), montant: montant, date: MAINT(), val: val};
    // même document régénéré dans les 10 minutes : on remplace au lieu de dupliquer
    if (h.length && h[0].t === f.t && JSON.stringify(h[0].val) === JSON.stringify(val) && Date.now() - h[0].id < 600000) h[0] = f;
    else h.unshift(f);
    LS.set('hist', h.slice(0, HIST_MAX));
    LS.set('brouillon', null);
    enregistrerClients(c);
  }

  function ouvrirHistorique() {
    const d = dlg('dlgHist', 'Historique des documents',
      '<input id="hq" type="search" placeholder="Rechercher (modèle, client)"><div class="fp-liste" id="hl"></div>');
    const rendre = () => {
      const q = norm($('#hq').value.trim());
      const items = LS.get('hist', []).filter(x => !q || norm(x.t + ' ' + x.client).includes(q));
      $('#hl').innerHTML = items.map(x =>
        '<div class="fp-item"><div><b>' + esc(x.t) + '</b><small>' + esc(x.client || 'Sans nom') + ' – ' + quand(x.date) +
        (x.montant ? ' – ' + fmt(x.montant) + ' F' : '') + '</small></div><div>' +
        '<button type="button" class="btn" data-o="' + x.id + '">Rouvrir</button> ' +
        '<button type="button" class="btn sec" data-s="' + x.id + '" aria-label="Supprimer">✕</button></div></div>'
      ).join('') || '<p>Aucun document pour le moment. Les documents apparaissent ici dès que vous cliquez sur « Générer ».</p>';
    };
    $('#hq').oninput = rendre;
    $('#hl').onclick = e => {
      const o = e.target.closest('[data-o]'), s = e.target.closest('[data-s]');
      const h = LS.get('hist', []);
      if (o) {
        const x = h.find(y => String(y.id) === o.dataset.o); if (!x) return;
        const i = MODELES.findIndex(m => m.titre === x.t);
        if (i < 0) return alert('Ce modèle n\'existe plus.');
        d.close(); ouvrir(i); remplir(x.val);
        const b = $('.fp-banner'); if (b) b.remove();
      } else if (s && confirm('Supprimer ce document de l\'historique ?')) {
        LS.set('hist', h.filter(y => String(y.id) !== s.dataset.s)); rendre();
      }
    };
    rendre();
  }

  /* ---------- 2. Brouillon automatique ---------- */
  let minuteur;
  const sauverBrouillon = () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      if (!modele || $('#vueForm').hidden) return;
      LS.set('brouillon', {t: modele.titre, date: MAINT(), val: valeursBrutes()});
    }, 600);
  };
  $('#champs').addEventListener('input', sauverBrouillon);
  $('#champs').addEventListener('change', sauverBrouillon);

  function proposerBrouillon() {
    const ancien = $('.fp-banner'); if (ancien) ancien.remove();
    const b = LS.get('brouillon', null);
    if (!b || b.t !== modele.titre || Date.now() - new Date(b.date) > 7 * 864e5) return;
    if (JSON.stringify(b.val) === JSON.stringify(valeursBrutes())) return;
    const z = document.createElement('div'); z.className = 'fp-banner';
    z.innerHTML = '<span>Un brouillon de ce modèle existe (' + quand(b.date) + ').</span>' +
      '<button type="button" class="btn" data-r>Reprendre</button><button type="button" class="btn sec" data-i>Ignorer</button>';
    z.querySelector('[data-r]').onclick = () => { remplir(b.val); z.remove(); };
    z.querySelector('[data-i]').onclick = () => z.remove();
    $('#champs').before(z);
  }

  /* ---------- 3. Carnet de clients ---------- */
  const LIENS = [
    {nom: 'CLIENT', adr: 'ADRESSE_CL'},
    {nom: 'ACHETEUR', adr: 'ADRESSE_A', id: 'ID_A'},
    {nom: 'VENDEUR', adr: 'ADRESSE_V', id: 'ID_V'},
    {nom: 'NOM', adr: 'ADRESSE', tel: 'TEL'}
  ];
  function enregistrerClients(c) {
    const L = LS.get('clients', []);
    LIENS.forEach(l => {
      const nom = (c[l.nom] || '').trim();
      if (!nom || nom === P.nom) return;
      const fiche = {nom: nom, adr: (c[l.adr] || '').trim(), id: l.id ? (c[l.id] || '').trim() : '', tel: l.tel ? (c[l.tel] || '').trim() : ''};
      const i = L.findIndex(x => norm(x.nom) === norm(nom));
      if (i < 0) L.push(fiche);
      else Object.keys(fiche).forEach(k => { if (fiche[k]) L[i][k] = fiche[k]; });
    });
    LS.set('clients', L.slice(-300));
  }
  function brancherClients() {
    let dl = document.getElementById('dl-clients');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'dl-clients'; document.body.appendChild(dl); }
    dl.innerHTML = LS.get('clients', []).map(c => '<option value="' + esc(c.nom) + '"></option>').join('');
    LIENS.forEach(l => {
      const e = $('#champs [data-k="' + l.nom + '"]'); if (!e) return;
      e.setAttribute('list', 'dl-clients');
      e.addEventListener('change', () => {
        const f = LS.get('clients', []).find(x => norm(x.nom) === norm(e.value)); if (!f) return;
        [[l.adr, f.adr], [l.id, f.id], [l.tel, f.tel]].forEach(p => {
          if (!p[0] || !p[1]) return;
          const t = $('#champs [data-k="' + p[0] + '"]');
          if (t && !t.value.trim()) t.value = p[1];
        });
        sauverBrouillon();
      });
    });
  }

  /* ---------- 4. Partage (WhatsApp, e-mail...) ---------- */
  async function partager() {
    try {
      const blob = construireDocx(blocs, await logoInfo());
      const nom = slug(modele.titre) + '_' + AUJ() + '.docx';
      const f = new File([blob], nom, {type: blob.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
      if (navigator.canShare && navigator.canShare({files: [f]})) { await navigator.share({files: [f], title: modele.titre}); return; }
      await telechargerWord();
      alert('Le fichier Word est téléchargé. Ouvrez WhatsApp et joignez-le depuis vos téléchargements.');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('Partage impossible : ' + e.message);
    }
  }
  const bShare = document.createElement('button');
  bShare.id = 'btnShare'; bShare.type = 'button'; bShare.className = 'btn sec'; bShare.hidden = true;
  bShare.textContent = '📤 Partager (WhatsApp...)'; bShare.onclick = partager;
  $('#btnPrint').after(bShare);

  /* ---------- 5. Bilan des impressions et recettes ---------- */
  function noterImpression() {
    const j = LS.get('jours', {}), k = AUJ(), x = j[k] || {n: 0, r: 0};
    j[k] = {n: x.n + 1, r: x.r + prix};
    LS.set('jours', j);
  }
  function ouvrirBilan() {
    const j = LS.get('jours', {}), ks = Object.keys(j).sort().reverse();
    const somme = p => ks.filter(p).reduce((a, k) => ({n: a.n + j[k].n, r: a.r + j[k].r}), {n: 0, r: 0});
    const auj = AUJ(), il7 = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const T = somme(k => k === auj), S = somme(k => k >= il7), M = somme(k => k.startsWith(auj.slice(0, 7))), A = somme(() => true);
    const carte = (l, x) => '<div>' + l + '<b>' + fmt(x.r) + ' F</b><small>' + x.n + ' impression(s)</small></div>';
    const d = dlg('dlgBilan', 'Bilan des recettes',
      '<div class="fp-resume">' + carte('Aujourd\'hui', T) + carte('7 derniers jours', S) + carte('Ce mois', M) + carte('Depuis le début', A) + '</div>' +
      '<div class="fp-liste"><table class="fp-table"><tr><th>Date</th><th class="n">Impressions</th><th class="n">Recette</th></tr>' +
      (ks.slice(0, 31).map(k => '<tr><td>' + jourFR(k) + '</td><td class="n">' + j[k].n + '</td><td class="n">' + fmt(j[k].r) + ' F</td></tr>').join('') ||
       '<tr><td colspan="3">Aucune impression enregistrée. Le bilan se remplit à chaque clic sur « Imprimer ».</td></tr>') +
      '</table></div><div class="actions"><button type="button" class="btn vert" id="bCsv">⬇ Exporter en CSV</button></div>');
    d.querySelector('#bCsv').onclick = exporterBilan;
  }
  function exporterBilan() {
    const j = LS.get('jours', {}), ks = Object.keys(j).sort();
    if (!ks.length) return alert('Aucune impression enregistrée pour le moment.');
    const q = s => /[;"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    const now = new Date(), tn = ks.reduce((a, k) => a + j[k].n, 0), tr = ks.reduce((a, k) => a + j[k].r, 0);
    const L = [[P.nom], [P.slogan], [P.adresse + ' - Tél. ' + P.tel], [''], ['BILAN DES IMPRESSIONS ET RECETTES'],
      ['Généré le', now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})],
      ['Période couverte', 'du ' + jourFR(ks[0]) + ' au ' + jourFR(ks[ks.length - 1])], ['Devise', 'FCFA'], [''],
      ['Date', "Nombre d'impressions", 'Recette (FCFA)']];
    ks.forEach(k => L.push([jourFR(k), j[k].n, j[k].r]));
    L.push([''], ['TOTAL', tn, tr]);
    sauver('Bilan-impressions_' + slug(P.nom) + '_' + AUJ() + '.csv',
      '\uFEFF' + L.map(r => r.map(x => typeof x === 'number' ? x : q(String(x))).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  /* ---------- 6. Sauvegarde et restauration ---------- */
  function ouvrirDonnees() {
    const der = LS.get('derniere_sauvegarde', null);
    const d = dlg('dlgDonnees', 'Sauvegarde des données',
      '<p class="aide">Historique, clients, favoris, paramètres, logo et bilan sont gardés dans ce téléphone. ' +
      'Faites une sauvegarde régulière pour ne rien perdre si le téléphone change ou si le navigateur est vidé.</p>' +
      '<p>Dernière sauvegarde : <b>' + (der ? quand(der) : 'jamais') + '</b></p>' +
      '<div class="actions"><button type="button" class="btn vert" id="dSauve">⬇ Sauvegarder mes données</button></div>' +
      '<label class="champ"><span>Restaurer depuis un fichier de sauvegarde (.json)</span><input type="file" id="dRest" accept=".json,application/json"></label>');
    d.querySelector('#dSauve').onclick = () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); data[k] = localStorage.getItem(k); }
      sauver('Sauvegarde-Redacteur-IA-Mali_' + AUJ() + '.json',
        JSON.stringify({app: 'redacteur-ia-mali', version: 1, date: MAINT(), data: data}), 'application/json');
      LS.set('derniere_sauvegarde', MAINT());
      ouvrirDonnees();
    };
    d.querySelector('#dRest').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const o = JSON.parse(r.result);
          if (o.app !== 'redacteur-ia-mali' || !o.data) throw new Error('fichier non reconnu');
          if (!confirm('Restaurer cette sauvegarde ? Les données actuelles de même nom seront remplacées.')) return;
          Object.keys(o.data).forEach(k => { try { localStorage.setItem(k, o.data[k]); } catch (x) {} });
          location.reload();
        } catch (x) { alert('Restauration impossible : ' + x.message); }
      };
      r.readAsText(f);
    };
  }

  /* ---------- 7. Favoris et récents ---------- */
  const FAV = '⭐ Favoris', REC = '🕘 Récents';
  const favs = () => LS.get('favs', []);
  const noterRecent = t => { const r = LS.get('recents', []).filter(x => x !== t); r.unshift(t); LS.set('recents', r.slice(0, 12)); };

  const accueilBase = afficherAccueil;
  afficherAccueil = function () {
    const spec = catActive === FAV || catActive === REC, garde = catActive;
    if (spec) catActive = 'Tous';
    accueilBase();
    catActive = garde;
    const mk = (lib, nb) => {
      const b = document.createElement('button'); b.dataset.c = lib;
      b.textContent = lib + (nb === null ? '' : ' (' + nb + ')');
      b.onclick = () => { catActive = lib; afficherAccueil(); };
      return b;
    };
    $('#cats').prepend(mk(REC, null)); $('#cats').prepend(mk(FAV, favs().length));
    $$('#cats button').forEach(b => b.classList.toggle('on', b.dataset.c === catActive));
    if (spec) {
      const q = norm($('#recherche').value.trim());
      const ordre = catActive === FAV ? favs() : LS.get('recents', []);
      const items = ordre.map(t => MODELES.findIndex(m => m.titre === t)).filter(i => i >= 0 && (!q || norm(MODELES[i].titre).includes(q)));
      $('#liste').innerHTML = items.map(i => '<button class="carte" data-i="' + i + '"><b>' + (ICO[MODELES[i].cat] || '📄') + ' ' + esc(MODELES[i].titre) + '</b><small>' + esc(MODELES[i].cat) + '</small></button>').join('') ||
        '<p>' + (catActive === FAV ? 'Aucun favori. Touchez l\'étoile ☆ d\'un modèle pour l\'ajouter ici.' : 'Aucun modèle récent. Ouvrez un modèle pour le retrouver ici.') + '</p>';
      $$('#liste .carte').forEach(b => { b.onclick = () => ouvrir(+b.dataset.i); });
    }
    $$('#liste .carte').forEach(b => {
      const t = MODELES[+b.dataset.i].titre, s = document.createElement('span');
      s.className = 'fav'; s.setAttribute('role', 'button'); s.setAttribute('aria-label', 'Favori');
      s.textContent = favs().includes(t) ? '★' : '☆';
      s.onclick = ev => {
        ev.stopPropagation();
        const f = favs(), k = f.indexOf(t);
        if (k >= 0) f.splice(k, 1); else f.unshift(t);
        LS.set('favs', f); afficherAccueil();
      };
      b.appendChild(s);
    });
  };

  /* ---------- 8. Assistant IA de rédaction (facultatif) ---------- */
  function brancherIA() {
    $$('#champs textarea').forEach(t => {
      if (/DESTINATAIRE|ADRESSE|LIMITES|SIGNATAIRE|LIEU/.test(t.dataset.k || '')) return;   // pas utile sur ces champs
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fp-ia'; b.textContent = '✨ Écrire ce texte avec l\'IA';
      b.onclick = async () => {
        if (!navigator.onLine) return alert('L\'assistant IA a besoin d\'une connexion internet.');
        const base = t.value.trim(); let consigne = '';
        if (!base) { consigne = (prompt('Que voulez-vous écrire ? (ex. : je demande un congé de 10 jours pour raison familiale)', '') || '').trim(); if (!consigne) return; }
        const lab = t.closest('label').querySelector('span').textContent.replace(/\s*\[.*?\]\s*$/, '');
        b.disabled = true; const avant = b.textContent; b.textContent = 'Rédaction en cours…';
        try {
          const isImprove = Boolean(base);
          const r = await fetch('/api/generate-doc', {method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(isImprove ? {
              mode: 'affiner', previous: base,
              instruction: `Améliore uniquement le champ « ${lab} » du modèle « ${modele.titre} ». ${consigne || 'Corrige la langue, la clarté et le style administratif malien sans changer le sens.'}`,
              longueur: 'court', ton: 'formel'
            } : {
              prompt: `Rédige le contenu du champ « ${lab} » pour le modèle administratif « ${modele.titre} ». Consigne de l'utilisateur : ${consigne}`,
              forme: modele.titre, longueur: 'court', ton: 'formel'
            })});
          const d = await r.json().catch(() => ({}));
          if (!r.ok || !d.text) throw new Error(r.status === 503 ? 'le service Gemini de SAMASSA n’est pas configuré' : (d.error || 'service Gemini indisponible, code ' + r.status));
          t.value = d.text; sauverBrouillon();
          if (window.SAMASSA_ANALYTICS) SAMASSA_ANALYTICS.track('writer', isImprove ? 'amélioration de champ' : 'rédaction de champ', 'success', {model: modele.titre});
        } catch (e) {
          if (window.SAMASSA_ANALYTICS) SAMASSA_ANALYTICS.track('writer', isImprove ? 'amélioration de champ' : 'rédaction de champ', 'error', {model: modele.titre});
          alert('L\'assistant IA n\'est pas disponible pour le moment (' + e.message + ').');
        }
        b.disabled = false; b.textContent = avant;
      };
      t.after(b);
    });
  }

  /* ---------- Branchements ---------- */
  const ouvrirBase = ouvrir;
  ouvrir = function (i) {
    ouvrirBase(i);
    bShare.hidden = true;
    noterRecent(modele.titre);
    brancherClients(); brancherIA(); proposerBrouillon();
  };

  const genBase = $('#btnGen').onclick;
  $('#btnGen').onclick = function () {
    genBase.apply(this, arguments);
    if (window.SAMASSA_ANALYTICS) SAMASSA_ANALYTICS.track('writer', 'génération de document', 'success', {model: modele && modele.titre || 'modèle'});
    try { enregistrerHistorique(); bShare.hidden = false; } catch (e) {}
  };
  const printBase = $('#btnPrint').onclick;
  $('#btnPrint').onclick = function () {
    try { noterImpression(); } catch (e) {}
    printBase.apply(this, arguments);
  };

  const bt = (id, txt, fn) => {
    const b = document.createElement('button');
    b.id = id; b.type = 'button'; b.className = 'btn sec'; b.textContent = txt; b.onclick = fn; return b;
  };
  $('#btnParam').before(bt('btnHist', '🕘 Historique', ouvrirHistorique), bt('btnBilan', '📊 Bilan', ouvrirBilan), bt('btnDonnees', '💾 Données', ouvrirDonnees));

  // la recherche garde l'ancienne fonction : on la rebranche sur la nouvelle
  $('#recherche').oninput = () => afficherAccueil();
  afficherAccueil();
})();
