// api/csp-report.js : reçoit les rapports du navigateur (mode « Report-Only ») et les écrit dans les journaux Vercel.
// Sert à vérifier, sur le vrai site, ce qui serait bloqué par une politique de sécurité plus stricte,
// avant de l'appliquer. Aucune donnée personnelle : seulement la règle violée et l'adresse du fichier.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  try {
    const brut = (await req.text()).slice(0, 8000);
    const j = JSON.parse(brut);
    const liste = Array.isArray(j) ? j.map(x => x.body || x) : [j['csp-report'] || j];
    for (const r of liste.slice(0, 5)) {
      console.log('CSP-REPORT ' + JSON.stringify({
        regle: r['effective-directive'] || r.effectiveDirective || r['violated-directive'] || '',
        bloque: String(r['blocked-uri'] || r.blockedURL || '').slice(0, 150),
        page: String(r['document-uri'] || r.documentURL || '').replace(/[?#].*$/, '').slice(0, 120),
        source: String(r['source-file'] || r.sourceFile || '').replace(/[?#].*$/, '').slice(0, 120),
        ligne: r['line-number'] || r.lineNumber || 0
      }));
    }
  } catch (e) { /* rapport illisible : ignoré */ }
  return new Response(null, { status: 204 });
}
