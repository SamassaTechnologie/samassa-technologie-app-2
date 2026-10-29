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
