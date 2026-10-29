/* Règlement des factures : statut de paiement, montant payé, échéance, création automatique de la créance */
'use strict';
(function () {
  var CRE = 'samassa_creances';
  function lire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function chiffres(s) { return parseInt(String(s || '').replace(/\D/g, ''), 10) || 0; }
  function money(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' FCFA'; }

  /* Calcul pur, testable */
  function calculer(statut, paye, ttc) {
    var p = statut === 'payé' ? ttc : statut === 'impayé' ? 0 : Math.min(Math.max(0, Number(paye) || 0), ttc);
    var du = Math.max(0, ttc - p);
    var libelle = statut === 'payé' || (ttc > 0 && p >= ttc) ? 'Payé' : statut === 'impayé' || p === 0 ? 'Impayé' : 'Partiellement payé';
    return { paye: p, du: du, statut: libelle };
  }
  /* Met à jour (ou crée / solde) la créance liée à une facture */
  function synchroCreance(creances, f) {
    var l = creances.slice(), i = l.findIndex(function (c) { return c.source === f.numero; });
    if (f.du > 0) {
      var d = { client: f.client || 'Client', phone: f.phone || '', amount: f.du, due: f.echeance || '', note: 'Facture ' + f.numero, source: f.numero, paid: false };
      if (i >= 0) l[i] = Object.assign({}, l[i], d, { paid: false }); else l.push(Object.assign({ id: Date.now(), created: new Date().toISOString() }, d));
    } else if (i >= 0) l[i] = Object.assign({}, l[i], { amount: 0, paid: true });
    return l;
  }

  function formulaire(c) {
    var z = document.querySelector('.actions'); if (!z || document.getElementById('pf-statut')) return;
    var b = document.createElement('div');
    b.innerHTML = '<div class="section-label" style="margin-top:14px">Règlement</div><div class="form-grid">' +
      '<div class="form-group"><label for="pf-statut">Statut du paiement</label><select id="pf-statut"><option value="payé">Payé en totalité</option><option value="partiel">Paiement partiel</option><option value="impayé">Impayé (à crédit)</option></select></div>' +
      '<div class="form-group"><label for="pf-paye">Montant payé (FCFA)</label><input type="number" id="pf-paye" min="0" value="0"></div>' +
      '<div class="form-group"><label for="pf-echeance">Date d\'échéance</label><input type="date" id="pf-echeance"></div></div>';
    z.parentNode.insertBefore(b, z);
    var s = document.getElementById('pf-statut'), p = document.getElementById('pf-paye');
    s.addEventListener('change', function () { var t = chiffres(val(c.totalInput)); if (s.value === 'payé') p.value = t; if (s.value === 'impayé') p.value = 0; });
  }
  function resume() {
    var pied = document.querySelector('.doc-footer'); if (!pied || document.getElementById('pf-resume')) return;
    var d = document.createElement('div'); d.id = 'pf-resume'; d.style.cssText = 'border:1.5px solid #E2ECF5;border-radius:9px;padding:12px 15px;margin:0 0 18px;background:#F8FBFD;font-size:12px;line-height:1.8';
    d.innerHTML = '<strong>Règlement :</strong> <span id="pf-r-s"></span><br>Montant payé : <strong id="pf-r-p"></strong> &nbsp;|&nbsp; Reste à payer : <strong id="pf-r-d"></strong><br>Échéance : <span id="pf-r-e">—</span>';
    pied.parentNode.insertBefore(d, pied);
  }
  function etat(c) {
    var ttc = chiffres(val(c.totalInput)), r = calculer(val('pf-statut'), val('pf-paye'), ttc);
    r.ttc = ttc; r.echeance = val('pf-echeance'); return r;
  }
  function brancher(c) {
    document.addEventListener('DOMContentLoaded', function () {
      if (!c.existant) formulaire(c);
      var gen = window[c.generer];
      if (typeof gen === 'function' && !c.existant) {
        window[c.generer] = function () {
          var r = gen.apply(this, arguments); resume();
          var e = etat(c), set = function (id, t) { var el = document.getElementById(id); if (el) el.textContent = t; };
          set('pf-r-s', e.statut); set('pf-r-p', money(e.paye)); set('pf-r-d', money(e.du)); set('pf-r-e', e.echeance ? new Date(e.echeance + 'T12:00:00').toLocaleDateString('fr-FR') : '—');
          return r;
        };
      }
      var sauver = window.saveDoc;
      if (typeof sauver === 'function') {
        window.saveDoc = function () {
          var numero = val(c.numero), avant = lire(c.cle).length, e = c.existant ? null : etat(c), r = sauver.apply(this, arguments);
          try {
            var l = lire(c.cle), f = l[l.length - 1];
            if (l.length > avant && f && String(f.number) === String(numero)) {
              var info = c.existant ? { numero: f.number, client: f.client, phone: val(c.tel), du: Number(f.amountDue) || 0, echeance: f.dueDate || '' } : { numero: f.number, client: f.client || val(c.client), phone: val(c.tel), du: e.du, echeance: e.echeance };
              if (!c.existant) { f.amountPaid = e.paye; f.amountDue = e.du; f.paymentStatus = e.statut; f.dueDate = e.echeance; localStorage.setItem(c.cle, JSON.stringify(l)); }
              localStorage.setItem(CRE, JSON.stringify(synchroCreance(lire(CRE), info)));
              if (info.du > 0 && window.ST && ST.toast) ST.toast('Créance de ' + money(info.du) + ' ajoutée dans Gestion', 'info');
            }
          } catch (x) {}
          return r;
        };
      }
    });
  }
  window.PaiementFacture = { brancher: brancher, calculer: calculer, synchroCreance: synchroCreance };
})();
