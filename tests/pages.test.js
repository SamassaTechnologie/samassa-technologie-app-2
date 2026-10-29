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
