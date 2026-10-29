// Signature HMAC des documents (reçus, factures) : aucune base de données, le secret reste côté serveur.
const enc = new TextEncoder();
const TYPES = new Set(['Reçu', 'Reçu cyber', 'Reçu vente', 'Facture', 'Facture cyber', 'Facture matériel', 'Devis', 'Bon de réparation']);

export function nettoyer(p) {
  const type = String(p.t ?? p.type ?? '').trim();
  const number = String(p.n ?? p.number ?? '').trim().slice(0, 40);
  const total = Math.round(Number(p.m ?? p.total));
  const date = String(p.d ?? p.date ?? '').trim();
  if (!TYPES.has(type)) throw Object.assign(new Error('Type de document inconnu.'), { status: 400 });
  if (!/^[A-Za-z0-9._\-\/ ]{1,40}$/.test(number)) throw Object.assign(new Error('Numéro invalide.'), { status: 400 });
  if (!Number.isFinite(total) || total < 0 || total > 1e10) throw Object.assign(new Error('Montant invalide.'), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error('Date invalide.'), { status: 400 });
  return { type, number, total, date };
}

export async function signer(doc, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`v1|${doc.type}|${doc.number}|${doc.total}|${doc.date}`));
  return Array.from(new Uint8Array(mac)).slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function egal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
