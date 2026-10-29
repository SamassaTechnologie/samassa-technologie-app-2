/* ============================================================
   SAMASSA TECHNOLOGIE — Export CSV professionnel + Analyse IA v1.0
   Chargé par index.html : <script src="export-pro.js"></script>
   Remplace exportCSV() (caisse) et exportRetraits() (cartes).
   ============================================================ */
(function () {
  'use strict';

  const ENT = {
    nom: 'SAMASSA TECHNOLOGIE',
    slogan: "Tout pour l'informatique",
    adresse: 'Grand Marché de Kayes, Mali',
    tel: '77 29 19 31 / 62 97 06 30'
  };

  /* ---------- Utilitaires ---------- */
  const lire = k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  const num = v => Number(v) || 0;
  const montant = m => num(m.amount !== undefined ? m.amount : m.montant);
  const p2 = n => String(n).padStart(2, '0');
  const dFR = d => p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear();
  const hFR = d => p2(d.getHours()) + ':' + p2(d.getMinutes());
  const parseDate = s => { const d = new Date(s); return isNaN(d) ? null : d; };
  const dateJour = s => { if (!s) return ''; const d = parseDate(String(s).length === 10 ? s + 'T12:00:00' : s); return d ? dFR(d) : String(s); };
  const notif = (m, t) => { if (typeof window.toast === 'function') window.toast(m, t); };
  const utilisateur = () => {
    try { return ((typeof Auth !== 'undefined' && Auth.currentUser && Auth.currentUser()) || {}).email || 'Utilisateur connecté'; }
    catch (e) { return 'Utilisateur connecté'; }
  };

  /* Cellule CSV sûre : guillemets doublés + protection contre l'injection de formule Excel */
  function cell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && v.raw !== undefined) return v.raw;
    if (typeof v === 'number') return isFinite(v) ? String(v) : '';
    let s = String(v).replace(/\r?\n/g, ' ').trim();
    if (/^[=+\-@\t]/.test(s)) s = "'" + s;
    return /[;"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  /* Texte forcé (téléphone, NINA) : Excel ne supprime plus les zéros ni ne passe en notation scientifique */
  const txt = v => { const s = String(v == null ? '' : v).trim(); return /^[\w +\-./]+$/.test(s) ? { raw: '="' + s + '"' } : s; };
  const ligne = a => a.map(cell).join(';');

  function construire(o) {
    const out = [];
    out.push(ligne([ENT.nom]), ligne([ENT.slogan]), ligne([ENT.adresse + ' — Tél. ' + ENT.tel]), '');
    out.push(ligne([o.titre.toUpperCase()]));
    o.infos.forEach(i => out.push(ligne(i)));
    out.push('', ligne(o.colonnes));
    o.lignes.forEach(l => out.push(ligne(l)));
    if (o.resume && o.resume.length) { out.push('', ligne(['RÉSUMÉ'])); o.resume.forEach(r => out.push(ligne(r))); }
    (o.sections || []).forEach(s => {
      out.push('', ligne([s.titre]), ligne(s.colonnes));
      s.lignes.forEach(l => out.push(ligne(l)));
    });
    if (o.notes && o.notes.length) { out.push(''); o.notes.forEach(n => out.push(ligne([n]))); }
    return '\uFEFF' + out.join('\r\n');
  }

  function nomFichier(base) {
    const n = new Date();
    return 'SAMASSA-TECHNOLOGIE_' + base + '_' + n.getFullYear() + '-' + p2(n.getMonth() + 1) + '-' + p2(n.getDate()) + '_' + p2(n.getHours()) + 'h' + p2(n.getMinutes()) + '.csv';
  }
  function telecharger(nom, contenu) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
    a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  /* ---------- Données de caisse ---------- */
  function mouvementsFiltres() {
    const v = id => (document.getElementById(id) || {}).value || '';
    const ft = v('flt-type'), fp = v('flt-pm'), fs = v('flt-search').toLowerCase();
    let l = lire('samassa_mouvements');
    if (ft) l = l.filter(m => m.type === ft);
    if (fp) l = l.filter(m => m.pm === fp);
    if (fs) l = l.filter(m => (m.desc || '').toLowerCase().includes(fs) || (m.cat || '').toLowerCase().includes(fs));
    const cle = m => (m.date || '') + '|' + (m.timestamp || '') + '|' + String(m.id || '').padStart(15, '0');
    l.sort((a, b) => cle(a) < cle(b) ? -1 : cle(a) > cle(b) ? 1 : 0);
    const filtres = [];
    if (ft) filtres.push('Type : ' + (ft === 'entree' ? 'Entrées' : 'Sorties'));
    if (fp) filtres.push('Mode de paiement : ' + fp);
    if (fs) filtres.push('Recherche : « ' + fs + ' »');
    return { liste: l, filtres: filtres };
  }

  function statsCaisse(liste) {
    const st = { n: liste.length, entrees: 0, sorties: 0, parMode: {}, parCat: {} };
    liste.forEach(m => {
      const a = montant(m), e = m.type === 'entree';
      const pm = m.pm || 'Non précisé', c = m.cat || 'Autre';
      const cat = st.parCat[c] = st.parCat[c] || { entrees: 0, sorties: 0 };
      if (e) {
        st.entrees += a; cat.entrees += a;
        const mo = st.parMode[pm] = st.parMode[pm] || { n: 0, total: 0 };
        mo.n++; mo.total += a;
      } else { st.sorties += a; cat.sorties += a; }
    });
    st.solde = st.entrees - st.sorties;
    return st;
  }

  /* ---------- Export caisse ---------- */
  function exporterMouvements(analyseIA) {
    const r = mouvementsFiltres(), liste = r.liste;
    if (!liste.length) { notif('Aucun mouvement à exporter.', 'error'); return; }
    const st = statsCaisse(liste), now = new Date();
    let cumul = 0;
    const lignes = liste.map((m, i) => {
      const a = montant(m), e = m.type === 'entree', t = parseDate(m.timestamp);
      cumul += e ? a : -a;
      return [i + 1, dateJour(m.date), t ? hFR(t) : '', e ? 'Entrée (recette)' : 'Sortie (dépense)', m.desc, m.cat, m.pm, e ? a : '', e ? '' : a, cumul, m.auto ? 'Automatique' : 'Saisie manuelle'];
    });
    const debut = dateJour(liste[0].date), fin = dateJour(liste[liste.length - 1].date);
    const sections = [];
    sections.push({
      titre: 'RÉPARTITION DES ENCAISSEMENTS PAR MODE DE PAIEMENT',
      colonnes: ['Mode de paiement', "Nombre d'encaissements", 'Montant encaissé (FCFA)', 'Part du total encaissé (%)'],
      lignes: Object.keys(st.parMode).sort((a, b) => st.parMode[b].total - st.parMode[a].total)
        .map(k => [k, st.parMode[k].n, st.parMode[k].total, st.entrees ? Math.round(st.parMode[k].total / st.entrees * 1000) / 10 : 0])
    });
    sections.push({
      titre: 'RÉPARTITION PAR CATÉGORIE',
      colonnes: ['Catégorie', 'Entrées (FCFA)', 'Sorties (FCFA)', 'Solde de la catégorie (FCFA)'],
      lignes: Object.keys(st.parCat).map(k => [k, st.parCat[k].entrees, st.parCat[k].sorties, st.parCat[k].entrees - st.parCat[k].sorties])
    });
    const clot = lire('samassa_clotures').slice(-3).reverse();
    if (clot.length) sections.push({
      titre: 'DERNIÈRES CLÔTURES DE CAISSE',
      colonnes: ['Date de clôture', 'Solde théorique (FCFA)', 'Solde réel compté (FCFA)', 'Écart (FCFA)', 'Clôturé par'],
      lignes: clot.map(c => [dateJour(c.date), num(c.theorique), num(c.reel), num(c.ecart), c.user || ''])
    });
    if (analyseIA) sections.push({
      titre: 'ANALYSE IA (générée automatiquement — à vérifier avant toute décision)',
      colonnes: ['Commentaire'],
      lignes: analyseIA.split(/\n+/).filter(Boolean).map(x => [x])
    });
    const csv = construire({
      titre: 'Journal des mouvements de caisse',
      infos: [
        ['Généré le', dFR(now) + ' à ' + hFR(now)],
        ['Généré par', utilisateur()],
        ['Période couverte', 'du ' + debut + ' au ' + fin],
        ['Filtres appliqués', r.filtres.join(' ; ') || 'Aucun (tous les mouvements)'],
        ['Devise', 'FCFA (franc CFA - XOF)'],
        ['Nombre de lignes', liste.length]
      ],
      colonnes: ['N°', 'Date', "Heure d'enregistrement", "Type d'opération", 'Description', 'Catégorie', 'Mode de paiement', 'Entrée (FCFA)', 'Sortie (FCFA)', 'Solde cumulé (FCFA)', 'Origine'],
      lignes: lignes,
      resume: [
        ["Nombre d'opérations", st.n],
        ['Total des entrées (FCFA)', st.entrees],
        ['Total des sorties (FCFA)', st.sorties],
        ['Solde net de la sélection (FCFA)', st.solde]
      ],
      sections: sections,
      notes: [
        'Montants en FCFA, sans séparateur de milliers : directement exploitables dans Excel ou Google Sheets (séparateur : point-virgule).',
        'Le solde cumulé est calculé sur la sélection exportée, par ordre chronologique.',
        'Document généré par SAMASSA TECHNOLOGIE — Suite Pro.'
      ]
    });
    telecharger(nomFichier('Mouvements-de-caisse'), csv);
    notif('Export CSV professionnel ✓' + (analyseIA ? ' (avec analyse IA)' : ''));
  }

  /* ---------- Export récupérations de cartes ---------- */
  function exporterRetraits() {
    const list = lire('samassa_retraits');
    if (!list.length) { notif('Aucune récupération.', 'error'); return; }
    list.sort((a, b) => (a.dateRetrait + (a.heureRetrait || '')) < (b.dateRetrait + (b.heureRetrait || '')) ? -1 : 1);
    const done = new Set(list.map(r => r.recuNumber));
    const attente = lire('samassa_recus').filter(r => !done.has(r.number) && (r.services || []).some(s => /nina|scan|carte|biom/i.test(s.desc))).length;
    const now = new Date();
    const csv = construire({
      titre: 'Registre des récupérations de cartes et documents',
      infos: [
        ['Généré le', dFR(now) + ' à ' + hFR(now)],
        ['Généré par', utilisateur()],
        ['Période couverte', 'du ' + dateJour(list[0].dateRetrait) + ' au ' + dateJour(list[list.length - 1].dateRetrait)],
        ['Confidentialité', 'Document confidentiel : contient des données personnelles (téléphone, NINA)'],
        ['Nombre de lignes', list.length]
      ],
      colonnes: ['N°', 'Date de récupération', 'Heure', 'Nom du client', 'Téléphone', 'NINA', 'N° du reçu', 'Statut'],
      lignes: list.map((r, i) => [i + 1, dateJour(r.dateRetrait), r.heureRetrait || '', r.client, txt(r.phone), txt(r.nina), r.recuNumber, 'Récupérée']),
      resume: [['Total des cartes récupérées', list.length], ['Cartes encore en attente de récupération', attente]],
      notes: ['Document généré par SAMASSA TECHNOLOGIE — Suite Pro.']
    });
    telecharger(nomFichier('Recuperations-de-cartes'), csv);
    notif('Export CSV professionnel ✓');
  }

  /* ---------- Intelligence artificielle ---------- */
  function chargeIA() {
    const tout = lire('samassa_mouvements'), st = statsCaisse(tout), parJour = {};
    const depuis = Date.now() - 30 * 864e5;
    tout.forEach(m => {
      if (!m.date || new Date(m.date).getTime() < depuis) return;
      const j = parJour[m.date] = parJour[m.date] || { entrees: 0, sorties: 0 };
      j[m.type === 'entree' ? 'entrees' : 'sorties'] += montant(m);
    });
    return {
      totaux: { operations: st.n, entrees: st.entrees, sorties: st.sorties, solde: st.solde },
      parModePaiement: st.parMode,
      parCategorie: st.parCat,
      parJour30j: parJour,
      plusGrossesSorties: tout.filter(m => m.type === 'sortie').sort((a, b) => montant(b) - montant(a)).slice(0, 5)
        .map(m => ({ date: m.date, description: (m.desc || '').slice(0, 60), categorie: m.cat, montant: montant(m) })),
      clotures: lire('samassa_clotures').slice(-5).map(c => ({ date: c.date, theorique: c.theorique, reel: c.reel, ecart: c.ecart })),
      stockASurveiller: lire('samassa_stock_v2').filter(x => num(x.qty) <= num(x.min)).slice(0, 8).map(x => ({ article: x.name, quantite: num(x.qty), seuil: num(x.min) }))
    };
  }
  async function appelIA(question) {
    const h = { 'Content-Type': 'application/json' };
    try { if (typeof Auth !== 'undefined' && Auth.idToken) { const t = await Auth.idToken(); if (t) h.Authorization = 'Bearer ' + t; } } catch (e) {}
    const r = await fetch('/api/analyse-ia', {
      method: 'POST', headers: h,
      body: JSON.stringify({ donnees: chargeIA(), question: question || '' })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.text) throw new Error(d.error || 'Service IA indisponible');
    return d.text;
  }

  function ouvrirAssistant() {
    const ancien = document.getElementById('ia-modal'); if (ancien) ancien.remove();
    const m = document.createElement('div');
    m.id = 'ia-modal'; m.className = 'modal-ov';
    m.innerHTML = '<div class="modal-sh" style="max-width:560px"><div class="m-head"><div class="m-title">🤖 Assistant IA — Caisse</div><button class="m-close" id="ia-close">✕</button></div>'
      + '<div class="m-body"><div id="ia-out" style="white-space:pre-wrap;font-size:13px;line-height:1.55;color:var(--text);min-height:80px">Analyse en cours…</div>'
      + '<div style="display:flex;gap:8px;margin-top:14px"><input id="ia-q" type="text" maxlength="300" placeholder="Posez une question (ex. : quel jour ai-je le plus encaissé ?)"><button class="btn-mv" id="ia-ask">Envoyer</button></div>'
      + '<div style="font-size:10px;color:var(--text3);margin-top:8px">Réponse générée par IA à partir de vos chiffres de caisse — à vérifier avant toute décision.</div></div></div>';
    document.body.appendChild(m);
    const out = m.querySelector('#ia-out'), q = m.querySelector('#ia-q');
    const lancer = async question => {
      out.textContent = 'Analyse en cours…';
      try { out.textContent = await appelIA(question); }
      catch (e) { out.textContent = '⚠️ ' + e.message; }
    };
    m.querySelector('#ia-close').onclick = () => m.remove();
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    m.querySelector('#ia-ask').onclick = () => { if (q.value.trim()) lancer(q.value.trim()); };
    q.addEventListener('keydown', e => { if (e.key === 'Enter' && q.value.trim()) lancer(q.value.trim()); });
    lancer('');
  }

  async function exporterAvecIA() {
    notif('Analyse IA en cours…', 'info');
    try { exporterMouvements(await appelIA('')); }
    catch (e) { notif('IA indisponible : export sans analyse.', 'warning'); exporterMouvements(null); }
  }

  /* ---------- Branchement dans l'interface ---------- */
  window.exportCSV = function () { exporterMouvements(null); };
  window.exportRetraits = exporterRetraits;

  const bouton = document.querySelector('button[onclick="exportCSV()"]');
  if (bouton && !document.getElementById('btn-ia')) {
    const fab = (id, label, fn) => {
      const b = document.createElement('button');
      b.id = id; b.className = 'btn-ex'; b.textContent = label;
      b.style.background = 'linear-gradient(135deg,#7C3AED,#9333EA)'; b.onclick = fn; return b;
    };
    bouton.parentNode.style.flexWrap = 'wrap';
    bouton.before(fab('btn-ia', '🤖 Analyse IA', ouvrirAssistant));
    bouton.after(fab('btn-csv-ia', '⬇ CSV + IA', exporterAvecIA));
  }
})();
