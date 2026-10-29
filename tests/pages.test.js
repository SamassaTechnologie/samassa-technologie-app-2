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
