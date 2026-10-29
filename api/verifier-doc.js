// Vérification publique : le document correspond-il bien à ce que SAMASSA TECHNOLOGIE a émis ?
import { nettoyer, signer, egal } from '../lib/doc-signature.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers });
  const secret = process.env.DOC_SIGN_SECRET;
  if (!secret || secret.length < 24) return new Response(JSON.stringify({ error: 'Vérification indisponible.' }), { status: 503, headers });
  try {
    const p = Object.fromEntries(new URL(req.url).searchParams);
    const doc = nettoyer(p);
    const s = String(p.s || '');
    const valide = /^[0-9a-f]{20}$/.test(s) && egal(await signer(doc, secret), s);
    return new Response(JSON.stringify(valide ? { valide: true, ...doc } : { valide: false }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ valide: false }), { status: 200, headers });
  }
}
