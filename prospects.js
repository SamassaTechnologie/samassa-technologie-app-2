/* Suivi des prospects (de la demande à la vente) + demandes d'avis clients. */
'use strict';
(function () {
  var KEY = 'samassa_prospects', LIEN = 'samassa_avis_lien';
  var H = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ETAPES = ['Nouveau', 'Contacté', 'Devis envoyé', 'Négociation', 'Gagné', 'Perdu'];
  var SOURCES = ['Facebook', 'WhatsApp', 'Bouche-à-oreille', 'Passage en boutique', 'Recommandation', 'Autre'];
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k || KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function fcfa(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }
  function numWa(t) { var n = String(t || '').replace(/\D/g, ''); return n.length === 8 ? '223' + n : n; }
  function jours(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
  function ouvert(p) { return p.etape !== 'Gagné' && p.etape !== 'Perdu'; }
  /* Pur : stats du pipeline */
  function stats(l, auj) {
    var g = l.filter(function (p) { return p.etape === 'Gagné'; }), pe = l.filter(function (p) { return p.etape === 'Perdu'; }), o = l.filter(ouvert), src = {};
    l.forEach(function (p) { var s = src[p.source || 'Autre'] = src[p.source || 'Autre'] || { total: 0, gagnes: 0 }; s.total++; if (p.etape === 'Gagné') s.gagnes++; });
    return { total: l.length, ouverts: o.length, gagnes: g.length, perdus: pe.length, valeurOuverte: o.reduce(function (s, p) { return s + (Number(p.montant) || 0); }, 0), valeurGagnee: g.reduce(function (s, p) { return s + (Number(p.montant) || 0); }, 0),
      conversion: g.length + pe.length ? Math.round(100 * g.length / (g.length + pe.length)) : null, aRelancer: o.filter(function (p) { return p.relance && p.relance <= auj; }).length, sources: src };
  }
  function suivante(e) { var i = ETAPES.indexOf(e); return i >= 0 && i < 3 ? ETAPES[i + 1] : null; }
  /* Pur : ajoute le prospect gagné au répertoire clients s'il n'y est pas (par numéro) */
  function versClient(p, clients) {
    var t = String(p.tel || '').replace(/\D/g, '').slice(-8);
    if (!t || clients.some(function (c) { return String(c.tel || '').replace(/\D/g, '').slice(-8) === t; })) return null;
    var parts = String(p.nom || '').trim().split(/\s+/), prenom = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '', nom = (parts.length > 1 ? parts[parts.length - 1] : '').toUpperCase() || prenom.toUpperCase();
    return { id: Date.now(), nom: nom, prenom: prenom, tel: p.tel, nina: '', naiss: '', adresse: '', cat: 'Particulier', notes: 'Prospect converti (' + (p.source || 'Autre') + ') — ' + (p.besoin || ''), created: new Date().toISOString() };
  }
  function msgAvis(nom, lien, societe) {
    return 'Bonjour ' + (String(nom || '').split(' ')[0] || '') + ', merci d\'avoir choisi ' + (societe || 'SAMASSA TECHNOLOGIE') + ' ! 😊 Votre avis nous aide beaucoup' + (lien ? ' : ' + lien : ' — répondez-nous par un petit mot sur votre expérience') + ' ⭐ Merci !';
  }
  function msgSuivi(p, societe) { return 'Bonjour ' + (String(p.nom || '').split(' ')[0] || '') + ', ici ' + (societe || 'SAMASSA TECHNOLOGIE') + '. ' + (p.etape === 'Devis envoyé' ? 'Avez-vous pu regarder notre devis' : 'Je reviens vers vous') + (p.besoin ? ' concernant « ' + p.besoin + ' »' : '') + ' ? Je reste disponible pour toute question. 🙏'; }
  window.Prospects = { stats: stats, suivante: suivante, versClient: versClient, msgAvis: msgAvis, msgSuivi: msgSuivi, ETAPES: ETAPES, SOURCES: SOURCES };

  if (typeof document === 'undefined' || !document.getElementById('pr-app')) return;
  function $(i) { return document.getElementById(i); }
  function auj() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function save(l) { localStorage.setItem(KEY, JSON.stringify(l)); }
  var filtre = 'ouverts', edit = null;
  function rendre() {
    var T = auj(), l = lire(), s = stats(l, T);
    $('pr-kpi').innerHTML = '<div class="k"><b>' + s.ouverts + '</b><span>En cours · ' + fcfa(s.valeurOuverte) + '</span></div><div class="k"><b>' + s.gagnes + '</b><span>Gagnés · ' + fcfa(s.valeurGagnee) + '</span></div><div class="k"><b>' + (s.conversion === null ? '—' : s.conversion + ' %') + '</b><span>Taux de conversion</span></div><div class="k r"><b>' + s.aRelancer + '</b><span>À relancer</span></div>';
    var vue = l.filter(function (p) { return filtre === 'tous' || (filtre === 'ouverts' ? ouvert(p) : p.etape === filtre); }).sort(function (a, b) { return (a.relance || '9999') < (b.relance || '9999') ? -1 : 1; });
    $('pr-liste').innerHTML = vue.length ? vue.map(function (p) {
      var late = ouvert(p) && p.relance && p.relance <= T, nx = suivante(p.etape);
      return '<div class="row" data-id="' + p.id + '"><div class="inf"><b>' + H(p.nom) + '</b> <span class="p">' + H(p.etape) + '</span>' + (late ? '<span class="p r">relance ' + (p.relance === T ? 'aujourd\'hui' : 'en retard') + '</span>' : '') + '<div class="m">' + H(p.besoin || '—') + (p.montant ? ' · ' + fcfa(p.montant) : '') + ' · ' + H(p.source || '') + (p.relance && ouvert(p) ? ' · relance ' + p.relance.split('-').reverse().join('/') : '') + '</div></div>' +
        '<div class="act"><button class="b wa" data-a="wa">💬</button>' + (nx ? '<button class="b ok" data-a="next">→ ' + H(nx) + '</button>' : '') + (ouvert(p) ? '<button class="b gg" data-a="won">✅ Gagné</button><button class="b g2" data-a="lost">❌</button>' : p.etape === 'Gagné' ? '<button class="b wa" data-a="avis">⭐ Avis</button>' : '') + '<button class="b g2" data-a="mod">✏️</button><button class="b g2" data-a="sup">🗑️</button></div></div>';
    }).join('') : '<div class="vide">Aucun prospect ici. Notez chaque personne qui demande un prix ou un service pour ne plus perdre de vente.</div>';
    var src = Object.keys(s.sources).map(function (k) { return '<span class="p">' + H(k) + ' : ' + s.sources[k].total + ' (' + s.sources[k].gagnes + ' gagnés)</span>'; }).join(' ');
    $('pr-src').innerHTML = src || '<span class="m">Pas encore de données.</span>';
  }
  function champs() { return { nom: $('pr-nom').value.trim(), tel: $('pr-tel').value.trim(), source: $('pr-src-sel').value, besoin: $('pr-besoin').value.trim(), montant: Number($('pr-montant').value) || 0, relance: $('pr-relance').value }; }
  function vider() { edit = null; ['pr-nom', 'pr-tel', 'pr-besoin', 'pr-montant', 'pr-relance'].forEach(function (i) { $(i).value = ''; }); $('pr-ok').textContent = 'Enregistrer le prospect'; }
  function maj(id, f) { var l = lire().map(function (p) { return p.id === id ? f(Object.assign({}, p)) : p; }); save(l); rendre(); }
  document.addEventListener('click', function (e) {
    var t = e.target, f = t.closest && t.closest('[data-f]'); if (f) { filtre = f.dataset.f; document.querySelectorAll('[data-f]').forEach(function (x) { x.classList.toggle('on', x === f); }); rendre(); return; }
    if (t.id === 'pr-ok') { var c = champs(); if (!c.nom) { alert('Le nom est obligatoire.'); return; } var l = lire(); if (edit) l = l.map(function (p) { return p.id === edit ? Object.assign({}, p, c) : p; }); else l.push(Object.assign({ id: Date.now(), etape: 'Nouveau', created: auj() }, c, { relance: c.relance || auj() })); save(l); vider(); rendre(); return; }
    if (t.id === 'pr-lien-ok') { try { localStorage.setItem(LIEN, $('pr-lien').value.trim()); } catch (x) {} t.textContent = '✔'; return; }
    var b = t.closest && t.closest('[data-a]'); if (!b) return;
    var id = Number(b.closest('.row').dataset.id), p = lire().find(function (x) { return x.id === id; }); if (!p) return;
    var a = b.dataset.a;
    if (a === 'wa') window.location.href = 'https://wa.me/' + numWa(p.tel) + '?text=' + encodeURIComponent(msgSuivi(p));
    else if (a === 'avis') window.location.href = 'https://wa.me/' + numWa(p.tel) + '?text=' + encodeURIComponent(msgAvis(p.nom, localStorage.getItem(LIEN) || ''));
    else if (a === 'next') maj(id, function (x) { x.etape = suivante(x.etape); return x; });
    else if (a === 'lost') maj(id, function (x) { x.etape = 'Perdu'; return x; });
    else if (a === 'won') { maj(id, function (x) { x.etape = 'Gagné'; return x; }); var cl = lire('samassa_clients'), n = versClient(p, cl); if (n) { cl.push(n); localStorage.setItem('samassa_clients', JSON.stringify(cl)); } }
    else if (a === 'sup') { if (confirm('Supprimer ce prospect ?')) { save(lire().filter(function (x) { return x.id !== id; })); rendre(); } }
    else if (a === 'mod') { edit = id; $('pr-nom').value = p.nom || ''; $('pr-tel').value = p.tel || ''; $('pr-src-sel').value = p.source || 'Autre'; $('pr-besoin').value = p.besoin || ''; $('pr-montant').value = p.montant || ''; $('pr-relance').value = p.relance || ''; $('pr-ok').textContent = 'Mettre à jour'; window.scrollTo(0, 0); }
  });
  function init() { $('pr-src-sel').innerHTML = SOURCES.map(function (s) { return '<option>' + s + '</option>'; }).join(''); $('pr-lien').value = localStorage.getItem(LIEN) || ''; rendre(); }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
