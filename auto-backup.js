/* ==================================================================
   auto-backup.js (v1.0) : sauvegarde automatique de sécurité
   1. Une copie par jour des données (IndexedDB de l'appareil), 7 jours conservés.
      Protège contre une suppression par erreur ou un bug : on peut revenir en arrière.
   2. Rappel sur le tableau de bord si aucun fichier de sauvegarde n'a été téléchargé depuis 7 jours.
   3. Liste + restauration dans la page « Sauvegarde » (AutoBackup.afficher).
   Les copies restent dans l'appareil : pour protéger contre la perte du téléphone, téléchargez
   régulièrement le fichier de sauvegarde (le rappel vous y aide).
   ================================================================== */
(function () {
  'use strict';
  if (window.AutoBackup) return;

  const KEYS = [
    'samassa_recus','samassa_factures','samassa_factures_mat','samassa_factures_cyber',
    'samassa_recus_cyber','samassa_bons_reparation','samassa_recus_vente','samassa_devis',
    'samassa_interventions','samassa_charges_fixes','samassa_sessions_cyber','samassa_postes_config','samassa_mouvements','samassa_retraits','samassa_clients',
    'samassa_stock_v2','samassa_stock_mouvements','samassa_docs_admin',
    'samassa_mouvements_cyber','samassa_recus_counter','samassa_factures_mat_counter',
    'samassa_fournisseurs','samassa_creances','samassa_audit_log','samassa_clotures'
  ];
  const GARDER = 7, RAPPEL_JOURS = 7, DB = 'samassa_auto_backup', STORE = 'snapshots';
  const jour = (d) => (d || new Date()).toISOString().slice(0, 10);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function ouvrir() {
    return new Promise((ok, ko) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'jour' });
        r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
      } catch (e) { ko(e); }
    });
  }
  const tx = (db, mode, fn) => new Promise((ok, ko) => {
    const t = db.transaction(STORE, mode), s = t.objectStore(STORE); let res;
    try { res = fn(s); } catch (e) { return ko(e); }
    t.oncomplete = () => ok(res && res.result !== undefined ? res.result : undefined); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error);
  });

  function lireDonnees() {
    const data = {}; let n = 0;
    KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v !== null) { data[k] = v; n++; } } catch (e) {} });
    return { data, n };
  }
  const empreinte = d => { let h = 0; const s = JSON.stringify(d); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return s.length + ':' + h; };

  // Crée (ou met à jour) la copie du jour. Retourne true si une copie a été enregistrée.
  async function copier(force) {
    const { data, n } = lireDonnees();
    if (!n) return false;                                       // rien à sauvegarder
    const db = await ouvrir();
    try {
      const existants = await liste(db);
      const dernier = existants[0];
      const hash = empreinte(data);
      if (!force && dernier && dernier.hash === hash) return false;   // aucune modification depuis la dernière copie
      await tx(db, 'readwrite', s => s.put({ jour: jour(), date: new Date().toISOString(), hash, nb: n, data }));
      const apres = await liste(db);
      for (const vieux of apres.slice(GARDER)) await tx(db, 'readwrite', s => s.delete(vieux.jour));
      return true;
    } finally { db.close(); }
  }
  function liste(dbOuvert) {
    const faire = db => new Promise((ok, ko) => {
      const r = db.transaction(STORE).objectStore(STORE).getAll();
      r.onsuccess = () => ok(r.result.sort((a, b) => b.jour.localeCompare(a.jour))); r.onerror = () => ko(r.error);
    });
    return dbOuvert ? faire(dbOuvert) : ouvrir().then(db => faire(db).finally(() => db.close()));
  }
  const taille = c => Object.values(c.data).reduce((t, v) => t + String(v).length, 0);

  // Restaure une copie : sécurise d'abord l'état actuel, puis remplace uniquement les clés connues.
  async function restaurer(j) {
    const db = await ouvrir(); let snap;
    try { snap = await new Promise((ok, ko) => { const r = db.transaction(STORE).objectStore(STORE).get(j); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); } finally { db.close(); }
    if (!snap || !snap.data) throw new Error('Copie introuvable.');
    await copier(true);                                         // copie de sécurité de l'état actuel (écrase la copie du jour)
    let restaurees = 0;
    Object.keys(snap.data).forEach(k => {
      if (KEYS.includes(k) && typeof snap.data[k] === 'string') { localStorage.setItem(k, snap.data[k]); restaurees++; }
    });
    return restaurees;
  }

  function exporterFichier(snap) {
    const data = {}; Object.keys(snap.data).forEach(k => { try { data[k] = JSON.parse(snap.data[k]); } catch (e) { data[k] = snap.data[k]; } });
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ version: '4.0', app: 'SAMASSA TECHNOLOGIE Suite Pro', date: snap.date, data }, null, 2));
    a.download = 'samassa_backup_' + snap.jour + '.json'; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Rappel d'export sur le tableau de bord ---------- */
  function rappel() {
    const zone = document.getElementById('tab-dashboard'); if (!zone || document.getElementById('ab-rappel')) return;
    let dernier = null, repousse = null;
    try { dernier = localStorage.getItem('_samassa_last_backup'); repousse = localStorage.getItem('_samassa_backup_snooze'); } catch (e) {}
    if (repousse && jour() <= repousse) return;
    const age = dernier ? (Date.now() - new Date(dernier).getTime()) / 864e5 : Infinity;
    if (age < RAPPEL_JOURS || !lireDonnees().n) return;
    const b = document.createElement('div'); b.id = 'ab-rappel';
    b.style.cssText = 'background:#FFF8EE;border:1.5px solid #FDE68A;border-radius:14px;padding:12px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between';
    b.innerHTML = '<div style="font-size:13px;color:#92400E"><b>💾 Pensez à sauvegarder vos données.</b><br><span style="font-size:12px">' +
      (isFinite(age) ? 'Dernier fichier de sauvegarde il y a ' + Math.floor(age) + ' jours.' : 'Aucun fichier de sauvegarde téléchargé pour le moment.') + '</span></div>' +
      '<div style="display:flex;gap:8px"><a href="backup.html" style="background:#059652;color:#fff;text-decoration:none;border-radius:9px;padding:9px 14px;font-size:12px;font-weight:800">Sauvegarder</a>' +
      '<button type="button" id="ab-plus-tard" style="background:#fff;border:1px solid #FDE68A;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:700;color:#92400E;cursor:pointer">Plus tard</button></div>';
    zone.insertBefore(b, zone.querySelector('.kpi-grid') || zone.firstChild);
    b.querySelector('#ab-plus-tard').onclick = () => { try { localStorage.setItem('_samassa_backup_snooze', jour(new Date(Date.now() + 864e5))); } catch (e) {} b.remove(); };
  }

  /* ---------- Section dans backup.html ---------- */
  async function afficher(conteneur, apres) {
    let l = []; try { l = await liste(); } catch (e) { conteneur.innerHTML = '<p>Les copies automatiques ne sont pas disponibles sur ce navigateur.</p>'; return; }
    conteneur.innerHTML = l.length
      ? l.map(c => '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;border:1px solid #E2ECF5;border-radius:10px;padding:10px 12px;margin-bottom:8px">' +
          '<div style="font-size:13px"><b>' + esc(c.jour.split('-').reverse().join('/')) + '</b> <span style="color:#7A94AF;font-size:12px">· ' + c.nb + ' ensembles · ' + Math.round(taille(c) / 1024) + ' Ko</span></div>' +
          '<div style="display:flex;gap:6px"><button type="button" class="btn btn-blue" data-ab-dl="' + esc(c.jour) + '" style="padding:8px 12px;font-size:12px">⬇ Fichier</button>' +
          '<button type="button" class="btn btn-green" data-ab-rs="' + esc(c.jour) + '" style="padding:8px 12px;font-size:12px">↩ Restaurer</button></div></div>').join('')
      : '<p>Aucune copie pour le moment. La première sera créée automatiquement à la prochaine ouverture du tableau de bord.</p>';
    conteneur.querySelectorAll('[data-ab-dl]').forEach(b => b.onclick = () => exporterFichier(l.find(c => c.jour === b.dataset.abDl)));
    conteneur.querySelectorAll('[data-ab-rs]').forEach(b => b.onclick = async () => {
      const c = l.find(x => x.jour === b.dataset.abRs);
      if (!confirm('Restaurer la copie du ' + c.jour.split('-').reverse().join('/') + ' ?\n\nVos données actuelles seront d\'abord mises de côté dans une copie de sécurité.')) return;
      try { const n = await restaurer(c.jour); alert('✅ ' + n + ' ensembles de données restaurés.'); if (apres) apres(); afficher(conteneur, apres); }
      catch (e) { alert('Restauration impossible : ' + e.message); }
    });
  }

  window.AutoBackup = { KEYS, copier, liste, restaurer, afficher, rappel, _empreinte: empreinte };

  // Démarrage automatique (quelques secondes après l'ouverture, pour ne pas ralentir l'affichage)
  setTimeout(() => { copier(false).catch(() => {}); try { rappel(); } catch (e) {} }, 4000);
})();
