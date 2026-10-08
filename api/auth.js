// Authentification partagée entre appareils.
// Variables Vercel requises : SAMASSA_LOGIN_PASSWORD et SAMASSA_AUTH_SECRET.
export const config = { runtime: 'edge' };

const encoder = new TextEncoder();
const origin = () => process.env.ALLOWED_ORIGIN || 'https://samassa-technologie-app-2.vercel.app';
const headers = () => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': origin(),
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
});

async function digest(value) {
  const data = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(data), b => b.toString(16).padStart(2, '0')).join('');
}
async function sign(value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(process.env.SAMASSA_AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function tokenValid(token) {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    const expected = await sign(payload);
    if (expected.length !== signature.length) return false;
    let diff = 0; for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return diff === 0 && data.exp > Date.now();
  } catch { return false; }
}
function cookieValue(req) {
  const raw = req.headers.get('cookie') || '';
  return raw.split(';').map(v => v.trim()).find(v => v.startsWith('samassa_session='))?.slice('samassa_session='.length) || '';
}

export default async function handler(req) {
  const h = headers();
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (!process.env.SAMASSA_LOGIN_PASSWORD || !process.env.SAMASSA_AUTH_SECRET) {
    return new Response(JSON.stringify({ error: 'Authentification serveur non configurée.' }), { status: 503, headers: h });
  }

  if (req.method === 'GET') {
    const valid = await tokenValid(cookieValue(req));
    return new Response(JSON.stringify({ authenticated: valid }), { status: valid ? 200 : 401, headers: h });
  }
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers: h });

  try {
    const body = await req.json();
    const action = body.action || 'login';
    if (action === 'logout') {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...h, 'Set-Cookie': 'samassa_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax' } });
    }
    const password = typeof body.password === 'string' ? body.password : '';
    const valid = (await digest(password)) === (await digest(process.env.SAMASSA_LOGIN_PASSWORD));
    if (!valid) return new Response(JSON.stringify({ error: 'Mot de passe incorrect.' }), { status: 401, headers: h });
    const payload = btoa(JSON.stringify({ sub: 'admin', exp: Date.now() + 8 * 60 * 60 * 1000 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = payload + '.' + await sign(payload);
    return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers: { ...h, 'Set-Cookie': `samassa_session=${token}; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Lax` } });
  } catch {
    return new Response(JSON.stringify({ error: 'Requête invalide.' }), { status: 400, headers: h });
  }
}
