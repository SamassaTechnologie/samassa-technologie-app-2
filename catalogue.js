/* Catalogue en ligne sans serveur : les données sont encodées dans le lien (#c=...). Le lien se partage sur WhatsApp. */
'use strict';
(function (root) {
  function b64u(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function deb64u(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  async function flux(bytes, Ctor, fmt) { var cs = new Ctor(fmt), w = cs.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
  /* data = {s:{n,t,a}, i:[[nom,prix,categorie],...]} → 'g…' (gzip) ou 'p…' (brut) */
  async function encoder(data) {
    var bytes = new TextEncoder().encode(JSON.stringify(data));
    try { if (typeof CompressionStream !== 'undefined') { var z = await flux(bytes, CompressionStream, 'gzip'); return 'g' + b64u(z); } } catch (e) {}
    return 'p' + b64u(bytes);
  }
  async function decoder(txt) {
    var m = txt.charAt(0), b = deb64u(txt.slice(1));
    if (m === 'g') b = await flux(b, DecompressionStream, 'gzip');
    var d = JSON.parse(new TextDecoder().decode(b)); if (!d || !Array.isArray(d.i)) throw new Error('catalogue invalide'); return d;
  }
  function numWa(t) { var n = String(t || '').replace(/\D/g, ''); if (n.length > 8 && n.indexOf('223') !== 0) n = n.slice(0, 8); return n.length === 8 ? '223' + n : n; }
  function lienCommande(tel, boutique, article, prix) { return 'https://wa.me/' + numWa(tel) + '?text=' + encodeURIComponent('Bonjour ' + (boutique || '') + ', je souhaite commander : ' + article + (Number(prix) > 0 ? ' (' + Number(prix).toLocaleString('fr-FR') + ' FCFA)' : '') + '. Pouvez-vous me donner le prix et la disponibilité ?'); }
  /* Présentation courte de chaque service (modifiable dans « Catalogue en ligne ») : descriptive, sans promesse chiffrée */
  var DESCRIPTIONS = {
    'Impression noir & blanc (page)': 'Documents, rapports, CV et formulaires au format A4.',
    'Impression couleur (page)': 'Affiches, photos et documents en couleur.',
    'Photocopie (page)': 'Copie de pièces d\'identité, diplômes et documents.',
    'Scan de documents': 'Numérisation en PDF ou image, envoi par WhatsApp ou e-mail.',
    'Saisie / dactylographie de documents': 'Mise au propre de vos lettres, rapports et mémoires.',
    'Ressaisie de documents manuscrits': 'Vos textes écrits à la main transformés en document imprimable.',
    'Création de CV': 'CV clair et soigné, prêt à imprimer ou à envoyer.',
    'Accès internet (cyber, à l\'heure)': 'Postes connectés pour vos recherches et démarches.',
    'Assistance clients (démarches en ligne)': 'Nous vous accompagnons pour vos inscriptions et formulaires en ligne.',
    'Photos d\'identité (tous formats, tous pays)': 'Passeport, visa, carte NINA, concours : au format exigé.',
    'Carte NINA (assistance et reçu)': 'Accompagnement pour vos démarches liées à la carte NINA.',
    'Scan de carte NINA': 'Numérisation recto verso de votre carte NINA.',
    'Scan de carte biométrique': 'Numérisation recto verso de votre carte biométrique.',
    'Attestations et lettres administratives': 'Rédaction de demandes, attestations et courriers officiels.',
    'Formulaires et démarches administratives': 'Aide au remplissage et à la constitution de vos dossiers.',
    'Contrats simples': 'Location, vente, prestation : rédaction de contrats courants.',
    'Diagnostic et dépannage ordinateur': 'Recherche de la panne et remise en état de votre ordinateur.',
    'Installation Windows': 'Installation ou réinstallation du système, avec vos logiciels de base.',
    'Optimisation et nettoyage PC': 'Un ordinateur plus rapide : nettoyage et réglages.',
    'Installation de pilotes': 'Imprimante, carte son, Wi-Fi : installation des pilotes manquants.',
    'Dépannage imprimante': 'Installation, configuration et résolution des pannes d\'impression.',
    'Installation réseau / Wi-Fi': 'Mise en place de votre réseau à la maison ou au bureau.',
    'Antivirus et licences logicielles': 'Protection de votre ordinateur et activation de vos logiciels.',
    'Site vitrine': 'Présentez votre activité sur internet avec un site à votre image.',
    'Boutique en ligne': 'Vendez vos produits en ligne avec commande par WhatsApp.',
    'Application web (PWA)': 'Une application sur mesure, utilisable sur téléphone et ordinateur.',
    'Nom de domaine': 'Votre adresse internet au nom de votre entreprise.',
    'Hébergement web': 'Mise en ligne et hébergement de votre site.',
    'Maintenance de site web': 'Mises à jour, corrections et suivi de votre site.',
    'Logo et identité visuelle': 'Logo, couleurs et supports pour votre image de marque.',
    'Vente de matériel informatique et accessoires': 'Ordinateurs, imprimantes, consommables et accessoires.'
  };
  var ICONES = { 'Cyber & bureautique': '🖨️', 'Documents administratifs': '🪪', 'Maintenance informatique': '🛠️', 'Développement web': '🌐', 'Vente de matériel': '💻', 'Services': '✨' };
  function icone(cat) { return ICONES[cat] || '📦'; }
  /* Construit les articles : stock (pv > 0, qty > 0, non exclus) + services personnalisés */
  function articles(stock, cfg) {
    var ex = {}; (cfg.exclus || []).forEach(function (id) { ex[id] = 1; });
    var l = (stock || []).filter(function (s) { return Number(s.pv) > 0 && Number(s.qty) > 0 && !ex[s.id]; }).map(function (s) { return [String(s.name), Math.round(Number(s.pv)), String(s.cat || 'Matériel')]; });
    (cfg.services || []).forEach(function (s) { if (!(s.n && Number(s.p) >= 0)) return; var a = [String(s.n), Math.round(Number(s.p)), String(s.c || 'Services')], d = s.d != null ? String(s.d).trim() : (DESCRIPTIONS[s.n] || ''); if (d) a.push(d.slice(0, 140)); l.push(a); });
    return l;
  }
  /* Lien court : le catalogue est enregistré dans la base Firebase (écriture réservée au compte connecté) puis relu SANS connexion pour vérifier que le lien fonctionnera chez vos clients. */
  var CH = 'abcdefghjkmnpqrstuvwxyz23456789';
  function idCourt() { var a = new Uint8Array(7), s = ''; (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); for (var i = 0; i < a.length; i++) s += CH[a[i] % CH.length]; return s; }
  function urlBase(db, id, token) { return db.replace(/\/$/, '') + '/samassa_catalogues/' + encodeURIComponent(id) + '.json' + (token ? '?auth=' + encodeURIComponent(token) : ''); }
  async function publier(db, id, data, token, f) {
    f = f || root.fetch;
    var r = await f(urlBase(db, id, token), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, data, { maj: new Date().toISOString() })) });
    if (!r.ok) return { ok: false, etape: 'ecriture', statut: r.status };
    var l = await f(urlBase(db, id, null)); /* lecture publique, sans jeton */
    if (!l.ok) return { ok: false, etape: 'lecture', statut: l.status };
    var d = await l.json(); return d && Array.isArray(d.i) ? { ok: true } : { ok: false, etape: 'lecture', statut: 0 };
  }
  async function charger(db, id, f) { var r = await (f || root.fetch)(urlBase(db, id, null)); if (!r.ok) throw new Error('lecture ' + r.status); var d = await r.json(); if (!d || !Array.isArray(d.i)) throw new Error('catalogue introuvable'); return d; }
  root.Catalogue = { DESCRIPTIONS: DESCRIPTIONS, icone: icone, idCourt: idCourt, publier: publier, charger: charger, encoder: encoder, decoder: decoder, lienCommande: lienCommande, articles: articles, numWa: numWa };
})(typeof window !== 'undefined' ? window : globalThis);
