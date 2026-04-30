/* ============================================================
   SAMASSA TECHNOLOGIE — capacitor-plugins.js v1.0
   Pont entre le web et les fonctionnalités natives Android/iOS
   (SMS natif, Notifications, Partage, Vibration, Réseau)
   ============================================================ */
'use strict';

/* ═══════════════════════════════════════════════════════════
   Détection : est-on dans une app Capacitor native ou dans
   un navigateur web classique ?
═══════════════════════════════════════════════════════════ */
const isNative = () => !!(window.Capacitor?.isNativePlatform?.());
const isAndroid = () => window.Capacitor?.getPlatform?.() === 'android';
const isIOS     = () => window.Capacitor?.getPlatform?.() === 'ios';

/* ═══════════════════════════════════════════════════════════
   BRIDGE NATIF — remplace les fonctions web si on est dans l'app
═══════════════════════════════════════════════════════════ */
const NativeBridge = {

  /* ──────────────────────────────────────
     SMS : envoi natif Android/iOS
  ────────────────────────────────────── */
  async sendSMS(phone, message) {
    if (isNative()) {
      try {
        const { CapacitorSMS } = await import('@capacitor/core');
        await CapacitorSMS.send({
          numbers: [phone.replace(/\s/g, '')],
          text:    message
        });
        return { ok: true };
      } catch (e) {
        /* Fallback : ouvrir l'app SMS */
        window.open('sms:' + phone + '?body=' + encodeURIComponent(message));
        return { ok: true, fallback: true };
      }
    } else {
      /* Navigateur web : comportement normal */
      window.open('sms:' + phone + '?body=' + encodeURIComponent(message));
      return { ok: true };
    }
  },

  /* ──────────────────────────────────────
     PARTAGE NATIF (WhatsApp, email, etc.)
  ────────────────────────────────────── */
  async share(title, text, url) {
    if (isNative() && window.Capacitor?.Plugins?.Share) {
      try {
        await window.Capacitor.Plugins.Share.share({ title, text, url });
        return { ok: true };
      } catch (e) {
        /* Fallback WhatsApp web */
        window.open('https://wa.me/?text=' + encodeURIComponent(text));
        return { ok: true };
      }
    } else {
      if (navigator.share) {
        try { await navigator.share({ title, text }); return { ok: true }; }
        catch {}
      }
      window.open('https://wa.me/?text=' + encodeURIComponent(text));
      return { ok: true };
    }
  },

  /* ──────────────────────────────────────
     NOTIFICATIONS LOCALES
  ────────────────────────────────────── */
  async notify(title, body, id) {
    if (isNative() && window.Capacitor?.Plugins?.LocalNotifications) {
      try {
        await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
        await window.Capacitor.Plugins.LocalNotifications.schedule({
          notifications: [{
            title, body,
            id: id || Date.now(),
            schedule: { at: new Date(Date.now() + 500) },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample'
          }]
        });
      } catch (e) { console.log('Notification:', e.message); }
    } else if (typeof Notification !== 'undefined') {
      /* Web push notification */
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'icon-512x512.png' });
      } else if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') new Notification(title, { body });
      }
    }
  },

  /* ──────────────────────────────────────
     VIBRATION (feedback tactile)
  ────────────────────────────────────── */
  vibrate(style) {
    if (isNative() && window.Capacitor?.Plugins?.Haptics) {
      const H = window.Capacitor.Plugins.Haptics;
      if (style === 'success')      H.impact({ style: 'medium' });
      else if (style === 'error')   H.notification({ type: 'error' });
      else if (style === 'warning') H.notification({ type: 'warning' });
      else                          H.impact({ style: 'light' });
    } else if (navigator.vibrate) {
      if      (style === 'success') navigator.vibrate([30, 10, 30]);
      else if (style === 'error')   navigator.vibrate([100, 30, 100]);
      else                          navigator.vibrate(30);
    }
  },

  /* ──────────────────────────────────────
     STATUT RÉSEAU
  ────────────────────────────────────── */
  async isOnline() {
    if (isNative() && window.Capacitor?.Plugins?.Network) {
      const status = await window.Capacitor.Plugins.Network.getStatus();
      return status.connected;
    }
    return navigator.onLine;
  },

  /* ──────────────────────────────────────
     PLEIN ÉCRAN (masquer barre de navigation)
  ────────────────────────────────────── */
  async setFullscreen() {
    if (isNative() && window.Capacitor?.Plugins?.StatusBar) {
      const SB = window.Capacitor.Plugins.StatusBar;
      await SB.setStyle({ style: 'DARK' });
      await SB.setBackgroundColor({ color: '#0D1B2A' });
    }
  }
};

/* ═══════════════════════════════════════════════════════════
   Initialisation au démarrage
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  if (isNative()) {
    /* Configurer la barre de statut */
    await NativeBridge.setFullscreen();

    /* Ajouter le badge "App Native" dans le header */
    const badge = document.querySelector('.ver-badge');
    if (badge) {
      const plat = isAndroid() ? '🤖 Android' : isIOS() ? '🍎 iOS' : '📱 App';
      badge.textContent = plat + ' — v2.8';
    }

    /* Notification de bienvenue au premier lancement */
    const firstLaunch = !localStorage.getItem('_app_launched');
    if (firstLaunch) {
      localStorage.setItem('_app_launched', '1');
      setTimeout(() => {
        NativeBridge.notify(
          'Samassa Tech Pro',
          'Application installée avec succès ! Bienvenue.',
          1
        );
      }, 2000);
    }

    console.log('[Capacitor] App native démarrée sur', window.Capacitor.getPlatform());
  }
});

/* ═══════════════════════════════════════════════════════════
   Rendre NativeBridge disponible globalement
═══════════════════════════════════════════════════════════ */
window.NativeBridge = NativeBridge;
