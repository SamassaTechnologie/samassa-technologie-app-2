/* Vérifications automatiques : node --test tests/ */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const lire = f => fs.readFileSync(path.join(root, f), 'utf8');

test('chaque page a titre, langue et viewport', () => {
  for (const p of pages) { const h = lire(p); assert.match(h, /<title>/, p + ' sans titre'); assert.match(h, /lang=/, p + ' sans lang'); assert.match(h, /viewport/, p + ' sans viewport'); }
});
test('tous les scripts locaux référencés existent', () => {
  for (const p of pages) for (const m of lire(p).matchAll(/<script[^>]+src="([^"?]+)(\?[^"]*)?"/g)) {
    if (/^(https?:)?\/\//.test(m[1])) continue; assert.ok(fs.existsSync(path.join(root, m[1])), p + ' → ' + m[1] + ' introuvable');
  }
});
test('les fichiers JS ont une syntaxe valide', () => {
  for (const f of fs.readdirSync(root).filter(f => f.endsWith('.js') && !/^(jsqr|qrcode\.min)/.test(f))) { assert.doesNotThrow(() => new vm.Script(lire(f), { filename: f }), f); }
});
test('les fichiers du service worker existent', () => {
  const sw = lire('service-worker.js');
  const bloc = sw.slice(sw.indexOf('['), sw.indexOf(']') + 1);
  for (const m of bloc.matchAll(/'([^']+\.(?:html|js|css|json|png))'/g)) assert.ok(fs.existsSync(path.join(root, m[1])), 'SW : ' + m[1] + ' manquant');
});
test('les pages qui injectent des données utilisent l\'échappement', () => {
  for (const p of ['stock.html', 'journal.html', 'rapports.html', 'index.html']) assert.match(lire(p), /esc\.js/, p);
  assert.match(lire('clients.html'), /esc\(/); assert.match(lire('recu.js'), /_e\(/);
});
test('piece-id : numéros et téléphones', () => {
  const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {} }, document: { readyState: 'complete', getElementById: () => null } };
  vm.createContext(ctx); vm.runInContext(lire('piece-id.js'), ctx);
  const P = ctx.window.PieceID;
  assert.equal(P.verifierNumero('197CI901041009A', 'nina').etat, 'ok');
  assert.equal(P.normaliserTel('76123456').texte, '+223 76 12 34 56');
  assert.equal(P.analyser('https://evil.example/x').numero, '');
});
test('les API sensibles exigent une connexion', () => {
  for (const f of fs.readdirSync(path.join(root, 'api'))) { if (f === 'csp-report.js' || f === 'verifier-doc.js') continue; assert.match(lire('api/' + f), /requireUser|iloveapi-service/, f); }
});
test('suivi des réparations : garantie et retard', () => {
  const ctx = { window: { escHtml: s => s }, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => '[]', setItem() {} } };
  ctx.window.addEventListener = () => {}; ctx.addEventListener = () => {};
  vm.createContext(ctx); vm.runInContext(lire('suivi.js'), ctx);
  const S = ctx.window.SuiviRep, hier = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  assert.equal(S.enRetard({ status: 'En réparation', returnDate: hier }), true);
  assert.equal(S.enRetard({ status: 'Restitué au client', returnDate: hier }), false);
  const g = S.garantie({ status: 'Restitué au client', warranty: '30 jours', restitue: new Date().toISOString() });
  assert.equal(g.valide, true);
  assert.equal(S.garantie({ status: 'En réparation', warranty: '30 jours' }), null);
});
test('rentabilité : bénéfice net', () => {
  const ctx = { window: { escHtml: s => s }, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => '[]' } };
  vm.createContext(ctx); vm.runInContext(lire('rentabilite.js'), ctx);
  const r = ctx.window.Rentabilite.calculer('2026-10', {
    caisse: [{ type: 'entree', date: '2026-10-05', amount: 100000, cat: 'Vente stock' }, { type: 'entree', date: '2026-09-30', amount: 999, cat: 'x' }, { type: 'sortie', date: '2026-10-06', amount: 10000 }],
    stock: [{ id: 1, pa: 3000 }], mvts: [{ type: 'sortie', date: '2026-10-05', motif: 'Vente', articleId: 1, name: 'Clé USB', qty: 10, prix: 5000 }],
    fixes: [{ montant: 20000 }] });
  assert.equal(r.ca, 100000); assert.equal(r.cout, 30000); assert.equal(r.margeBrute, 70000); assert.equal(r.net, 40000);
  assert.equal(r.produits[0].marge, 20000);
});
test('postes cyber : tarification', () => {
  const ctx = { window: { escHtml: s => s }, document: { addEventListener() {} }, localStorage: { getItem: () => null } };
  vm.createContext(ctx); vm.runInContext(lire('postes.js'), ctx);
  const P = ctx.window.Postes, c = { tarifHeure: 400, minimum: 100, pas: 5, prixPage: 75 };
  assert.equal(P.montantTemps(10, c), 100); assert.equal(P.montantTemps(40, c), 275); assert.equal(P.montantTemps(0, c), 0);
  const s = { debut: 0, forfait: { minutes: 30, prix: 250 } };
  assert.equal(P.montantSession(s, 50 * 60000, 2, c).total, 250 + 150 + 150);
  assert.equal(P.montantSession(s, 32 * 60000, 0, c).total, 250);
});
test('signature des documents : stable, sensible aux changements', async () => {
  const { pathToFileURL } = require('url');
  const m = await import(pathToFileURL(path.join(root, 'lib/doc-signature.js')).href);
  const d = m.nettoyer({ t: 'Reçu', n: 'REC-001', m: 15000, d: '2026-10-29' });
  const s1 = await m.signer(d, 'secret-de-test-assez-long-123456'), s2 = await m.signer({ ...d, total: 15001 }, 'secret-de-test-assez-long-123456');
  assert.match(s1, /^[0-9a-f]{20}$/); assert.notEqual(s1, s2);
  assert.equal(s1, await m.signer(d, 'secret-de-test-assez-long-123456'));
  assert.ok(m.egal(s1, s1)); assert.ok(!m.egal(s1, s2));
  assert.throws(() => m.nettoyer({ t: 'Autre', n: 'x', m: 1, d: '2026-10-29' }));
  assert.throws(() => m.nettoyer({ t: 'Reçu', n: '<script>', m: 1, d: '2026-10-29' }));
});
test('contrats : échéances, retards et revenu récurrent', () => {
  const ctx = { window: { escHtml: s => s }, document: { addEventListener() {} }, localStorage: { getItem: () => '[]' } };
  vm.createContext(ctx); vm.runInContext(lire('contrats.js'), ctx);
  const C = ctx.window.Contrats, c = { debut: '2026-08-10', jour: 5, montant: 20000, payes: ['2026-08'] };
  assert.equal(C.echeances(c, '2026-10-29').length, 3);
  const e = C.etat(c, '2026-10-29');
  assert.equal(e.cle, 'late'); assert.equal(e.impayes.length, 2);
  assert.equal(C.etat({ ...c, payes: ['2026-08', '2026-09', '2026-10'] }, '2026-10-29').cle, 'ok');
  assert.equal(C.etat({ ...c, statut: 'suspendu' }, '2026-10-29').cle, 'off');
  assert.equal(C.mrr([c, { montant: 5000 }, { montant: 9000, statut: 'suspendu' }]), 25000);
});
test('commandes : réception met à jour stock et prix moyen', () => {
  const ctx = { window: { escHtml: s => s }, document: { addEventListener() {} }, localStorage: { getItem: () => '[]' } };
  vm.createContext(ctx); vm.runInContext(lire('commandes.js'), ctx);
  const C = ctx.window.Commandes;
  const cmd = { numero: 'CMD-001', lignes: [{ nom: 'Souris', qte: 10, prix: 2000, articleId: 1 }, { nom: 'Nouveau câble', qte: 5, prix: 500, pv: 1000 }] };
  const r = C.appliquerReception(cmd, [{ id: 1, name: 'Souris', qty: 10, pa: 1000, pv: 3000 }], [], '2026-10-29T10:00:00.000Z');
  assert.equal(r.stock[0].qty, 20); assert.equal(r.stock[0].pa, 1500);
  assert.equal(r.stock.length, 2); assert.equal(r.stock[1].name, 'Nouveau câble'); assert.equal(r.stock[1].qty, 5); assert.equal(r.stock[1].pv, 1000);
  assert.equal(r.mvts.length, 2); assert.equal(r.mvts[0].type, 'entree'); assert.equal(C.totalCmd(cmd), 22500);
});
test('rentabilité : les achats de stock ne comptent pas comme charges', () => {
  const ctx = { window: { escHtml: s => s }, document: { addEventListener() {} }, localStorage: { getItem: () => '[]' } };
  vm.createContext(ctx); vm.runInContext(lire('rentabilite.js'), ctx);
  const r = ctx.window.Rentabilite.calculer('2026-10', { caisse: [{ type: 'sortie', date: '2026-10-02', amount: 50000, cat: 'Achat stock' }, { type: 'sortie', date: '2026-10-03', amount: 1000, cat: 'Autre' }], stock: [], mvts: [], fixes: [] });
  assert.equal(r.depenses, 1000);
});
test('rapprochement mobile money : analyse des SMS et rapprochement', () => {
  const ctx = { window: { escHtml: s => s }, document: { addEventListener() {} }, localStorage: { getItem: () => '[]' } };
  vm.createContext(ctx); vm.runInContext(lire('rapprochement.js'), ctx);
  const R = ctx.window.Rapprochement;
  const a = R.analyserSms('Wave: Vous avez reçu 5 000 FCFA de Awa (76123456) le 29/10/2026. ID: ABC12345\n\nOrange Money: Vous avez reçu 12.500F de 66000000. Trans ID: OM998877\n\nWave: Vous avez envoyé 3000 FCFA à Moussa.\n\nBonne journée', '2026-10-29');
  assert.equal(a.retenus.length, 2); assert.equal(a.ignores, 2);
  assert.deepEqual([a.retenus[0].operateur, a.retenus[0].montant, a.retenus[0].date, a.retenus[0].ref], ['Wave', 5000, '2026-10-29', 'ABC12345']);
  assert.deepEqual([a.retenus[1].operateur, a.retenus[1].montant], ['Orange Money', 12500]);
  assert.equal(R.nombre('1.250,00'), 1250);
  const r = R.rapprocher(a.retenus, [{ type: 'entree', pm: 'Wave', amount: 5000, date: '2026-10-29', desc: 'Reçu 1' }, { type: 'entree', pm: 'Moov Money', amount: 7000, date: '2026-10-29', desc: 'Reçu 2' }, { type: 'entree', pm: 'Espèces', amount: 100, date: '2026-10-29', desc: 'x' }]);
  assert.equal(r.liens.length, 1); assert.equal(r.sansCaisse.length, 1); assert.equal(r.sansPaiement.length, 1); assert.equal(r.sansPaiement[0].desc, 'Reçu 2');
});
test('règlement des factures : calcul et créance', () => {
  const ctx = { window: {}, document: { addEventListener() {} }, localStorage: { getItem: () => '[]' } };
  vm.createContext(ctx); vm.runInContext(lire('paiement-facture.js'), ctx);
  const P = ctx.window.PaiementFacture;
  assert.deepEqual({ ...P.calculer('payé', 0, 10000) }, { paye: 10000, du: 0, statut: 'Payé' });
  assert.deepEqual({ ...P.calculer('partiel', 4000, 10000) }, { paye: 4000, du: 6000, statut: 'Partiellement payé' });
  assert.deepEqual({ ...P.calculer('impayé', 500, 10000) }, { paye: 0, du: 10000, statut: 'Impayé' });
  let c = P.synchroCreance([], { numero: 'FAC-001', client: 'Awa', du: 6000, echeance: '2026-11-30' });
  assert.equal(c.length, 1); assert.equal(c[0].amount, 6000); assert.equal(c[0].paid, false);
  c = P.synchroCreance(c, { numero: 'FAC-001', client: 'Awa', du: 2000 }); assert.equal(c.length, 1); assert.equal(c[0].amount, 2000);
  c = P.synchroCreance(c, { numero: 'FAC-001', client: 'Awa', du: 0 }); assert.equal(c[0].paid, true);
});

test('assistant.js : collecte sans données personnelles', () => {
  const store = { samassa_mouvements: JSON.stringify([{ id: 1, type: 'entree', amount: 5000, date: '2026-10-05', pm: 'Cash', desc: 'Jean Dupont' }]), samassa_creances: JSON.stringify([{ client: 'Awa Traoré', amount: 1000, paid: false, due: '2026-10-01' }]) };
  global.window = {}; global.document = { addEventListener() {}, getElementById() { return null; } };
  delete require.cache[require.resolve('../assistant.js')]; require('../assistant.js');
  const out = window.AssistantIA.collecter({ lire: k => JSON.parse(store[k] || '[]') }, '2026-10-29T10:00:00Z');
  const txt = JSON.stringify(out);
  assert.equal(out.creancesClients.total, 1000);
  assert.ok(!txt.includes('Jean') && !txt.includes('Awa'));
});

test('scanner-intelligent : recadrage, seuil adaptatif, champs', () => {
  global.window = {}; global.document = undefined;
  delete require.cache[require.resolve('../scanner-intelligent.js')]; require('../scanner-intelligent.js');
  const L = window.ScanLib, w = 100, h = 100, g = new Uint8Array(w * h).fill(30);
  for (let y = 20; y < 80; y++) for (let x = 25; x < 85; x++) g[y * w + x] = 220;
  const b = L.limitesDocument(g, w, h);
  assert.ok(b && b.x > .1 && b.x < .3 && b.w > .5 && b.w < .75);
  assert.equal(L.limitesDocument(new Uint8Array(w * h).fill(200), w, h), null);
  const t = new Uint8Array(w * h).fill(200); t[50 * w + 50] = 20;
  const s = L.seuilAdaptatif(t, w, h, 15, .9); assert.equal(s[50 * w + 50], 0); assert.equal(s[10], 255);
  const c = L.champs('Tel 76 12 34 56, mail a@b.com le 12/05/2025 total 150 000 FCFA');
  assert.equal(c.telephones.length, 1); assert.equal(c.emails[0], 'a@b.com'); assert.equal(c.dates[0], '12/05/2025'); assert.equal(c.montants.length, 1);
});

test('pdf-local : parsePages', () => {
  global.window = {}; global.document = undefined;
  delete require.cache[require.resolve('../pdf-local.js')]; require('../pdf-local.js');
  const f = window.PdfLocal.parsePages;
  assert.deepEqual(f('1-3,5', 6), [0, 1, 2, 4]); assert.deepEqual(f('3-1', 5), [0, 1, 2]);
  assert.throws(() => f('7', 5)); assert.throws(() => f('a', 5)); assert.throws(() => f('', 5));
});

test('assistant-redaction : classement et lecture de réponse', () => {
  global.window = {}; global.document = undefined;
  const f = path.join(__dirname, '../redacteur-ia-mali/assistant-redaction.js');
  delete require.cache[require.resolve(f)]; require(f);
  const A = window.AssistantRedaction, M = [{ titre: 'Facture', cat: 'Ventes' }, { titre: 'Demande de congé', cat: 'Lettres', objet: 'Demande de congé annuel' }, { titre: 'Attestation de résidence', cat: 'Attestations' }];
  assert.equal(A.classer(M, 'je veux un congé pour mariage', 3)[0], 1);
  assert.equal(A.classer(M, 'blabla', 3).length, 0);
  const r = A.lireReponse('NOM: **Awa Traoré**\nMOTIF: Je sollicite\nun congé.\nINCONNU: x\nTEL: [À COMPLÉTER]', ['NOM', 'MOTIF', 'TEL']);
  assert.equal(r.NOM, 'Awa Traoré'); assert.equal(r.MOTIF, 'Je sollicite\nun congé.'); assert.equal(r.TEL, undefined); assert.equal(r.INCONNU, undefined);
});

test('ticket80 : modèle de lignes du reçu', () => {
  global.window = {}; global.document = undefined;
  const f = path.join(__dirname, '../ticket80.js'); delete require.cache[require.resolve(f)]; require(f);
  const T = window.Ticket80, m = T.modele({ societe: { nom: 'Samassa' }, numero: 'REC-1', client: 'A B', lignes: [{ desc: 'NINA', qte: 1, pu: 10000, total: 10000 }], total: 10000, mode: 'Wave', qr: true });
  const h = T.html(m);
  assert.ok(h.includes('SAMASSA') && h.includes('10 000 FCFA') && h.includes('t-qr'));
  assert.ok(!T.html(T.modele({ societe: { nom: 'X' }, lignes: [], total: 0, qr: false })).includes('t-qr'));
  assert.ok(T.html(T.modele({ societe: { nom: '<b>x</b>' }, lignes: [], total: 0 })).includes('&lt;B&gt;'));
});

test('ticket80 : montant en lettres', () => {
  global.window = {}; global.document = undefined;
  const f = path.join(__dirname, '../ticket80.js'); delete require.cache[require.resolve(f)]; require(f);
  const L = window.Ticket80.enLettres, cas = { 0: 'zéro', 21: 'vingt et un', 71: 'soixante et onze', 80: 'quatre-vingts', 81: 'quatre-vingt-un', 91: 'quatre-vingt-onze', 200: 'deux cents', 201: 'deux cent un', 1000: 'mille', 2000: 'deux mille', 10000: 'dix mille', 80000: 'quatre-vingt mille', 1500: 'mille cinq cents', 24000: 'vingt-quatre mille', 1000000: 'un million', 2000000: 'deux millions', 1200000: 'un million deux cent mille', 180000: 'cent quatre-vingt mille' };
  Object.keys(cas).forEach(k => assert.equal(L(+k), cas[k], k));
});

test('photo-formats : données et grille de planche', () => {
  const P = require('../photo-formats.js');
  assert.ok(P.FORMATS.length >= 60);
  P.FORMATS.forEach(f => { assert.ok(f.w > 0 && f.h > 0 && f.teteMin < f.teteMax && f.teteMax < f.h, f.pays + ' ' + f.doc); });
  assert.ok(P.FORMATS.some(f => f.pays === 'Mali') && P.FORMATS.some(f => f.pays === 'France' && f.w === 35 && f.h === 45));
  assert.equal(P.grille(100, 150, 35, 45, 4, 2).n, 6);
  assert.ok(P.grille(210, 297, 35, 45, 4, 2).n >= 28);
  assert.equal(P.grille(100, 150, 200, 200, 4, 2).n, 0);
});

test('tableau de bord par catégories : liens valides et sans doublon', () => {
  const fs = require('fs'), idx = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const cats = idx.split('<section class="cat"').slice(1);
  assert.ok(cats.length >= 8);
  const hrefs = [];
  cats.forEach(c => (c.split('</section>')[0].match(/<a href="([^"#][^"]*)"/g) || []).forEach(h => hrefs.push(h.slice(9, -1))));
  hrefs.forEach(h => assert.ok(fs.existsSync(path.join(__dirname, '..', h)), 'page absente : ' + h));
  assert.equal(new Set(hrefs).size, hrefs.length, 'lien en double');
  const nav = idx.slice(idx.indexOf('<nav class="sb-nav">'), idx.indexOf('</nav>', idx.indexOf('<nav class="sb-nav">')));
  (nav.match(/<a href="([^"]+)" class="sb-item"/g) || []).forEach(h => assert.ok(fs.existsSync(path.join(__dirname, '..', h.slice(9).split('"')[0])), 'menu : ' + h));
});

test('relances: tri, message et encaissement partiel relié à la caisse', () => {
  global.window = global.window || {}; delete require.cache[require.resolve('../relances.js')]; require('../relances.js');
  const R = global.window.Relances;
  const cr = [{ id: 1, client: 'A', amount: 5000, due: '2026-11-01', paid: false }, { id: 2, client: 'B', amount: 9000, due: '2026-11-20', paid: false }, { id: 3, client: 'C', amount: 0, paid: true }];
  const o = R.creancesOuvertes(cr, '2026-11-07');
  assert.equal(o.length, 2); assert.equal(o[0].client, 'A'); assert.equal(o[0].retard, 6); assert.equal(o[0].niveau, 'retard');
  assert.match(R.message(o[0], 'X'), /6 jours/);
  const r = R.encaisser(cr, 1, 2000, '2026-11-07'); assert.equal(r.creances[0].amount, 3000); assert.equal(r.mouvement.amount, 2000); assert.equal(r.mouvement.type, 'entree');
  const r2 = R.encaisser(cr, 1, 99999, '2026-11-07'); assert.equal(r2.mouvement.amount, 5000); assert.equal(r2.creances[0].paid, true);
});

test('marketing: profils par téléphone, points, paliers, segments, message', () => {
  global.window = global.window || {}; delete require.cache[require.resolve('../marketing.js')]; require('../marketing.js');
  const M = global.window.Marketing;
  const p = M.profils({ clients: [{ prenom: 'Awa', nom: 'TRAORÉ', tel: '76 12 34 56' }], achats: [{ client: 'Awa Traoré', phone: '+223 76123456', total: 60000, date: '01/09/2026' }, { client: 'Awa', tel: '76123456', total: 100000, timestamp: '2026-11-01T10:00:00Z' }, { client: 'X', phone: '', total: 5 }] }, '2026-11-07');
  assert.equal(p.length, 1); assert.equal(p[0].nb, 2); assert.equal(p[0].points, 160); assert.equal(p[0].palier.nom, 'Or'); assert.equal(p[0].inactif, 6);
  assert.ok(M.SEGMENTS.vip(p[0])); assert.ok(!M.SEGMENTS.inactifs(p[0]));
  assert.equal(M.rediger('Bonjour {nom} {points} {palier} {offre}', p[0], '-10 %'), 'Bonjour Awa 160 Or -10 %');
});

test('abonnements: états, renouvellement avec fin de mois, encaissement, stats', () => {
  global.window = global.window || {}; delete require.cache[require.resolve('../abonnements.js')]; require('../abonnements.js');
  const A = global.window.Abonnements;
  assert.equal(A.ajouterMois('2026-01-31', 1), '2026-02-28'); assert.equal(A.ajouterMois('2026-11-15', 12), '2027-11-15');
  assert.equal(A.etat({ expiration: '2026-11-01' }, '2026-11-07').cle, 'expire'); assert.equal(A.etat({ expiration: '2026-11-20' }, '2026-11-07').cle, 'bientot'); assert.equal(A.etat({ expiration: '2027-05-01' }, '2026-11-07').cle, 'ok');
  const a = { type: 'Nom de domaine', nom: 'x.ml', client: 'Awa', expiration: '2026-11-01', prix: 15000, cout: 9000, duree: 12 };
  const r = A.renouveler(a, 12, '2026-11-07', true); assert.equal(r.abonnement.expiration, '2027-11-07'); assert.equal(r.mouvement.amount, 15000); assert.equal(r.abonnement.historique.length, 1);
  assert.equal(A.renouveler({ ...a, expiration: '2026-12-01' }, 12, '2026-11-07', false).abonnement.expiration, '2027-12-01');
  const s = A.stats([a, { ...a, expiration: '2027-05-01', prix: 6000, cout: 1000, duree: 6 }], '2026-11-07'); assert.equal(s.revenuAnnuel, 12000); assert.equal(s.margeAnnuelle, 10000); assert.equal(s.expires, 1);
});

test('catalogue: aller-retour du lien, filtre des articles, lien de commande', async () => {
  delete require.cache[require.resolve('../catalogue.js')]; require('../catalogue.js');
  const C = (global.window && global.window.Catalogue) || globalThis.Catalogue;
  const l = C.articles([{ id: 1, name: 'Clavier', pv: 5000, qty: 3, cat: 'Accessoires' }, { id: 2, name: 'Souris', pv: 2000, qty: 0 }, { id: 3, name: 'Écran', pv: 0, qty: 5 }, { id: 4, name: 'Câble', pv: 500, qty: 9 }], { exclus: [4], services: [{ n: 'Photos', p: 1000 }] });
  assert.deepEqual(l, [['Clavier', 5000, 'Accessoires'], ['Photos', 1000, 'Services']]);
  const code = await C.encoder({ s: { n: 'É', t: '77291931' }, i: l }); const d = await C.decoder(code);
  assert.deepEqual(d.i, l); assert.equal(d.s.n, 'É');
  assert.match(C.lienCommande('77 29 19 31', 'S', 'Clavier', 5000), /^https:\/\/wa\.me\/22377291931\?text=/);
  const code2 = await C.encoder({ s: {}, i: [['é', 1, 'x']] }); assert.ok(/^[gp]/.test(code2));
});

test('prospects: stats, étape suivante, conversion en client sans doublon', () => {
  global.window = global.window || {}; delete require.cache[require.resolve('../prospects.js')]; require('../prospects.js');
  const P = global.window.Prospects;
  const l = [{ etape: 'Nouveau', montant: 1000, relance: '2026-11-01', source: 'Facebook' }, { etape: 'Gagné', montant: 5000, source: 'Facebook' }, { etape: 'Perdu', source: 'WhatsApp' }, { etape: 'Gagné', montant: 2000, source: 'WhatsApp' }];
  const s = P.stats(l, '2026-11-07'); assert.equal(s.ouverts, 1); assert.equal(s.valeurGagnee, 7000); assert.equal(s.conversion, 67); assert.equal(s.aRelancer, 1); assert.equal(s.sources.Facebook.gagnes, 1);
  assert.equal(P.suivante('Nouveau'), 'Contacté'); assert.equal(P.suivante('Négociation'), null);
  const c = P.versClient({ nom: 'Awa Traoré', tel: '76123456', source: 'Facebook', besoin: 'site' }, []); assert.equal(c.nom, 'TRAORÉ'); assert.equal(c.prenom, 'Awa');
  assert.equal(P.versClient({ nom: 'Awa', tel: '+223 76 12 34 56' }, [{ tel: '76123456' }]), null);
  assert.match(P.msgAvis('Awa Traoré', 'https://x'), /Bonjour Awa.*https:\/\/x/);
});

test('parc: garantie (états, fin de mois), stats, recherche', () => {
  global.window = global.window || {}; delete require.cache[require.resolve('../parc.js')]; require('../parc.js');
  const P = global.window.Parc;
  assert.equal(P.garantie({ achat: '2026-01-31', garantieMois: 1 }, '2026-02-01').fin, '2026-02-28');
  assert.equal(P.garantie({ achat: '2025-01-10', garantieMois: 12 }, '2026-11-07').cle, 'expiree');
  assert.equal(P.garantie({ achat: '2025-11-20', garantieMois: 12 }, '2026-11-07').cle, 'bientot');
  assert.equal(P.garantie({ achat: '2026-10-01', garantieMois: 24 }, '2026-11-07').cle, 'ok');
  assert.equal(P.garantie({ achat: '2026-10-01', garantieMois: 0 }, '2026-11-07').cle, 'aucune');
  const l = [{ client: 'Awa', marque: 'HP', serie: 'ABC123', achat: '2026-10-01', garantieMois: 12, pannes: [{ cout: 5000 }] }, { client: 'Bako', marque: 'Dell', achat: '2024-01-01', garantieMois: 12 }];
  const s = P.stats(l, '2026-11-07'); assert.equal(s.total, 2); assert.equal(s.sous, 1); assert.equal(s.pannes, 1); assert.equal(s.coutPannes, 5000);
  assert.equal(P.chercher(l, 'abc1').length, 1); assert.equal(P.chercher(l, '').length, 2);
});

test('projets: avancement, soldes, acompte plafonné relié à la caisse, retard', () => {
  global.window = global.window || {}; delete require.cache[require.resolve('../projets.js')]; require('../projets.js');
  const P = global.window.Projets;
  let p = { client: 'Awa', titre: 'Site', prix: 100000, echeance: '2026-11-01', etapes: P.ETAPES.map(n => ({ nom: n, fait: false })), paiements: [] };
  assert.equal(P.progression(p), 0); assert.ok(P.enRetard(p, '2026-11-07'));
  p = P.basculer(p, 0, '2026-11-07'); p = P.basculer(p, 1, '2026-11-07'); assert.equal(P.progression(p), 29);
  const r = P.ajouterPaiement(p, 30000, '2026-11-07', 'Acompte'); assert.equal(P.solde(r.projet), 70000); assert.equal(r.mouvement.amount, 30000);
  const r2 = P.ajouterPaiement(r.projet, 999999, '2026-11-07'); assert.equal(r2.mouvement.amount, 70000); assert.equal(P.solde(r2.projet), 0);
  assert.equal(P.ajouterPaiement(r2.projet, 10, '2026-11-07').mouvement, null);
  const s = P.stats([p, r2.projet], '2026-11-07'); assert.equal(s.encaisse, 100000); assert.equal(s.aEncaisser, 100000);
});

test('rappels du jour: agrégation de toutes les sources', () => {
  global.window = global.window || {}; delete require.cache[require.resolve('../rappels-jour.js')]; require('../rappels-jour.js');
  const R = global.window.RappelsJour;
  assert.deepEqual(R.compter({}, '2026-11-07'), []);
  const t = R.compter({ creances: [{ amount: 5000, due: '2026-11-01', paid: false }, { amount: 100, due: '2026-12-01' }], abonnements: [{ expiration: '2026-11-20' }, { expiration: '2027-06-01' }], parc: [{ achat: '2025-11-20', garantieMois: 12 }], prospects: [{ etape: 'Nouveau', relance: '2026-11-07' }, { etape: 'Gagné', relance: '2026-01-01' }], projets: [{ echeance: '2026-11-01', etapes: [{ fait: false }] }], stock: [{ qty: 1, min: 2 }], recus: [{ rdvDate: '2026-11-07', retrieved: false }] }, '2026-11-07');
  assert.deepEqual(t.map(x => x.cle), ['creances', 'abonnements', 'garanties', 'prospects', 'projets', 'stock', 'rdv']); assert.ok(t.every(x => x.n === 1));
});

test('employés: bulletin (absences, primes, avances), paie, sortie de caisse', () => {
  global.window = global.window || {}; delete require.cache[require.resolve('../employes.js')]; require('../employes.js');
  const E = global.window.Employes; let e = { nom: 'Moussa', salaire: 130000, lignes: [] };
  e = E.ajouter(e, '2026-11', 'absence', 2, '', '2026-11-07'); e = E.ajouter(e, '2026-11', 'prime', 10000, '', '2026-11-07'); e = E.ajouter(e, '2026-11', 'avance', 20000, '', '2026-11-07'); e = E.ajouter(e, '2026-10', 'prime', 99999, '', '2026-10-01');
  let b = E.bulletin(e, '2026-11'); assert.equal(b.retenue, 10000); assert.equal(b.net, 110000); assert.equal(b.reste, 110000);
  const m = E.sortieCaisse(e, 'paie', b.reste, '2026-11-30'); assert.equal(m.type, 'sortie'); assert.equal(m.amount, 110000); assert.equal(m.cat, 'Salaires');
  e = E.ajouter(e, '2026-11', 'paie', 110000, '', '2026-11-30'); b = E.bulletin(e, '2026-11'); assert.equal(b.reste, 0);
  assert.equal(E.totalMois([e], '2026-11').paye, 110000);
});

test('compta: bilan mensuel, TVA TTC/HT, évolution et CSV', () => {
  global.window = global.window || {}; delete require.cache[require.resolve('../compta.js')]; require('../compta.js');
  const C = global.window.Compta;
  const mv = [{ date: '2026-11-02', type: 'entree', amount: 118000, cat: 'Vente service', pm: 'Espèces' }, { date: '2026-11-03', type: 'entree', amount: 59000, cat: 'Vente matériel', pm: 'Orange Money' }, { date: '2026-11-05', type: 'sortie', amount: 80000, cat: 'Salaires', desc: 'Salaire "A"' }, { date: '2026-10-05', type: 'entree', amount: 5000 }];
  const b = C.bilan(mv, '2026-11', 18, true); assert.equal(b.recettes, 177000); assert.equal(b.depenses, 80000); assert.equal(b.resultat, 97000); assert.equal(b.tva, 27000); assert.equal(b.recettesHT, 150000); assert.equal(b.parCatRecettes[0].nom, 'Vente service');
  assert.equal(C.bilan(mv, '2026-11', 18, false).tva, 31860); assert.equal(C.bilan(mv, '2026-11', 0, true).tva, 0);
  const e = C.evolution(mv, '2026-11', 2); assert.deepEqual(e.map(x => x.recettes), [5000, 177000]);
  const c = C.csv(mv, '2026-11'); assert.equal(c.split('\n').length, 4); assert.ok(c.includes('"Salaire ""A"""'));
});
