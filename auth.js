/* SAMASSA TECHNOLOGIE — Firebase Authentication + rôles */
'use strict';

const ROLE_DEFINITIONS = {
  administrateur: { label:'Administrateur', icon:'👑', pages:'all', permissions:['manage_users','settings','backup','reports','cash','sales','stock','technical','admin_docs'] },
  caissier: { label:'Caissier', icon:'💰', pages:['index.html','rapports.html','clients.html','recu.html','facture.html','facture_cyber.html','recu_cyber.html','recu_vente.html','devis.html'], permissions:['reports','cash','sales'] },
  technicien: { label:'Technicien', icon:'🔧', pages:['index.html','rapports.html','clients.html','bon_reparation.html','intervention.html','stock.html','devis.html'], permissions:['reports','technical','stock'] },
  responsable_stock: { label:'Responsable stock', icon:'📦', pages:['index.html','rapports.html','clients.html','stock.html','facture_materiel.html','facture.html'], permissions:['reports','stock','sales'] }
};
const ROLE_PAGE_RULES = {
  'cyber-docs.html':['administrateur','caissier'], 'utilisateurs.html':['administrateur'], 'journal.html':['administrateur'], 'settings.html':['administrateur'], 'setup-firebase.html':['administrateur'], 'backup.html':['administrateur'], 'docs_admin.html':['administrateur'],
  'recu.html':['administrateur','caissier'], 'facture.html':['administrateur','caissier','responsable_stock'], 'facture_cyber.html':['administrateur','caissier'], 'recu_cyber.html':['administrateur','caissier'], 'recu_vente.html':['administrateur','caissier'], 'devis.html':['administrateur','caissier','technicien'],
  'bon_reparation.html':['administrateur','technicien'], 'intervention.html':['administrateur','technicien'], 'stock.html':['administrateur','technicien','responsable_stock'], 'facture_materiel.html':['administrateur','responsable_stock'],
  'rapports.html':['administrateur','caissier','technicien','responsable_stock'], 'clients.html':['administrateur','caissier','technicien','responsable_stock'], 'index.html':['administrateur','caissier','technicien','responsable_stock']
};

const Auth = {
  lastError:'', _readyPromise:null, auth:null, user:null, role:null,
  config: window.SAMASSA_FIREBASE_CONFIG || {
    apiKey:'AIzaSyDxRqnmRraoF4JpHLPAwEmMbLw9qRb2h58', authDomain:'samassa-kayes-79fbb.firebaseapp.com', projectId:'samassa-kayes-79fbb',
    databaseURL:'https://samassa-kayes-79fbb-default-rtdb.europe-west1.firebasedatabase.app', storageBucket:'samassa-kayes-79fbb.firebasestorage.app', messagingSenderId:'704230186166', appId:'1:704230186166:web:041b7d413d1671178e5a17'
  },
  storeId:'kayes-principal',

  async ready(){
    if(this._readyPromise)return this._readyPromise;
    this._readyPromise=(async()=>{await this._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');await this._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');if(!firebase.apps.length)firebase.initializeApp(this.config);this.auth=firebase.auth();await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);return this.auth;})();
    return this._readyPromise;
  },
  _loadScript(src){return new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('Firebase indisponible'));document.head.appendChild(script);});},
  async idToken(){const auth=await this.ready();const user=auth.currentUser;return user?user.getIdToken():null;},
  async roleUrl(uid){const token=await this.idToken();if(!token)throw new Error('Session Firebase introuvable');return `${this.config.databaseURL.replace(/\/$/,'')}/${this.storeId}/user_roles/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`;},
  async loadRole(user){
    this.user=user;
    try{const r=await fetch(await this.roleUrl(user.uid),{signal:AbortSignal.timeout(8000)});const data=r.ok?await r.json():null;this.role=(data&&data.role)||localStorage.getItem('_samassa_role_'+user.uid)||'administrateur';if(data&&data.disabled)throw new Error('compte-désactivé');}
    catch(e){if(e.message==='compte-désactivé')throw e;this.role=localStorage.getItem('_samassa_role_'+user.uid)||'administrateur';}
    localStorage.setItem('_samassa_role_'+user.uid,this.role);
    document.documentElement.dataset.role=this.role;
    return this.role;
  },
  roleInfo(){return ROLE_DEFINITIONS[this.role]||ROLE_DEFINITIONS.caissier;},
  can(permission){return this.role==='administrateur'||!!this.roleInfo().permissions.includes(permission);},
  canPage(file){const allowed=ROLE_PAGE_RULES[file];return !allowed||allowed.includes(this.role);},
  async login(email,password){this.lastError='';try{const auth=await this.ready();await auth.signInWithEmailAndPassword(String(email).trim(),password);return true;}catch(error){this.lastError=this._message(error);return false;}},
  async check(){
    if(window.location.pathname.endsWith('login.html'))return;
    try{const auth=await this.ready();const user=await new Promise((resolve,reject)=>{const unsub=auth.onAuthStateChanged(u=>{unsub();u?resolve(u):reject(new Error('not-authenticated'));});});await this.loadRole(user);const file=window.location.pathname.split('/').pop()||'index.html';if(!this.canPage(file)){alert(`Accès refusé : votre rôle « ${this.roleInfo().label} » ne permet pas d’ouvrir cette page.`);window.location.replace('index.html?access=denied');}}
    catch(e){localStorage.setItem('_samassa_login_target',window.location.href);window.location.replace('login.html');}
  },
  async logout(){try{const auth=await this.ready();await auth.signOut();}catch{}window.location.replace('login.html');},
  async changePassword(oldPwd,newPwd){try{const auth=await this.ready();const user=auth.currentUser;if(!user||!user.email)return{ok:false,msg:'Session Firebase introuvable.'};if(!newPwd||newPwd.length<8)return{ok:false,msg:'Le nouveau mot de passe doit faire au moins 8 caractères.'};await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email,oldPwd));await user.updatePassword(newPwd);return{ok:true,msg:'Mot de passe Firebase modifié avec succès.'};}catch(error){return{ok:false,msg:this._message(error)};}},
  currentUser(){return this.auth?.currentUser||null;},
  _message(error){const code=error?.code||'';return({'auth/invalid-credential':'Email ou mot de passe incorrect.','auth/wrong-password':'Email ou mot de passe incorrect.','auth/user-not-found':'Aucun compte administrateur trouvé avec cet email.','auth/invalid-email':'Adresse email invalide.','auth/too-many-requests':'Trop de tentatives. Réessayez plus tard.','auth/network-request-failed':'Connexion réseau impossible.','auth/requires-recent-login':'Reconnectez-vous avant de changer le mot de passe.'}[code]||error?.message||'Erreur d’authentification Firebase.');},
  addLogoutButton(){const topbar=document.querySelector('.topbar');if(!topbar||document.getElementById('logout-btn'))return;const badge=document.createElement('span');badge.id='role-badge';badge.textContent='🔐';badge.title='Rôle';badge.style.cssText='font-size:12px;color:#3D5470;padding:6px 8px';topbar.appendChild(badge);const btn=document.createElement('button');btn.id='logout-btn';btn.textContent='🔒 Déco.';btn.style.cssText='background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.3);color:#B91C1C;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0';btn.onclick=()=>{if(confirm('Voulez-vous vous déconnecter ?'))this.logout();};topbar.appendChild(btn);setTimeout(()=>{if(this.role&&badge){badge.textContent=this.roleInfo().icon+' '+this.roleInfo().label;badge.title=this.roleInfo().label;}},500);}
};

Auth.check();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>Auth.addLogoutButton());else Auth.addLogoutButton();
