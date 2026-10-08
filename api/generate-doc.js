// API serveur — les clés IA doivent être configurées dans les variables d'environnement Vercel.
export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Tu es expert en rédaction de documents administratifs officiels au Mali, spécialement pour Kayes. Tu travailles pour SAMASSA TECHNOLOGIE.
Rédige directement le document, utilise les formules protocolaires maliennes, inclus Kayes, la date en toutes lettres et une formule de politesse finale. Pour les renseignements manquants, utilise [À COMPLÉTER]. Le document doit être immédiatement utilisable après impression.`;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://samassa-technologie-app-2.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers });

  try {
    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const context = typeof body.context === 'string' ? body.context.trim() : '';
    if (!prompt || prompt.length > 4000) {
      return new Response(JSON.stringify({ error: 'La demande est obligatoire et limitée à 4000 caractères.' }), { status: 400, headers });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const fullPrompt = `${prompt}${context ? `\nContexte : ${context}` : ''}\nVille : Kayes, Mali. Date : ${new Date().toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}`;

    if (geminiKey) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_instruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.5 } })
      });
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return new Response(JSON.stringify({ success: true, text, model: 'gemini-2.0-flash', tokens: { total: data?.usageMetadata?.totalTokenCount || 0 } }), { headers });
      return new Response(JSON.stringify({ error: data?.error?.message || 'Réponse Gemini vide' }), { status: 502, headers });
    }

    if (anthropicKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2048, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: fullPrompt }] })
      });
      const data = await response.json();
      const text = data?.content?.[0]?.text;
      if (text) return new Response(JSON.stringify({ success: true, text, model: 'claude-sonnet-4-6', tokens: data.usage }), { headers });
      return new Response(JSON.stringify({ error: data?.error?.message || 'Réponse Anthropic vide' }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ error: 'Aucun fournisseur IA configuré sur le serveur.' }), { status: 503, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erreur interne du service IA.' }), { status: 500, headers });
  }
}
