// Proxy serveur vers le cloud SAMASSA. Les secrets restent dans Vercel Environment Variables.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const origin = process.env.ALLOWED_ORIGIN || 'https://samassa-technologie-app-2.vercel.app';
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers });

  const apiUrl = process.env.CLOUD_API_URL;
  const apiKey = process.env.CLOUD_API_KEY;
  if (!apiUrl || !apiKey) return new Response(JSON.stringify({ error: 'Service cloud non configuré.' }), { status: 503, headers });

  try {
    const body = await req.json();
    const doc = body?.document;
    if (!doc || typeof doc !== 'object' || !doc.documentNumber || !doc.documentType || !doc.clientName) {
      return new Response(JSON.stringify({ error: 'Données document invalides.' }), { status: 400, headers });
    }
    const response = await fetch(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ json: { apiKey, document: doc } })
    });
    const text = await response.text();
    return new Response(text, { status: response.status, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Erreur du service cloud.' }), { status: 502, headers });
  }
}
