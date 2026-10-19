/* SAMASSA TECHNOLOGIE — CloudConvert PDF vers Office
 * POST /api/cloudconvert
 * La clé CloudConvert reste exclusivement dans Vercel.
 */
'use strict';

import { requireUser, errorResponse, json, getBearer } from '../lib/iloveapi-service.js';

export const config = { runtime: 'edge' };
const API = 'https://sync.api.cloudconvert.com/v2';
const ORIGIN = 'https://samassa-technologie-app-2.vercel.app';
const CORS = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  Vary: 'Origin'
};
const OUTPUTS = new Set(['docx', 'xlsx', 'pptx']);
const MAX_BYTES = 25 * 1024 * 1024;

function respond(data, status = 200, headers = {}) {
  return json(data, status, { ...CORS, ...headers });
}

async function readCloud(response, stage) {
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const message = body?.message || body?.errors?.[0]?.message || `Erreur CloudConvert à l’étape ${stage}.`;
    throw Object.assign(new Error(message), { status: response.status === 429 ? 429 : 502, code: `CLOUDCONVERT_${stage.toUpperCase()}_ERROR` });
  }
  return body;
}

function base64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function safeName(name) {
  return String(name || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'document.pdf';
}

function outputName(input, format) {
  const base = safeName(input).replace(/\.pdf$/i, '') || 'document';
  return `${base}.${format}`;
}

async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return respond({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Méthode non autorisée.' } }, 405);
  await requireUser(req);
  const key = process.env.CLOUDCONVERT_API_KEY || '';
  if (!key) throw Object.assign(new Error('CLOUDCONVERT_API_KEY n’est pas configurée dans Vercel.'), { status: 503, code: 'CLOUDCONVERT_NOT_CONFIGURED' });

  const form = await req.formData();
  const file = form.get('file');
  const output = String(form.get('output') || '').toLowerCase();
  if (!file || typeof file.arrayBuffer !== 'function') throw Object.assign(new Error('Sélectionnez un fichier PDF.'), { status: 400, code: 'FILE_REQUIRED' });
  if (file.size > MAX_BYTES) throw Object.assign(new Error('Le fichier dépasse la limite de 25 Mo.'), { status: 413, code: 'FILE_TOO_LARGE' });
  if (!OUTPUTS.has(output)) throw Object.assign(new Error('Format Office non autorisé.'), { status: 400, code: 'OUTPUT_NOT_ALLOWED' });
  if (!/\.pdf$/i.test(file.name || '')) throw Object.assign(new Error('Cette conversion nécessite un fichier PDF.'), { status: 400, code: 'PDF_REQUIRED' });

  const encoded = base64(new Uint8Array(await file.arrayBuffer()));
  const filename = safeName(file.name);
  const job = {
    tasks: {
      'import-file': { operation: 'import/base64', file: encoded, filename },
      'convert-file': { operation: 'convert', input: 'import-file', input_format: 'pdf', output_format: output },
      'export-file': { operation: 'export/url', input: 'convert-file', inline: false }
    },
    tag: `samassa-pdf-office-${output}`
  };
  const response = await fetch(`${API}/jobs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(job)
  });
  const created = await readCloud(response, 'job');
  const tasks = created?.data?.tasks || [];
  const exported = tasks.find((task) => task.name === 'export-file');
  const resultFile = exported?.result?.files?.[0];
  if (!resultFile?.url) throw Object.assign(new Error('CloudConvert n’a pas fourni le fichier converti.'), { status: 502, code: 'OUTPUT_NOT_READY' });

  const download = await fetch(resultFile.url);
  if (!download.ok) throw Object.assign(new Error('Le fichier converti n’a pas pu être téléchargé.'), { status: 502, code: 'OUTPUT_DOWNLOAD_FAILED' });
  const headers = new Headers(CORS);
  headers.set('Content-Type', download.headers.get('content-type') || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${outputName(filename, output)}"`);
  headers.set('Cache-Control', 'no-store');
  return new Response(await download.arrayBuffer(), { status: 200, headers });
}

export default async function endpoint(req) {
  try { return await handler(req); }
  catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return respond({ success: false, error: { code: error?.code || 'CLOUDCONVERT_ERROR', message: error?.message || 'Erreur de conversion.' } }, status);
  }
}
