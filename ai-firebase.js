/* SAMASSA TECHNOLOGIE — Firebase AI Logic */
(function () {
  'use strict';

  const SDK_VERSION = '12.10.0';
  let runtimePromise;

  function loadModule(name) {
    return import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/${name}.js`);
  }

  async function runtime() {
    if (runtimePromise) return runtimePromise;
    runtimePromise = (async () => {
      const config = window.SAMASSA_FIREBASE_CONFIG;
      if (!config) throw new Error('Configuration Firebase absente.');

      const [{ initializeApp }, aiSdk, appCheckSdk] = await Promise.all([
        loadModule('firebase-app'),
        loadModule('firebase-ai'),
        loadModule('firebase-app-check')
      ]);
      const app = initializeApp(config, 'samassa-ai');

      // La clé reCAPTCHA Enterprise doit être ajoutée dans firebase-config.js
      // après sa création dans Firebase App Check. Elle ne remplace pas une clé Gemini.
      const siteKey = window.SAMASSA_RECAPTCHA_SITE_KEY || config.appCheckSiteKey;
      if (siteKey && appCheckSdk.initializeAppCheck && appCheckSdk.ReCaptchaEnterpriseProvider) {
        appCheckSdk.initializeAppCheck(app, {
          provider: new appCheckSdk.ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: true
        });
      }

      const ai = aiSdk.getAI(app, { backend: new aiSdk.GoogleAIBackend() });
      const model = aiSdk.getGenerativeModel(ai, {
        model: window.SAMASSA_AI_MODEL || 'gemini-3.8-flash'
      });
      return { model, appCheck: Boolean(siteKey), provider: 'Firebase AI Logic' };
    })();
    return runtimePromise;
  }

  window.SAMASSA_AI = {
    async generate(prompt) {
      const service = await runtime();
      const result = await service.model.generateContent(prompt);
      return { text: result.response.text(), model: service.provider, appCheck: service.appCheck };
    },
    async status() {
      try {
        const service = await runtime();
        return { ok: true, provider: service.provider, appCheck: service.appCheck };
      } catch (error) {
        return { ok: false, error: error.message || 'Firebase AI Logic indisponible' };
      }
    }
  };
})();
