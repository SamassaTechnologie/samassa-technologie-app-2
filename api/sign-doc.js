// Délivre l'adresse de vérification signée d'un document (réservé aux utilisateurs connectés).
import { requireUser } from '../lib/iloveapi-service.js';
import { nettoyer, signer } from '../lib/doc-signature.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const origin = process.env.ALLOWED_ORIGIN || 'https://samassa-technologie-app-2.vercel.app';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers });
  try { await requireUser(req); } catch (e) { return new Response(JSON.stringify({ error: e.message || 'Connexion requise.' }), { status: e.status || 401, headers }); }
  const secret = process.env.DOC_SIGN_SECRET;
  if (!secret || secret.length < 24) return new Response(JSON.stringify({ error: 'Signature non configurée.' }), { status: 503, headers });
  try {
    const brut = await req.text(); if (brut.length > 2000) throw Object.assign(new Error('Requête trop grande.'), { status: 413 });
    const doc = nettoyer(JSON.parse(brut));
    const s = await signer(doc, secret);
    const q = new URLSearchParams({ t: doc.type, n: doc.number, m: String(doc.total), d: doc.date, s });
    return new Response(JSON.stringify({ ok: true, url: `${origin}/verifier.html?${q}` }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.status ? e.message : 'Requête invalide.' }), { status: e.status || 400, headers });
  }
}
