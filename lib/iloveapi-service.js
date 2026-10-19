/* SAMASSA TECHNOLOGIE — iLoveAPI server service
 * Credentials stay server-side. The browser only receives short-lived task data.
 */
'use strict';

const ILOVE_BASE = 'https://api.ilovepdf.com/v1';
const ALLOWED_REGIONS = new Set(['eu', 'us', 'fr', 'de', 'pl', 'in', 'sg']);
const PDF_TOOLS = new Set(['compress','extract','htmlpdf','imagepdf','merge','officepdf','pagenumber','pdfa','pdfjpg','pdfocr','protect','repair','rotate','split','unlock','validatepdfa','editpdf','watermark','summarize','pdfextract','pdfmarkdown','splitsmart']);
const IMAGE_TOOLS = new Set(['compressimage','cropimage','convertimage','removebackgroundimage','repairimage','resizeimage','rotateimage','upscaleimage','watermarkimage']);
const ALL_TOOLS = new Set([...PDF_TOOLS, ...IMAGE_TOOLS]);
const ROLES = new Set(['administrateur','caissier','technicien','responsable_stock']);
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 10;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
  });
}

function errorResponse(status, code, message, details = {}) {
  return json({ success: false, error: { code, message, ...details } }, status);
}

function getBearer(req) {
  const value = req.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function parseJson(req) {
  try { return await req.json(); } catch { throw Object.assign(new Error('JSON invalide.'), { status: 400, code: 'INVALID_JSON' }); }
}

async function upstream(response, stage) {
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const apiMessage = body?.message || body?.error || body?.type || `Erreur iLoveAPI à l’étape ${stage}.`;
    const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : response.status === 401 ? 502 : 400;
    throw Object.assign(new Error(apiMessage), { status, code: `ILOVE_${stage.toUpperCase()}_ERROR`, upstreamStatus: response.status, upstream: body || text.slice(0, 500) });
  }
  return body;
}

async function getIdTokenUser(token) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY || '';
  if (!apiKey) throw Object.assign(new Error('FIREBASE_WEB_API_KEY non configurée.'), { status: 503, code: 'FIREBASE_NOT_CONFIGURED' });
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token })
  });
  if (!r.ok) throw Object.assign(new Error('Session Firebase invalide ou expirée.'), { status: 401, code: 'AUTH_INVALID' });
  const data = await r.json();
  const user = data.users?.[0];
  if (!user || user.disabled) throw Object.assign(new Error('Compte désactivé ou introuvable.'), { status: 403, code: 'AUTH_DISABLED' });
  return user;
}

async function getRole(token, uid) {
  const db = (process.env.FIREBASE_DATABASE_URL || 'https://samassa-kayes-79fbb-default-rtdb.europe-west1.firebasedatabase.app').replace(/\/$/, '');
  const store = process.env.FIREBASE_STORE_ID || 'kayes-principal';
  const r = await fetch(`${db}/${encodeURIComponent(store)}/user_roles/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`);
  if (!r.ok) throw Object.assign(new Error('Impossible de vérifier le rôle Firebase.'), { status: 502, code: 'ROLE_LOOKUP_FAILED' });
  const role = await r.json();
  if (!role?.role || role.disabled || !ROLES.has(role.role)) throw Object.assign(new Error('Aucun rôle applicatif valide n’est associé à ce compte.'), { status: 403, code: 'ROLE_REQUIRED' });
  return role.role;
}

export async function requireUser(req) {
  const token = getBearer(req);
  if (!token) throw Object.assign(new Error('Connexion requise.'), { status: 401, code: 'AUTH_REQUIRED' });
  const user = await getIdTokenUser(token);
  const role = await getRole(token, user.localId);
  return { token, uid: user.localId, email: user.email || '', role };
}

export async function iloveRequest(path, options = {}, stage = 'api') {
  const headers = { Authorization: `Bearer ${await getToken()}`, ...(options.headers || {}) };
  const response = await fetch(`${ILOVE_BASE}${path}`, { ...options, headers });
  return upstream(response, stage);
}

let tokenCache = { value: '', expiresAt: 0 };
export async function getToken() {
  const publicKey = process.env.ILOVEAPI_PUBLIC_KEY || '';
  if (!publicKey) throw Object.assign(new Error('ILOVEAPI_PUBLIC_KEY non configurée dans Vercel.'), { status: 503, code: 'ILOVEAPI_NOT_CONFIGURED' });
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 30000) return tokenCache.value;
  const r = await fetch(`${ILOVE_BASE}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_key: publicKey }) });
  const data = await upstream(r, 'auth');
  if (!data?.token) throw Object.assign(new Error('iLoveAPI n’a pas retourné de jeton.'), { status: 502, code: 'ILOVE_AUTH_ERROR' });
  tokenCache = { value: data.token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return data.token;
}

export function validateTool(tool) {
  if (!ALL_TOOLS.has(tool)) throw Object.assign(new Error(`Outil iLoveAPI non autorisé : ${tool || 'vide'}.`), { status: 400, code: 'TOOL_NOT_ALLOWED' });
  return tool;
}

export function validateRegion(region = 'eu') {
  if (!ALLOWED_REGIONS.has(region)) throw Object.assign(new Error('Région iLoveAPI non autorisée.'), { status: 400, code: 'REGION_NOT_ALLOWED' });
  return region;
}

export function validateServer(server) {
  if (!server || !/^[a-z0-9.-]+\.ilovepdf\.com$/i.test(server)) throw Object.assign(new Error('Serveur iLoveAPI invalide.'), { status: 400, code: 'SERVER_NOT_ALLOWED' });
  return server;
}

export function validateTask(task) {
  if (!task || !/^[A-Za-z0-9_-]{8,100}$/.test(task)) throw Object.assign(new Error('Identifiant de tâche invalide.'), { status: 400, code: 'TASK_INVALID' });
  return task;
}

export function validateFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw Object.assign(new Error('Fichier manquant.'), { status: 400, code: 'FILE_REQUIRED' });
  if (!file.size || file.size > MAX_FILE_BYTES) throw Object.assign(new Error('Fichier vide ou supérieur à 25 Mo.'), { status: 413, code: 'FILE_TOO_LARGE' });
  return file;
}

export { IMAGE_TOOLS, PDF_TOOLS, ALL_TOOLS, MAX_FILE_BYTES, MAX_FILES, errorResponse, json, parseJson, upstream, getBearer };
