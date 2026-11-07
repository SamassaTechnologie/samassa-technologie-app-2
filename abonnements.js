/* Domaines, hébergements et abonnements clients : échéances, alertes, renouvellement relié à la caisse. */
'use strict';
(function () {
  var KEY = 'samassa_abonnements';
  var H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k || KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function fcfa(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function fr(d) { return d ? d.split('-').reverse().join('/') : '—'; }
  function jours(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
  function ajouterMois(iso, n) {
    var p = iso.split('-').map(Number), y = p[0], m = p[1] - 1 + n, d = p[2];
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var max = new Date(y, m + 1, 0).getDate(); d = Math.min(d, max);
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  var TYPES = ['Nom de domaine', 'Hébergement web', 'Site web / maintenance', 'Messagerie pro', 'Antivirus / licence', 'Autre'];
  /* Pur : état d'un abonnement */
  function etat(a, auj) {
    if (!a.expiration) return { cle: 'sans', jours: null, libelle: 'sans date' };
    var j = jours(auj, a.expiration);
    return j < 0 ? { cle: 'expire', jours: j, libelle: 'expiré depuis ' + (-j) + ' j' } : j <= 30 ? { cle: 'bientot', jours: j, libelle: j === 0 ? 'expire aujourd\'hui' : 'expire dans ' + j + ' j' } : { cle: 'ok', jours: j, libelle: 'actif (' + j + ' j)' };
  }
  /* Pur : renouvelle à partir de la date d'expiration (ou d'aujourd'hui si déjà expiré) */
  function renouveler(a, mois, auj, encaisse) {
    var base = a.expiration && a.expiration >= auj ? a.expiration : auj;
    var n = Object.assign({}, a, { expiration: ajouterMois(base, mois), historique: (a.historique || []).concat([{ date: auj, mois: mois, montant: Number(a.prix) || 0 }]) });
    var mv = encaisse && Number(a.prix) > 0 ? { id: 'AB-' + Date.now(), date: auj, type: 'entree', desc: 'Renouvellement ' + (a.type || 'abonnement') + ' ' + (a.nom || '') + ' — ' + (a.client || ''), amount: Number(a.prix), pm: 'Espèces', cat: 'Vente service', auto: true, timestamp: new Date().toISOString() } : null;
    return { abonnement: n, mouvement: mv };
  }
  function stats(list, auj) {
    var act = list.filter(function (a) { return etat(a, auj).cle !== 'expire'; });
    return { total: list.length, actifs: act.length, expires: list.filter(function (a) { return etat(a, auj).cle === 'expire'; }).length, bientot: list.filter(function (a) { return etat(a, auj).cle === 'bientot'; }).length,
      revenuAnnuel: act.reduce(function (s, a) { return s + (Number(a.prix) || 0) * (12 / (Number(a.duree) || 12)); }, 0),
      margeAnnuelle: act.reduce(function (s, a) { return s + ((Number(a.prix) || 0) - (Number(a.cout) || 0)) * (12 / (Number(a.duree) || 12)); }, 0) };
  }
  function message(a, societe, auj) {
    var e = etat(a, auj), nom = (a.client || 'client').split(' ')[0];
    return 'Bonjour ' + nom + ', ici ' + (societe || 'SAMASSA TECHNOLOGIE') + '. Votre ' + String(a.type || 'abonnement').toLowerCase() + ' « ' + (a.nom || '') + ' » ' + (e.cle === 'expire' ? 'a expiré le ' + fr(a.expiration) + ' ⚠️' : 'arrive à échéance le ' + fr(a.expiration)) + '. Pour le renouveler (' + fcfa(a.prix) + ') merci de nous contacter. 🙏';
  }
  window.Abonnements = { etat: etat, renouveler: renouveler, stats: stats, message: message, ajouterMois: ajouterMois, TYPES: TYPES };

  if (typeof document === 'undefined' || !document.getElementById('ab-app')) return;
  function auj() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function save(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
  function numWa(t) { var n = String(t || '').replace(/\D/g, ''); return n.length === 8 ? '223' + n : n; }
  var edit = null, filtre = 'tous';
  function $(i) { return document.getElementById(i); }
  function rendre() {
    var T = auj(), l = lire(), s = stats(l, T);
    $('ab-kpi').innerHTML = '<div class="k"><b>' + fcfa(s.revenuAnnuel) + '</b><span>Revenu annuel récurrent</span></div><div class="k"><b>' + fcfa(s.margeAnnuelle) + '</b><span>Marge annuelle</span></div><div class="k"><b>' + s.bientot + '</b><span>À renouveler (30 j)</span></div><div class="k r"><b>' + s.expires + '</b><span>Expirés</span></div>';
    var vue = l.map(function (a) { return { a: a, e: etat(a, T) }; }).filter(function (x) { return filtre === 'tous' || x.e.cle === filtre; }).sort(function (x, y) { return (x.e.jours == null ? 9e9 : x.e.jours) - (y.e.jours == null ? 9e9 : y.e.jours); });
    $('ab-liste').innerHTML = vue.length ? vue.map(function (x) {
      var a = x.a, cl = x.e.cle === 'expire' ? 'r' : x.e.cle === 'bientot' ? 'a' : 'g';
      return '<div class="row" data-id="' + a.id + '"><div class="inf"><b>' + H(a.nom || a.type) + '</b> <span class="p ' + cl + '">' + H(x.e.libelle) + '</span><div class="m">' + H(a.client) + ' · ' + H(a.type) + ' · ' + fcfa(a.prix) + '/' + (Number(a.duree) || 12) + ' mois · échéance ' + fr(a.expiration) + (a.fournisseur ? ' · ' + H(a.fournisseur) : '') + '</div></div>' +
        '<div class="act"><button class="b wa" data-a="wa">💬</button><button class="b ok" data-a="ren">🔄 Renouveler</button><button class="b g2" data-a="mod">✏️</button><button class="b g2" data-a="sup">🗑️</button></div></div>';
    }).join('') : '<div class="vide">Aucun abonnement. Ajoutez le premier domaine ou hébergement d\'un client ci-dessus.</div>';
  }
  function champs() { return { client: $('ab-client').value.trim(), phone: $('ab-tel').value.trim(), type: $('ab-type').value, nom: $('ab-nom').value.trim(), fournisseur: $('ab-four').value.trim(), expiration: $('ab-exp').value, duree: Number($('ab-duree').value) || 12, prix: Number($('ab-prix').value) || 0, cout: Number($('ab-cout').value) || 0 }; }
  function vider() { edit = null; ['ab-client', 'ab-tel', 'ab-nom', 'ab-four', 'ab-exp', 'ab-prix', 'ab-cout'].forEach(function (i) { $(i).value = ''; }); $('ab-duree').value = 12; $('ab-ok').textContent = 'Enregistrer'; }
  document.addEventListener('click', function (e) {
    var t = e.target, f = t.closest && t.closest('[data-f]'); if (f) { filtre = f.dataset.f; document.querySelectorAll('[data-f]').forEach(function (x) { x.classList.toggle('on', x === f); }); rendre(); return; }
    if (t.id === 'ab-ok') {
      var c = champs(); if (!c.client || !c.nom || !c.expiration) { alert('Client, nom et date d\'expiration sont obligatoires.'); return; }
      var l = lire(); if (edit) { l = l.map(function (a) { return a.id === edit ? Object.assign({}, a, c) : a; }); } else l.push(Object.assign({ id: Date.now(), historique: [] }, c));
      save(l); vider(); rendre(); return;
    }
    var b = t.closest && t.closest('[data-a]'); if (!b) return;
    var id = Number(b.closest('.row').dataset.id), l2 = lire(), a = l2.find(function (x) { return x.id === id; }); if (!a) return;
    if (b.dataset.a === 'wa') { window.location.href = 'https://wa.me/' + numWa(a.phone) + '?text=' + encodeURIComponent(message(a, 'SAMASSA TECHNOLOGIE', auj())); return; }
    if (b.dataset.a === 'sup') { if (confirm('Supprimer cet abonnement ?')) { save(l2.filter(function (x) { return x.id !== id; })); rendre(); } return; }
    if (b.dataset.a === 'mod') { edit = id; $('ab-client').value = a.client || ''; $('ab-tel').value = a.phone || ''; $('ab-type').value = a.type; $('ab-nom').value = a.nom || ''; $('ab-four').value = a.fournisseur || ''; $('ab-exp').value = a.expiration || ''; $('ab-duree').value = a.duree || 12; $('ab-prix').value = a.prix || ''; $('ab-cout').value = a.cout || ''; $('ab-ok').textContent = 'Mettre à jour'; window.scrollTo(0, 0); return; }
    if (b.dataset.a === 'ren') {
      var mois = Number(a.duree) || 12, enc = confirm('Renouveler ' + mois + ' mois (' + fcfa(a.prix) + ') ?\n\nOK = renouveler ET encaisser en caisse\nAnnuler = ne rien faire'); if (!enc) return;
      var r = renouveler(a, mois, auj(), true); save(l2.map(function (x) { return x.id === id ? r.abonnement : x; }));
      if (r.mouvement) { var cs = lire('samassa_mouvements'); cs.push(r.mouvement); localStorage.setItem('samassa_mouvements', JSON.stringify(cs)); } rendre();
    }
  });
  document.addEventListener('DOMContentLoaded', function () { $('ab-type').innerHTML = TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join(''); rendre(); });
  if (document.readyState !== 'loading') { $('ab-type').innerHTML = TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join(''); rendre(); }
})();
