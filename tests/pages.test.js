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
  for (const p of ['stock.html', 'journal.html', 'rapports.html']) assert.match(lire(p), /esc\.js/, p);
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
  for (const f of fs.readdirSync(path.join(root, 'api'))) { if (f === 'csp-report.js') continue; assert.match(lire('api/' + f), /requireUser|iloveapi-service/, f); }
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
