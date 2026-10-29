/* ══════════════════════════════════════════════════════════
   SAMASSA TECHNOLOGIE — scanner.js (v2.0)
   Scanner de pièce d'identité (QR code et codes-barres) pour le reçu.
   - Détecteur natif créé UNE fois (BarcodeDetector) ; repli jsQR allégé (image réduite)
   - Codes-barres des cartes biométriques (PDF417, Data Matrix, Aztec, Code 128…) selon le type de pièce
   - Lampe et zoom si l'appareil les permet ; import d'une photo depuis la galerie
   - Étape de VÉRIFICATION : le contenu lu n'est jamais copié à l'aveugle dans le reçu
   Dépend de piece-id.js (types, analyse) ; jsQR est chargé séparément.
══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var P = window.PieceID;                       // peut être absent : le scanner reste utilisable
  var _stream = null, _timer = null, _video = null, _canvas = null, _ctx = null;
  var _detector = null, _detecteurPret = false;
  var _active = false, _onResult = null, _cible = 'clientNina', _tick = 0, _debut = 0, _trackVideo = null, _torch = false;

  var $ = function (id) { return document.getElementById(id); };
  function typeInfo() { return P ? P.info(P.typeCourant()) : { label: 'Carte NINA', num: 'N° NINA', codes: false, pattern: null }; }

  /* ── Ouverture / fermeture ── */
  window.openNinaScanner = function (targetFieldId, onSuccess) {
    _onResult = onSuccess || null; _cible = targetFieldId || 'clientNina';
    if (!$('qr-scanner-modal')) _construire();
    $('qr-title').textContent = '📷 Scanner : ' + typeInfo().label;
    $('qr-sub').textContent = 'Placez le code (QR ou code-barres) de la carte dans le cadre';
    afficherEtape('scan');
    $('qr-scanner-modal').style.display = 'flex';
    $('qr-manual-input').value = '';
    demarrer();
  };
  window.closeNinaScanner = function () {
    _active = false; arreter();
    var m = $('qr-scanner-modal'); if (m) m.style.display = 'none';
  };

  function afficherEtape(e) {
    $('qr-step-scan').style.display = e === 'scan' ? 'flex' : 'none';
    $('qr-step-review').style.display = e === 'review' ? 'block' : 'none';
    $('qr-scan-result').style.display = 'none';
  }

  /* ── Caméra ── */
  function demarrer() {
    _active = true; _debut = Date.now(); _tick = 0;
    $('qr-cam-error').style.display = 'none'; $('qr-video-wrap').style.display = 'block'; $('qr-tip').style.display = 'none';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { erreurCamera('Caméra non disponible sur ce navigateur. Utilisez « Importer une photo » ou la saisie manuelle.'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(function (stream) {
        if (!_active) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        _stream = stream; _video = $('qr-video'); _video.srcObject = stream; _video.setAttribute('playsinline', true);
        _trackVideo = stream.getVideoTracks()[0]; configurerOptions();
        _video.play().catch(function () {});
        return preparerDetecteur().then(function () { _canvas = document.createElement('canvas'); _ctx = _canvas.getContext('2d', { willReadFrequently: true }); boucle(); });
      })
      .catch(function (err) { erreurCamera(err && err.name === 'NotAllowedError' ? 'Accès à la caméra refusé. Autorisez-le dans les paramètres du navigateur, ou utilisez « Importer une photo ».' : 'Impossible de démarrer la caméra. Utilisez « Importer une photo » ou la saisie manuelle.'); });
  }
  function arreter() {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    if (_stream) { _stream.getTracks().forEach(function (t) { t.stop(); }); _stream = null; }
    if (_video) _video.srcObject = null;
    _trackVideo = null; _torch = false;
  }
  function erreurCamera(msg) {
    $('qr-cam-error-msg').textContent = msg;
    $('qr-cam-error').style.display = 'flex'; $('qr-video-wrap').style.display = 'none';
  }

  /* Lampe et zoom : seulement si l'appareil les propose */
  function configurerOptions() {
    var caps = {}; try { caps = _trackVideo && _trackVideo.getCapabilities ? _trackVideo.getCapabilities() : {}; } catch (e) {}
    $('qr-torch').style.display = caps.torch ? 'inline-block' : 'none';
    var z = $('qr-zoom'), zw = $('qr-zoom-wrap');
    if (caps.zoom && caps.zoom.max > caps.zoom.min) { z.min = caps.zoom.min; z.max = caps.zoom.max; z.step = caps.zoom.step || 0.1; z.value = caps.zoom.min; zw.style.display = 'flex'; } else zw.style.display = 'none';
    try { if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) _trackVideo.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
  }

  /* Détecteur natif créé une seule fois, avec les formats utiles pour ce type de pièce */
  function preparerDetecteur() {
    _detector = null;
    if (!('BarcodeDetector' in window)) return Promise.resolve();
    var voulus = ['qr_code'];
    if (typeInfo().codes) voulus = voulus.concat(['pdf417', 'data_matrix', 'aztec', 'code_128', 'code_39']);
    var lire = window.BarcodeDetector.getSupportedFormats ? window.BarcodeDetector.getSupportedFormats() : Promise.resolve(voulus);
    return lire.then(function (sup) {
      var f = voulus.filter(function (x) { return sup.indexOf(x) >= 0; });
      if (f.length) _detector = new window.BarcodeDetector({ formats: f });
    }).catch(function () { _detector = null; });
  }

  /* ── Boucle de lecture : ~8 images/s, image réduite pour jsQR ── */
  function boucle() {
    if (!_active) return;
    if (!_video || _video.readyState < 2) { _timer = setTimeout(boucle, 100); return; }
    var suite = function () { if (_active) _timer = setTimeout(boucle, 120); };
    if (Date.now() - _debut > 15000) $('qr-tip').style.display = 'block';
    if (_detector) {
      _detector.detect(_video).then(function (r) { if (r && r.length) detecte(r[0].rawValue); else suite(); }).catch(function () { _detector = null; suite(); });
      return;
    }
    var texte = lireAvecJsQR(_video, _video.videoWidth, _video.videoHeight, 640, (_tick++ % 3) === 2);
    if (texte) detecte(texte); else suite();
  }
  function lireAvecJsQR(source, w, h, maxLarg, inverse) {
    if (typeof jsQR === 'undefined' || !w || !h) return '';
    var k = Math.min(1, maxLarg / w), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
    if (!_canvas) { _canvas = document.createElement('canvas'); _ctx = _canvas.getContext('2d', { willReadFrequently: true }); }
    _canvas.width = cw; _canvas.height = ch; _ctx.drawImage(source, 0, 0, cw, ch);
    var d = _ctx.getImageData(0, 0, cw, ch);
    var c = jsQR(d.data, cw, ch, { inversionAttempts: inverse ? 'attemptBoth' : 'dontInvert' });
    return c && c.data ? c.data : '';
  }

  /* ── Import d'une photo (galerie) ── */
  function importerPhoto(file) {
    if (!file) return;
    var msg = $('qr-photo-msg'); msg.style.display = 'block'; msg.textContent = 'Lecture de la photo…';
    var charger = window.createImageBitmap ? createImageBitmap(file) : new Promise(function (ok, ko) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = ko; im.src = URL.createObjectURL(file); });
    charger.then(function (img) {
      var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      var essai = function () {
        var tailles = [1600, 1000, 640];
        for (var i = 0; i < tailles.length; i++) {
          for (var j = 0; j < 2; j++) { var t = lireAvecJsQR(img, w, h, tailles[i], j === 1); if (t) return t; }
        }
        return '';
      };
      var natif = _detectorPourPhoto();
      return natif.then(function (det) { return det ? det.detect(img).then(function (r) { return r && r.length ? r[0].rawValue : ''; }).catch(function () { return ''; }) : ''; })
        .then(function (t) { return t || essai(); });
    }).then(function (texte) {
      if (texte) { msg.style.display = 'none'; _active = false; arreter(); detecte(texte); }
      else msg.textContent = 'Aucun code lisible dans cette photo. Prenez-la plus près, bien éclairée et sans reflet, ou saisissez le numéro à la main.';
    }).catch(function () { msg.textContent = 'Impossible de lire cette image.'; });
  }
  function _detectorPourPhoto() {
    if (_detector) return Promise.resolve(_detector);
    return preparerDetecteur().then(function () { return _detector; });
  }

  /* ── Code lu → analyse → remplissage direct ou vérification ── */
  function detecte(raw) {
    if (!_active && $('qr-step-review').style.display === 'block') return;
    _active = false; if (_timer) clearTimeout(_timer);
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
    var a = P ? P.analyser(raw) : { raw: String(raw), type: 'texte', numero: String(raw).replace(/\s+/g, '').toUpperCase(), candidats: [], nom: '', prenom: '', phone: '', url: '' };
    var verif = P ? P.verifierNumero(a.numero, P.typeCourant()) : { etat: 'ok' };
    var sur = a.numero && verif.etat === 'ok' && a.candidats.length <= 1 && a.type !== 'url';
    if (sur) {
      appliquer(a, a.numero);
      var r = $('qr-scan-result'); r.textContent = '✅ ' + typeInfo().num + ' lu : ' + a.numero; r.style.display = 'block';
      flash();
      setTimeout(function () { window.closeNinaScanner(); }, 900);
    } else {
      arreter(); afficherReview(a);
    }
  }

  function afficherReview(a) {
    afficherEtape('review');
    var avert = $('qr-rv-warn');
    avert.textContent = a.numero ? 'Vérifiez les informations avant de les utiliser.' : 'Ce code ne contient pas de ' + typeInfo().num.toLowerCase() + ' reconnu avec certitude. Choisissez une valeur, saisissez-la, ou rescannez.';
    $('qr-rv-num').value = a.numero || ''; $('qr-rv-nom').value = a.nom || ''; $('qr-rv-prenom').value = a.prenom || ''; $('qr-rv-tel').value = a.phone || '';
    var ch = $('qr-rv-cands'); ch.innerHTML = '';
    (a.candidats || []).forEach(function (c) { var b = document.createElement('button'); b.type = 'button'; b.className = 'qr-chip'; b.textContent = c; b.addEventListener('click', function () { $('qr-rv-num').value = c; }); ch.appendChild(b); });
    var brut = $('qr-rv-raw'); brut.textContent = a.raw || '';
    var court = (a.raw || '').replace(/\s+/g, '');
    var bt = $('qr-rv-useraw');
    if (!a.numero && court && court.length <= 25 && /^[A-Za-z0-9]+$/.test(court)) { bt.style.display = 'inline-block'; bt.onclick = function () { $('qr-rv-num').value = court.toUpperCase(); }; } else bt.style.display = 'none';
    $('qr-rv-url').style.display = a.type === 'url' ? 'block' : 'none';
    $('qr-rv-num').focus();
  }

  function appliquer(a, numero) {
    remplir(_cible, numero);
    if (a.nom) remplir('clientLastName', a.nom);
    if (a.prenom) remplir('clientFirstName', a.prenom);
    if (a.phone) remplir('clientPhone', a.phone);
    if (_onResult) { try { _onResult(a); } catch (e) {} }
    if (window.ST && window.ST.toast) window.ST.toast('✅ Informations ajoutées au reçu', 'success');
  }
  function remplir(id, valeur) {
    var el = $(id); if (!el || !valeur) return;
    el.value = valeur;
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('blur'));
    el.style.transition = 'background .3s'; el.style.background = '#ECFDF5';
    setTimeout(function () { el.style.background = ''; }, 1500);
  }
  function flash() { var o = $('qr-success-flash'); if (o) { o.style.opacity = '1'; setTimeout(function () { o.style.opacity = '0'; }, 600); } }

  window._confirmManualNina = function () {
    var v = ($('qr-manual-input').value || '').trim(); if (!v) return;
    var n = P ? P.nettoyer(v) : v.toUpperCase().replace(/\s+/g, '');
    _active = false; arreter();
    appliquer({ raw: v, type: 'manuel', numero: n, nom: '', prenom: '', phone: '', candidats: [] }, n);
    window.closeNinaScanner();
  };

  /* ══════════ Fenêtre du scanner ══════════ */
  function _construire() {
    var st = document.createElement('style');
    st.textContent = '@keyframes qr-scan{0%,100%{top:8%}50%{top:88%}}' +
      '.qr-btn{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:9px 13px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}' +
      '.qr-btn.pri{background:#0070C0;border-color:#0070C0}.qr-btn.ok{background:#059652;border-color:#059652}' +
      '.qr-chip{background:#EEF4FA;border:1px solid #C8D8EA;border-radius:99px;padding:5px 11px;font-size:12px;font-weight:700;color:#0A1628;cursor:pointer;font-family:inherit;margin:0 6px 6px 0}' +
      '#qr-step-review label{display:block;font-size:11px;font-weight:800;color:#4A6080;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 4px}' +
      '#qr-step-review input{width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid #C8D8EA;border-radius:10px;font-size:15px;font-family:inherit}';
    document.head.appendChild(st);
    var m = document.createElement('div');
    m.id = 'qr-scanner-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Scanner la pièce d\'identité');
    m.style.cssText = 'display:none;position:fixed;inset:0;z-index:9500;background:rgba(5,10,20,.94);flex-direction:column;align-items:stretch;overflow:auto';
    m.innerHTML =
      '<div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.5);gap:10px">' +
        '<div><div id="qr-title" style="font-size:16px;font-weight:800;color:#fff"></div><div id="qr-sub" style="font-size:11px;color:#7AB4D8;margin-top:2px"></div></div>' +
        '<button type="button" id="qr-close" aria-label="Fermer" class="qr-btn" style="width:40px;height:40px;padding:0;border-radius:50%;font-size:18px">✕</button>' +
      '</div>' +
      '<div id="qr-step-scan" style="display:flex;flex-direction:column;flex:1;min-height:0">' +
        '<div id="qr-video-wrap" style="position:relative;width:100%;max-width:560px;margin:0 auto;background:#000;flex:1;min-height:260px;overflow:hidden">' +
          '<video id="qr-video" style="width:100%;height:100%;object-fit:cover" muted playsinline></video>' +
          '<div style="position:absolute;inset:0;pointer-events:none"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(70vw,300px);height:min(70vw,300px)">' +
            '<div style="position:absolute;top:0;left:0;width:34px;height:34px;border-top:3px solid #38BDF8;border-left:3px solid #38BDF8"></div><div style="position:absolute;top:0;right:0;width:34px;height:34px;border-top:3px solid #38BDF8;border-right:3px solid #38BDF8"></div>' +
            '<div style="position:absolute;bottom:0;left:0;width:34px;height:34px;border-bottom:3px solid #38BDF8;border-left:3px solid #38BDF8"></div><div style="position:absolute;bottom:0;right:0;width:34px;height:34px;border-bottom:3px solid #38BDF8;border-right:3px solid #38BDF8"></div>' +
            '<div style="position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#38BDF8,transparent);animation:qr-scan 2s ease-in-out infinite;top:8%"></div></div></div>' +
          '<div id="qr-success-flash" style="position:absolute;inset:0;background:rgba(5,150,82,.4);opacity:0;transition:opacity .2s;pointer-events:none"></div>' +
          '<div id="qr-tip" style="display:none;position:absolute;left:10px;right:10px;bottom:10px;background:rgba(0,0,0,.7);color:#fff;font-size:12px;padding:8px 10px;border-radius:8px;text-align:center">Rapprochez la carte, évitez les reflets, ou essayez la lampe. Vous pouvez aussi importer une photo.</div>' +
        '</div>' +
        '<div id="qr-cam-error" style="display:none;flex-direction:column;align-items:center;gap:10px;padding:24px;text-align:center"><div style="font-size:36px">🚫</div><div id="qr-cam-error-msg" style="color:#fff;font-size:13px;line-height:1.5"></div></div>' +
        '<div style="padding:10px 14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;background:rgba(0,0,0,.45)">' +
          '<button type="button" id="qr-torch" class="qr-btn" style="display:none">🔦 Lampe</button>' +
          '<label id="qr-zoom-wrap" style="display:none;align-items:center;gap:6px;color:#fff;font-size:12px">🔍 <input id="qr-zoom" type="range" style="width:110px"></label>' +
          '<button type="button" id="qr-photo-btn" class="qr-btn">🖼 Importer une photo</button><input type="file" id="qr-photo" accept="image/*" style="display:none">' +
        '</div>' +
        '<div id="qr-photo-msg" style="display:none;color:#FDE68A;font-size:12px;text-align:center;padding:0 16px 8px"></div>' +
        '<div id="qr-scan-result" style="display:none;background:#059652;color:#fff;padding:12px 18px;font-size:13px;font-weight:700;text-align:center"></div>' +
        '<div style="padding:12px 14px;background:rgba(0,0,0,.5);display:flex;gap:10px;align-items:center">' +
          '<input id="qr-manual-input" type="text" placeholder="Ou saisissez le numéro à la main…" autocomplete="off" autocapitalize="characters" style="flex:1;min-width:0;padding:11px 13px;border-radius:10px;border:1.5px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;font-size:14px;font-family:inherit;outline:none">' +
          '<button type="button" id="qr-manual-ok" class="qr-btn pri">Valider</button>' +
        '</div>' +
      '</div>' +
      '<div id="qr-step-review" style="display:none;background:#fff;margin:14px auto;border-radius:14px;padding:16px;width:calc(100% - 28px);max-width:520px;box-sizing:border-box">' +
        '<div style="font-size:16px;font-weight:800;color:#0A1628">Vérifiez avant de remplir le reçu</div>' +
        '<div id="qr-rv-warn" style="font-size:12px;color:#B45309;margin:6px 0 4px;line-height:1.5"></div>' +
        '<div id="qr-rv-url" style="display:none;font-size:12px;color:#B91C1C;background:#FEF2F2;border-radius:8px;padding:8px 10px;margin:6px 0">⚠ Ce code contient une adresse web. Elle n\'est pas utilisée et n\'est pas ouverte.</div>' +
        '<label for="qr-rv-num">Numéro</label><input id="qr-rv-num" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
        '<div id="qr-rv-cands" style="margin-top:8px"></div><button type="button" id="qr-rv-useraw" class="qr-chip" style="display:none">Utiliser le contenu comme numéro</button>' +
        '<label for="qr-rv-nom">Nom</label><input id="qr-rv-nom" autocomplete="off">' +
        '<label for="qr-rv-prenom">Prénom</label><input id="qr-rv-prenom" autocomplete="off">' +
        '<label for="qr-rv-tel">Téléphone</label><input id="qr-rv-tel" inputmode="tel" autocomplete="off">' +
        '<details style="margin-top:12px"><summary style="font-size:12px;color:#4A6080;cursor:pointer">Voir le contenu brut du code</summary><pre id="qr-rv-raw" style="white-space:pre-wrap;word-break:break-all;font-size:11px;background:#F4F8FB;border-radius:8px;padding:8px;max-height:140px;overflow:auto"></pre></details>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px"><button type="button" id="qr-rv-ok" class="qr-btn ok" style="flex:1">✅ Appliquer au reçu</button>' +
        '<button type="button" id="qr-rv-retry" class="qr-btn" style="background:#EEF4FA;color:#0A1628;border-color:#C8D8EA">🔄 Rescanner</button>' +
        '<button type="button" id="qr-rv-cancel" class="qr-btn" style="background:#EEF4FA;color:#0A1628;border-color:#C8D8EA">Annuler</button></div>' +
      '</div>';
    document.body.appendChild(m);

    $('qr-close').addEventListener('click', window.closeNinaScanner);
    $('qr-rv-cancel').addEventListener('click', window.closeNinaScanner);
    $('qr-manual-ok').addEventListener('click', window._confirmManualNina);
    $('qr-manual-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') window._confirmManualNina(); });
    $('qr-photo-btn').addEventListener('click', function () { $('qr-photo').click(); });
    $('qr-photo').addEventListener('change', function () { importerPhoto(this.files && this.files[0]); this.value = ''; });
    $('qr-torch').addEventListener('click', function () {
      if (!_trackVideo) return; _torch = !_torch;
      _trackVideo.applyConstraints({ advanced: [{ torch: _torch }] }).catch(function () { _torch = false; });
      this.textContent = _torch ? '🔦 Éteindre' : '🔦 Lampe';
    });
    $('qr-zoom').addEventListener('input', function () { if (_trackVideo) _trackVideo.applyConstraints({ advanced: [{ zoom: Number(this.value) }] }).catch(function () {}); });
    $('qr-rv-retry').addEventListener('click', function () { afficherEtape('scan'); $('qr-photo-msg').style.display = 'none'; demarrer(); });
    $('qr-rv-ok').addEventListener('click', function () {
      var num = P ? P.nettoyer($('qr-rv-num').value) : $('qr-rv-num').value.trim().toUpperCase();
      if (!num) { $('qr-rv-num').focus(); $('qr-rv-warn').textContent = 'Saisissez ou choisissez le numéro avant d\'appliquer.'; return; }
      var tel = $('qr-rv-tel').value.trim();
      appliquer({ raw: '', type: 'verifie', numero: num, nom: $('qr-rv-nom').value.trim(), prenom: $('qr-rv-prenom').value.trim(), phone: tel, candidats: [] }, num);
      window.closeNinaScanner();
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && _active) { arreter(); } else if (!document.hidden && _active && $('qr-scanner-modal').style.display === 'flex' && !_stream) demarrer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('qr-scanner-modal').style.display === 'flex') window.closeNinaScanner(); });
  }

  window.SamassaScan = { _detecte: function (raw) { _active = true; detecte(raw); }, _ouvrirSansCamera: function () { if (!$('qr-scanner-modal')) _construire(); } };
})();
