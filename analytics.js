/* SAMASSA TECHNOLOGIE — Analytics d’usage anonymisées par action */
'use strict';
window.SAMASSA_ANALYTICS = (() => {
  const store = 'kayes-principal';
  const config = () => window.SAMASSA_FIREBASE_CONFIG || (window.Auth && Auth.config);
  async function track(feature, action, result='success', extra={}) {
    try {
      if (!window.Auth || !Auth.idToken) return false;
      const token = await Auth.idToken(); if (!token) return false;
      const user = Auth.currentUser ? Auth.currentUser() : Auth.user;
      const c = config(); if (!c?.databaseURL) return false;
      const event = { type:'analytics', uid:user?.uid||'unknown', email:user?.email||'', role:Auth.role||'inconnu', feature:String(feature).slice(0,40), action:String(action).slice(0,60), result:String(result).slice(0,30), at:Date.now(), date:new Date().toISOString(), meta:{}};
      Object.keys(extra||{}).slice(0,5).forEach(k => { if (/duration|model|pages|size|mode/.test(k)) event.meta[k]=String(extra[k]).slice(0,80); });
      await fetch(`${c.databaseURL.replace(/\/$/,'')}/${store}/samassa_audit_log.json?auth=${encodeURIComponent(token)}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),keepalive:true});
      return true;
    } catch { return false; }
  }
  return {track};
})();
