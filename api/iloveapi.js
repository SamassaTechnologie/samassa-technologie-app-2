/* SAMASSA TECHNOLOGIE — iLoveAPI proxy
 * POST /api/iloveapi?action=start|upload|process
 * GET  /api/iloveapi?action=download&server=...&task=...
 */
'use strict';

import {
  requireUser, getToken, validateTool, validateRegion, validateServer, validateTask,
  validateFile, MAX_FILES, errorResponse, json, parseJson, upstream
} from '../lib/iloveapi-service.js';

export const config = { runtime: 'edge' };

const API_BASE = 'https://api.ilovepdf.com/v1';
const ALLOWED_ORIGIN = 'https://samassa-technologie-app-2.vercel.app';
const COMMON_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Vary': 'Origin'
};

function ok(data, status = 200) { return json(data, status, COMMON_HEADERS); }
function requestUrl(req) { return new URL(req.url, 'https://samassa-technologie-app-2.vercel.app'); }
function fail(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const details = {};
  if (error?.code) details.code = error.code;
  if (error?.upstreamStatus) details.upstream_status = error.upstreamStatus;
  return json({ success: false, error: { code: details.code || 'ILOVEAPI_ERROR', message: error?.message || 'Erreur iLoveAPI.', ...details } }, status, COMMON_HEADERS);
}

function serverUrl(server) { return `https://${validateServer(server)}/v1`; }
function jsonHeaders(token) { return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }

async function start(req) {
  const body = await parseJson(req);
  const tool = validateTool(String(body.tool || '').trim());
  const region = validateRegion(String(body.region || 'eu').trim());
  const token = await getToken();
  const r = await fetch(`${API_BASE}/start/${encodeURIComponent(tool)}/${encodeURIComponent(region)}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await upstream(r, 'start');
  return ok({ success: true, tool, region, server: data.server, task: data.task, remaining_credits: data.remaining_credits ?? null });
}

async function upload(req) {
  const form = await req.formData();
  const task = validateTask(String(form.get('task') || ''));
  const server = String(form.get('server') || '');
  const file = validateFile(form.get('file'));
  const formData = new FormData();
  formData.append('task', task);
  formData.append('file', file, file.name || 'upload.bin');
  for (const name of ['chunk', 'chunks']) {
    const value = form.get(name);
    if (value !== null && value !== '') formData.append(name, String(value));
  }
  const token = await getToken();
  const r = await fetch(`${serverUrl(server)}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
  const data = await upstream(r, 'upload');
  return ok({ success: true, task, server, file: data });
}

function safeFiles(files) {
  if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) throw Object.assign(new Error(`Entre 1 et ${MAX_FILES} fichiers sont requis.`), { status: 400, code: 'FILES_INVALID' });
  return files.map((file) => {
    if (!file || typeof file.server_filename !== 'string' || typeof file.filename !== 'string') throw Object.assign(new Error('Référence de fichier iLoveAPI invalide.'), { status: 400, code: 'FILE_REFERENCE_INVALID' });
    const clean = { server_filename: file.server_filename.slice(0, 200), filename: file.filename.slice(0, 255) };
    if (file.rotate !== undefined) {
      const rotate = Number(file.rotate); if (![0, 90, 180, 270].includes(rotate)) throw Object.assign(new Error('Rotation invalide.'), { status: 400, code: 'ROTATE_INVALID' }); clean.rotate = rotate;
    }
    if (file.password) clean.password = String(file.password).slice(0, 200);
    if (file.meta && typeof file.meta === 'object') clean.meta = Object.fromEntries(Object.entries(file.meta).slice(0, 10).map(([k, v]) => [String(k).slice(0, 50), String(v).slice(0, 500)]));
    return clean;
  });
}

async function processTask(req) {
  const body = await parseJson(req);
  const task = validateTask(String(body.task || ''));
  const server = String(body.server || '');
  const tool = validateTool(String(body.tool || '').trim());
  const payload = { task, tool, files: safeFiles(body.files) };
  for (const key of ['ignore_password', 'ignore_errors', 'try_pdf_repair']) if (typeof body[key] === 'boolean') payload[key] = body[key];
  for (const key of ['output_filename', 'packaged_filename', 'ranges', 'pages']) if (body[key] !== undefined) payload[key] = String(body[key]).slice(0, 300);
  const token = await getToken();
  const r = await fetch(`${serverUrl(server)}/process`, { method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(payload) });
  const data = await upstream(r, 'process');
  return ok({ success: true, task, server, result: data });
}

async function download(req) {
  const url = requestUrl(req);
  const task = validateTask(url.searchParams.get('task') || '');
  const server = url.searchParams.get('server') || '';
  const token = await getToken();
  const r = await fetch(`${serverUrl(server)}/download/${encodeURIComponent(task)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) await upstream(r, 'download');
  const headers = new Headers(COMMON_HEADERS);
  headers.set('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
  headers.set('Content-Disposition', r.headers.get('content-disposition') || `attachment; filename="samassa-iloveapi-${task}.bin"`);
  headers.set('Cache-Control', 'no-store');
  return new Response(await r.arrayBuffer(), { status: 200, headers });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: COMMON_HEADERS });
  try {
    const url = requestUrl(req);
    const action = url.searchParams.get('action') || (req.method === 'GET' ? 'download' : 'start');
    if (action === 'health' && req.method === 'GET') return ok({ success: true, service: 'iloveapi', configured: Boolean(process.env.ILOVEAPI_PUBLIC_KEY), timestamp: new Date().toISOString() });
    await requireUser(req);
    if (action === 'start' && req.method === 'POST') return await start(req);
    if (action === 'upload' && req.method === 'POST') return await upload(req);
    if (action === 'process' && req.method === 'POST') return await processTask(req);
    if (action === 'download' && req.method === 'GET') return await download(req);
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Action ou méthode non autorisée.');
  } catch (error) { return fail(error); }
}
