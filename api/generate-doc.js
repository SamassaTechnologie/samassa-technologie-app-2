// api/generate-doc.js
// Proxy IA : supporte Google Gemini (gratuit) ET Anthropic Claude

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Tu es expert en rédaction de documents administratifs officiels au Mali, spécialement pour la ville de Kayes. Tu travailles pour SAMASSA TECHNOLOGIE.

RÈGLES STRICTES :
1. Rédige DIRECTEMENT le document sans introduction ni commentaire extérieur
2. Utilise les formules protocolaires maliennes appropriées
3. Inclus toujours : Lieu (Kayes), date en toutes lettres, formule de politesse finale
4. En-tête pour documents officiels : "République du Mali — Un Peuple — Un But — Une Foi"
5. Pour les renseignements manquants, utilise [À COMPLÉTER]
6. Le document doit être immédiatement utilisable après impression
7. Sois complet et professionnel`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  try {
    const { prompt, context, apiKey } = await req.json();

    // Déterminer le type de clé
    const key       = apiKey || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || '';
    const isGemini  = key && !key.startsWith('sk-ant-') && !key.startsWith('sk-');
    const isAnthropic = key && (key.startsWith('sk-ant-') || key.startsWith('sk-'));

    if (!key) {
      return new Response(JSON.stringify({
        error: 'Clé API manquante',
        message: 'Configurez GEMINI_API_KEY ou ANTHROPIC_API_KEY dans Vercel Environment Variables'
      }), { status: 500, headers: CORS });
    }

    let fullPrompt = prompt;
    if (context) fullPrompt += `\nContexte : ${context}`;
    fullPrompt += `\nVille : Kayes, Mali. Date : ${new Date().toLocaleDateString('fr-FR', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}`;

    // ── Gemini (gratuit) ──
    if (isGemini) {
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.5, topP: 0.9 }
          })
        }
      );
      const gemData = await gemRes.json();
      const text = gemData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return new Response(JSON.stringify({
          success: true, text,
          model: 'gemini-1.5-flash',
          tokens: { total: gemData?.usageMetadata?.totalTokenCount || 0 }
        }), { headers: CORS });
      }
      return new Response(JSON.stringify({ error: 'Réponse Gemini vide', raw: gemData }), { status: 500, headers: CORS });
    }

    // ── Anthropic Claude ──
    if (isAnthropic) {
      const antRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: fullPrompt }]
        })
      });
      const antData = await antRes.json();
      if (antData?.content?.[0]?.text) {
        return new Response(JSON.stringify({
          success: true,
          text: antData.content[0].text,
          model: 'claude-sonnet-4-6',
          tokens: antData.usage
        }), { headers: CORS });
      }
      return new Response(JSON.stringify({ error: 'Réponse Anthropic vide', raw: antData }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ error: 'Format de clé API non reconnu' }), { status: 400, headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
