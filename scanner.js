/* ══════════════════════════════════════════════════════════
   SAMASSA TECHNOLOGIE — scanner.js
   Scanner QR caméra pour remplissage automatique du champ NINA
   Utilise BarcodeDetector (Chrome natif) + jsQR (fallback)
══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _stream    = null;
  var _animFrame = null;
  var _canvas    = null;
  var _ctx       = null;
  var _video     = null;
  var _onResult  = null;
  var _active    = false;

  /* ── Ouvrir le scanner ── */
  window.openNinaScanner = function (targetFieldId, onSuccess) {
    _onResult = onSuccess || null;
    _active   = true;

    var modal = document.getElementById('qr-scanner-modal');
    if (!modal) { _buildModal(); modal = document.getElementById('qr-scanner-modal'); }

    modal.style.display = 'flex';
    document.getElementById('qr-scan-result').textContent = '';
    document.getElementById('qr-scan-result').style.display = 'none';

    // Stocker la cible
    modal.dataset.target = targetFieldId || 'clientNina';

    _startCamera();
  };

  /* ── Fermer le scanner ── */
  window.closeNinaScanner = function () {
    _active = false;
    _stopCamera();
    var modal = document.getElementById('qr-scanner-modal');
    if (modal) modal.style.display = 'none';
  };

  /* ── Démarrer la caméra arrière ── */
  function _startCamera() {
    var constraints = {
      video: {
        facingMode: { ideal: 'environment' }, // caméra arrière
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(function (stream) {
        _stream = stream;
        _video  = document.getElementById('qr-video');
        _video.srcObject = stream;
        _video.setAttribute('playsinline', true);
        _video.play();
        _video.addEventListener('loadedmetadata', function () {
          _setupCanvas();
          _scanLoop();
        });
        document.getElementById('qr-cam-error').style.display = 'none';
        document.getElementById('qr-video-wrap').style.display = 'block';
      })
      .catch(function (err) {
        console.warn('Caméra:', err);
        document.getElementById('qr-cam-error').style.display = 'flex';
        document.getElementById('qr-video-wrap').style.display = 'none';
      });
  }

  /* ── Arrêter la caméra ── */
  function _stopCamera() {
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    if (_stream) {
      _stream.getTracks().forEach(function (t) { t.stop(); });
      _stream = null;
    }
    if (_video) { _video.srcObject = null; }
  }

  /* ── Préparer le canvas de détection ── */
  function _setupCanvas() {
    _canvas = document.getElementById('qr-canvas');
    _ctx    = _canvas.getContext('2d');
    _canvas.width  = _video.videoWidth;
    _canvas.height = _video.videoHeight;
  }

  /* ── Boucle de scan ── */
  function _scanLoop() {
    if (!_active || !_video || _video.readyState < 2) {
      _animFrame = requestAnimationFrame(_scanLoop);
      return;
    }

    // Dessiner la frame sur le canvas
    _ctx.drawImage(_video, 0, 0, _canvas.width, _canvas.height);
    var imageData = _ctx.getImageData(0, 0, _canvas.width, _canvas.height);

    // 1. Essayer BarcodeDetector natif (Chrome Android, rapide)
    if ('BarcodeDetector' in window) {
      var detector = new BarcodeDetector({ formats: ['qr_code'] });
      detector.detect(_video)
        .then(function (barcodes) {
          if (barcodes.length > 0) {
            _onDetected(barcodes[0].rawValue);
          } else {
            _animFrame = requestAnimationFrame(_scanLoop);
          }
        })
        .catch(function () {
          _scanWithJsQR(imageData);
        });
    } else {
      // 2. Fallback jsQR
      _scanWithJsQR(imageData);
    }
  }

  /* ── Fallback jsQR ── */
  function _scanWithJsQR(imageData) {
    if (typeof jsQR === 'undefined') {
      _animFrame = requestAnimationFrame(_scanLoop);
      return;
    }
    var code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });
    if (code && code.data) {
      _onDetected(code.data);
    } else {
      _animFrame = requestAnimationFrame(_scanLoop);
    }
  }

  /* ── QR détecté → extraire NINA et autres champs ── */
  function _onDetected(raw) {
    if (!_active) return;
    _active = false;
    cancelAnimationFrame(_animFrame);

    var parsed = _parseNinaData(raw);

    var modal  = document.getElementById('qr-scanner-modal');
    var target = modal ? modal.dataset.target : 'clientNina';

    // Remplir les champs
    _fillField(target || 'clientNina', parsed.nina || raw);
    if (parsed.nom)     _fillField('clientLastName', parsed.nom);
    if (parsed.prenom)  _fillField('clientFirstName', parsed.prenom);
    if (parsed.phone)   _fillField('clientPhone', parsed.phone);

    // Feedback visuel
    var resultEl = document.getElementById('qr-scan-result');
    if (resultEl) {
      resultEl.textContent = '✅ NINA détecté : ' + (parsed.nina || raw);
      resultEl.style.display = 'block';
    }
    _flashSuccess();

    // Vibration si disponible
    if (navigator.vibrate) navigator.vibrate([80, 30, 80]);

    // Fermer après 1.2s
    setTimeout(function () {
      window.closeNinaScanner();
      if (_onResult) _onResult(parsed);
      // Toast si ST disponible
      if (window.ST && window.ST.toast) {
        ST.toast('✅ NINA rempli automatiquement !', 'success');
      }
    }, 1200);
  }

  /* ── Parser les données QR d'une carte NINA malienne ──
     Formats supportés :
     - NINA seul          : "197CI901041009A"
     - JSON               : {"nina":"197...","nom":"SAMASSA","prenom":"Boussé"}
     - Texte séparé ;     : "SAMASSA;Boussé;197CI901041009A;+22377..."
     - Texte séparé |     : "197CI901041009A|SAMASSA|Boussé"
     - Clés=valeurs        : "NINA=197CI901041009A;NOM=SAMASSA"
  ── */
  function _parseNinaData(raw) {
    var result = {};

    // 1. JSON
    try {
      var obj = JSON.parse(raw);
      result.nina   = obj.nina || obj.NINA || obj.id || obj.numero || '';
      result.nom    = obj.nom  || obj.NOM  || obj.lastName  || obj.last_name  || '';
      result.prenom = obj.prenom || obj.PRENOM || obj.firstName || obj.first_name || '';
      result.phone  = obj.phone || obj.tel || obj.telephone || '';
      if (result.nina) return result;
    } catch (e) {}

    // 2. Pattern NINA malien (15 caractères alphanum commençant par chiffre/lettre)
    var ninaPattern = /\b([A-Z0-9]{10,20})\b/g;
    var matches = raw.match(ninaPattern);

    // 3. Clés=valeurs (NINA=..., NOM=...)
    if (raw.includes('=')) {
      var parts = raw.split(/[;\n&]/);
      parts.forEach(function (p) {
        var kv = p.split('=');
        if (kv.length === 2) {
          var k = kv[0].trim().toUpperCase();
          var v = kv[1].trim();
          if (k === 'NINA' || k === 'ID' || k === 'NUMERO') result.nina   = v;
          if (k === 'NOM'  || k === 'LASTNAME')              result.nom    = v;
          if (k === 'PRENOM' || k === 'FIRSTNAME')           result.prenom = v;
          if (k === 'TEL'  || k === 'PHONE')                 result.phone  = v;
        }
      });
      if (result.nina) return result;
    }

    // 4. Séparateur ; ou |
    var delimiters = [';', '|', ','];
    for (var d = 0; d < delimiters.length; d++) {
      if (raw.includes(delimiters[d])) {
        var fields = raw.split(delimiters[d]);
        // Chercher le champ qui ressemble à un NINA
        fields.forEach(function (f) {
          f = f.trim();
          if (!result.nina && /^[A-Z0-9]{10,20}$/.test(f)) result.nina = f;
          else if (!result.nom && /^[A-ZÀ-Ü]{2,30}$/.test(f)) result.nom = f;
          else if (!result.prenom && /^[A-ZÀ-Üa-zà-ü]{2,30}$/.test(f)) result.prenom = f;
          else if (!result.phone && /^\+?[0-9]{8,15}$/.test(f)) result.phone = f;
        });
        if (result.nina) return result;
      }
    }

    // 5. Le QR entier est le NINA
    result.nina = raw.trim().replace(/\s+/g, '');
    return result;
  }

  /* ── Remplir un champ du formulaire ── */
  function _fillField(id, value) {
    var el = document.getElementById(id);
    if (el && value) {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.style.transition = 'background .3s';
      el.style.background = '#ECFDF5';
      setTimeout(function () { el.style.background = ''; }, 1500);
    }
  }

  /* ── Flash succès sur le viewfinder ── */
  function _flashSuccess() {
    var overlay = document.getElementById('qr-success-flash');
    if (overlay) {
      overlay.style.opacity = '1';
      setTimeout(function () { overlay.style.opacity = '0'; }, 600);
    }
  }

  /* ══════════════════════════════════════════════════════
     MODAL HTML DU SCANNER
  ══════════════════════════════════════════════════════ */
  function _buildModal() {
    var modal = document.createElement('div');
    modal.id = 'qr-scanner-modal';
    modal.style.cssText = [
      'display:none;position:fixed;inset:0;z-index:9500',
      'background:rgba(5,10,20,.92);align-items:center;justify-content:center',
      'padding:0;flex-direction:column'
    ].join(';');

    modal.innerHTML = [
      // En-tête
      '<div style="width:100%;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.5)">',
        '<div>',
          '<div style="font-size:16px;font-weight:800;color:white;letter-spacing:-.01em">📷 Scanner la carte NINA</div>',
          '<div style="font-size:11px;color:#7AB4D8;margin-top:2px">Pointez la caméra vers le QR code de la carte</div>',
        '</div>',
        '<button onclick="closeNinaScanner()" style="background:rgba(255,255,255,.15);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center">✕</button>',
      '</div>',

      // Viewfinder
      '<div id="qr-video-wrap" style="position:relative;width:100%;max-width:500px;background:#000;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden">',
        '<video id="qr-video" style="width:100%;height:100%;object-fit:cover" muted playsinline></video>',
        '<canvas id="qr-canvas" style="display:none"></canvas>',

        // Viseur animé
        '<div style="position:absolute;inset:0;pointer-events:none">',
          // Coins du viseur
          '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:220px;height:220px">',
            '<div style="position:absolute;top:0;left:0;width:36px;height:36px;border-top:3px solid #0070C0;border-left:3px solid #0070C0;border-radius:3px 0 0 0"></div>',
            '<div style="position:absolute;top:0;right:0;width:36px;height:36px;border-top:3px solid #0070C0;border-right:3px solid #0070C0;border-radius:0 3px 0 0"></div>',
            '<div style="position:absolute;bottom:0;left:0;width:36px;height:36px;border-bottom:3px solid #0070C0;border-left:3px solid #0070C0;border-radius:0 0 0 3px"></div>',
            '<div style="position:absolute;bottom:0;right:0;width:36px;height:36px;border-bottom:3px solid #0070C0;border-right:3px solid #0070C0;border-radius:0 0 3px 0"></div>',
            // Ligne de scan animée
            '<div id="qr-scan-line" style="position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#0070C0,transparent);animation:qr-scan 2s ease-in-out infinite;top:10%"></div>',
          '</div>',
          // Assombrissement autour du viseur
          '<div style="position:absolute;inset:0;background:radial-gradient(ellipse 230px 230px at 50% 50%,transparent 100px,rgba(0,0,0,.55) 170px)"></div>',
        '</div>',

        // Flash succès
        '<div id="qr-success-flash" style="position:absolute;inset:0;background:rgba(5,150,82,.4);opacity:0;transition:opacity .2s;pointer-events:none"></div>',
      '</div>',

      // Erreur caméra
      '<div id="qr-cam-error" style="display:none;flex-direction:column;align-items:center;gap:14px;padding:30px;text-align:center">',
        '<div style="font-size:40px">🚫</div>',
        '<div style="color:white;font-size:14px;font-weight:600">Accès caméra refusé</div>',
        '<div style="color:#7AB4D8;font-size:12px">Autorisez l\'accès à la caméra dans les paramètres du navigateur puis réessayez.</div>',
        '<button onclick="closeNinaScanner()" style="background:#0070C0;color:white;border:none;padding:11px 24px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Fermer</button>',
      '</div>',

      // Résultat détection
      '<div id="qr-scan-result" style="display:none;background:#059652;color:white;padding:12px 18px;font-size:13px;font-weight:700;text-align:center;width:100%"></div>',

      // Bas : saisie manuelle
      '<div style="width:100%;padding:14px 18px;background:rgba(0,0,0,.5);display:flex;align-items:center;gap:10px">',
        '<input id="qr-manual-input" type="text" placeholder="Ou saisissez le NINA manuellement…" ',
          'style="flex:1;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:white;font-size:13px;font-family:inherit;outline:none" ',
          'oninput="document.getElementById(\'qr-manual-input\').style.borderColor=\'rgba(0,112,192,.7)\'" ',
        '>',
        '<button onclick="_confirmManualNina()" ',
          'style="background:#0070C0;color:white;border:none;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">',
          'Valider',
        '</button>',
      '</div>',

      // Styles animation
      '<style>',
        '@keyframes qr-scan{0%{top:10%}50%{top:85%}100%{top:10%}}',
      '</style>'
    ].join('');

    document.body.appendChild(modal);
  }

  /* ── Valider la saisie manuelle ── */
  window._confirmManualNina = function () {
    var val = document.getElementById('qr-manual-input').value.trim();
    if (!val) return;
    var modal  = document.getElementById('qr-scanner-modal');
    var target = modal ? modal.dataset.target : 'clientNina';
    var el = document.getElementById(target);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.style.background = '#ECFDF5';
      setTimeout(function () { el.style.background = ''; }, 1500);
    }
    if (navigator.vibrate) navigator.vibrate(80);
    window.closeNinaScanner();
    if (window.ST && window.ST.toast) ST.toast('NINA enregistré ✓', 'success');
  };

})();
