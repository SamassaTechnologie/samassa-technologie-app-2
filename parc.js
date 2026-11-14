/* Parc informatique des clients : équipements, numéros de série, garanties, historique des pannes, certificat de garantie. */
'use strict';
(function () {
  var KEY = 'samassa_parc';
  var H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var TYPES = ['Ordinateur portable', 'Ordinateur de bureau', 'Imprimante', 'Téléphone / tablette', 'Réseau / Wi-Fi', 'Écran', 'Autre'];
  function lire() { try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function fcfa(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function fr(d) { return d ? d.split('-').reverse().join('/') : '—'; }
  function jours(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
  function ajouterMois(iso, n) { var p = iso.split('-').map(Number), y = p[0], m = p[1] - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; var d = Math.min(p[2], new Date(y, m + 1, 0).getDate()); return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  /* Pur : fin de garantie et état */
  function garantie(e, auj) {
    var mois = Number(e.garantieMois) || 0;
    if (!e.achat || mois <= 0) return { cle: 'aucune', fin: '', jours: null, libelle: 'sans garantie' };
    var fin = ajouterMois(e.achat, mois), j = jours(auj, fin);
    return j < 0 ? { cle: 'expiree', fin: fin, jours: j, libelle: 'garantie expirée le ' + fr(fin) } : j <= 30 ? { cle: 'bientot', fin: fin, jours: j, libelle: 'garantie : ' + j + ' j restants' } : { cle: 'ok', fin: fin, jours: j, libelle: 'sous garantie jusqu\'au ' + fr(fin) };
  }
  function stats(l, auj) {
    var g = l.map(function (e) { return garantie(e, auj).cle; });
    return { total: l.length, sous: g.filter(function (c) { return c === 'ok' || c === 'bientot'; }).length, bientot: g.filter(function (c) { return c === 'bientot'; }).length, pannes: l.reduce(function (s, e) { return s + (e.pannes || []).length; }, 0), coutPannes: l.reduce(function (s, e) { return s + (e.pannes || []).reduce(function (t, p) { return t + (Number(p.cout) || 0); }, 0); }, 0) };
  }
  function chercher(l, q) { q = String(q || '').toLowerCase().trim(); if (!q) return l; return l.filter(function (e) { return [e.client, e.tel, e.marque, e.modele, e.serie, e.type].join(' ').toLowerCase().indexOf(q) > -1; }); }
  function message(e, auj) { var g = garantie(e, auj); return 'Bonjour ' + (String(e.client || '').split(' ')[0]) + ', voici le récapitulatif de votre ' + String(e.type || 'équipement').toLowerCase() + ' ' + [e.marque, e.modele].filter(Boolean).join(' ') + (e.serie ? ' (N° série ' + e.serie + ')' : '') + ' : ' + g.libelle + '. SAMASSA TECHNOLOGIE, Kayes. 🙏'; }
  window.Parc = { garantie: garantie, stats: stats, chercher: chercher, message: message, ajouterMois: ajouterMois, TYPES: TYPES };

  if (typeof document === 'undefined' || !document.getElementById('pc-app')) return;
  function $(i) { return document.getElementById(i); }
  function auj() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function numWa(t) { var n = String(t || '').replace(/\D/g, ''); return n.length === 8 ? '223' + n : n; }
  function save(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
  var edit = null;
  function rendre() {
    var T = auj(), l = lire(), s = stats(l, T);
    $('pc-kpi').innerHTML = '<div class="k"><b>' + s.total + '</b><span>Équipements suivis</span></div><div class="k"><b>' + s.sous + '</b><span>Sous garantie</span></div><div class="k"><b>' + s.bientot + '</b><span>Garantie finit sous 30 j</span></div><div class="k"><b>' + s.pannes + '</b><span>Pannes · ' + fcfa(s.coutPannes) + '</span></div>';
    var v = chercher(l, $('pc-q').value);
    $('pc-liste').innerHTML = v.length ? v.map(function (e) {
      var g = garantie(e, T), cl = g.cle === 'ok' ? 'g' : g.cle === 'bientot' ? 'a' : g.cle === 'expiree' ? 'r' : '';
      return '<div class="row" data-id="' + e.id + '"><div class="inf"><b>' + H([e.marque, e.modele].filter(Boolean).join(' ') || e.type) + '</b> <span class="p ' + cl + '">' + H(g.libelle) + '</span><div class="m">' + H(e.client) + ' · ' + H(e.type) + (e.serie ? ' · S/N ' + H(e.serie) : '') + (e.achat ? ' · acheté le ' + fr(e.achat) : '') + '</div>' +
        ((e.pannes || []).length ? '<div class="m">🔧 ' + e.pannes.map(function (p) { return fr(p.date) + ' ' + H(p.desc) + (p.cout ? ' (' + fcfa(p.cout) + ')' : ''); }).join(' · ') + '</div>' : '') + '</div>' +
        '<div class="act"><button class="b wa" data-a="wa">💬</button><button class="b ok" data-a="panne">🔧 Panne</button><button class="b ok" data-a="cert">📄 Certificat</button><button class="b g2" data-a="mod">✏️</button><button class="b g2" data-a="sup">🗑️</button></div></div>';
    }).join('') : '<div class="vide">Aucun équipement. Enregistrez ce que vous vendez ou réparez (numéro de série + date d\'achat) pour suivre les garanties.</div>';
  }
  function champs() { return { client: $('pc-client').value.trim(), tel: $('pc-tel').value.trim(), type: $('pc-type').value, marque: $('pc-marque').value.trim(), modele: $('pc-modele').value.trim(), serie: $('pc-serie').value.trim(), achat: $('pc-achat').value, garantieMois: Number($('pc-gar').value) || 0, prix: Number($('pc-prix').value) || 0 }; }
  function vider() { edit = null; ['pc-client', 'pc-tel', 'pc-marque', 'pc-modele', 'pc-serie', 'pc-achat', 'pc-prix'].forEach(function (i) { $(i).value = ''; }); $('pc-gar').value = 12; $('pc-ok').textContent = 'Enregistrer'; }
  function certificat(e) {
    var g = garantie(e, auj());
    $('pc-cert').innerHTML = '<div style="text-align:center"><img src="logo.png" alt="" style="height:60px"><h2 style="margin:6px 0">CERTIFICAT DE GARANTIE</h2><div>SAMASSA TECHNOLOGIE — Grand Marché de Kayes, Mali</div></div><table style="width:100%;margin-top:18px;border-collapse:collapse;font-size:14px">' +
      [['Client', e.client], ['Téléphone', e.tel], ['Équipement', e.type], ['Marque / modèle', [e.marque, e.modele].filter(Boolean).join(' ')], ['N° de série', e.serie], ['Date d\'achat', fr(e.achat)], ['Durée de garantie', (e.garantieMois || 0) + ' mois'], ['Valable jusqu\'au', fr(g.fin)]].map(function (r) { return '<tr><td style="border:1px solid #999;padding:8px;width:40%"><b>' + r[0] + '</b></td><td style="border:1px solid #999;padding:8px">' + H(r[1] || '—') + '</td></tr>'; }).join('') +
      '</table><p style="font-size:12px;margin-top:14px">La garantie couvre les défauts de fonctionnement. Elle ne couvre pas les chocs, liquides, surtensions ni les interventions par un tiers.</p><div style="display:flex;justify-content:space-between;margin-top:40px;font-size:13px"><span>Signature du client</span><span>Cachet & signature SAMASSA TECHNOLOGIE</span></div>';
    if (window.ImpressionMobile && ImpressionMobile.besoin()) { ImpressionMobile.ouvrir({ source: document.getElementById('pc-cert'), titre: 'Certificat de garantie ' + (e.client || '') }); return; }
    document.body.classList.add('imp-cert'); window.print(); setTimeout(function () { document.body.classList.remove('imp-cert'); }, 500);
  }
  document.addEventListener('input', function (e) { if (e.target.id === 'pc-q') rendre(); });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'pc-ok') { var c = champs(); if (!c.client || !(c.marque || c.modele)) { alert('Client et marque/modèle sont obligatoires.'); return; } var l = lire(); if (edit) l = l.map(function (x) { return x.id === edit ? Object.assign({}, x, c) : x; }); else l.push(Object.assign({ id: Date.now(), pannes: [] }, c)); save(l); vider(); rendre(); return; }
    var b = t.closest && t.closest('[data-a]'); if (!b) return;
    var id = Number(b.closest('.row').dataset.id), l2 = lire(), x = l2.find(function (y) { return y.id === id; }); if (!x) return; var a = b.dataset.a;
    if (a === 'wa') window.location.href = 'https://wa.me/' + numWa(x.tel) + '?text=' + encodeURIComponent(message(x, auj()));
    else if (a === 'cert') certificat(x);
    else if (a === 'panne') { var d = prompt('Description de la panne / intervention :'); if (!d) return; var co = Number(prompt('Coût de l\'intervention (FCFA, 0 si sous garantie) :', '0')) || 0; x.pannes = (x.pannes || []).concat([{ date: auj(), desc: d.trim(), cout: co }]); save(l2); rendre(); }
    else if (a === 'sup') { if (confirm('Supprimer cet équipement ?')) { save(l2.filter(function (y) { return y.id !== id; })); rendre(); } }
    else if (a === 'mod') { edit = id; $('pc-client').value = x.client || ''; $('pc-tel').value = x.tel || ''; $('pc-type').value = x.type; $('pc-marque').value = x.marque || ''; $('pc-modele').value = x.modele || ''; $('pc-serie').value = x.serie || ''; $('pc-achat').value = x.achat || ''; $('pc-gar').value = x.garantieMois || 0; $('pc-prix').value = x.prix || ''; $('pc-ok').textContent = 'Mettre à jour'; window.scrollTo(0, 0); }
  });
  function init() { $('pc-type').innerHTML = TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join(''); rendre(); }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
