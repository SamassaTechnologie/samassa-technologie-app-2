// api/generate-doc.js
// Proxy sécurisé vers l'API Anthropic Claude
// La clé API est stockée dans les variables d'environnement Vercel

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Tu es expert en rédaction de documents administratifs officiels au Mali, spécialement pour la ville de Kayes. Tu travailles pour SAMASSA TECHNOLOGIE, un cyber café professionnel au Grand Marché de Kayes.

RÈGLES STRICTES DE RÉDACTION :
1. Rédige DIRECTEMENT le document sans introduction ni commentaire extérieur
2. Pour les lettres/demandes : commence par le destinataire, puis objet, puis corps, puis formule de politesse
3. Pour les attestations/certificats : titre centré en MAJUSCULES, corps certifiant, signatures
4. Pour les contrats : articles numérotés, clauses claires
5. Utilise TOUJOURS les formules protocolaires maliennes appropriées
6. Inclus toujours : Lieu (Kayes), date en toutes lettres, formule de politesse finale adaptée
7. En-tête pour documents officiels : "République du Mali — Un Peuple — Un But — Une Foi"
8. Pour les renseignements manquants, utilise [À COMPLÉTER] ou [XXXX]
9. Le document doit être immédiatement utilisable après impression
10. Adapte le niveau de formalisme au type de document
11. Utilise le français administratif malien (formel et respectueux)
12. Sois complet : un document incomplet est inutile

DESTINATAIRES COURANTS À KAYES :
- Monsieur le Maire de la Commune de Kayes
- Monsieur le Préfet du Cercle de Kayes
- Monsieur le Chef du 1er/2ème/3ème Arrondissement
- Monsieur le Commissaire de Police de Kayes
- Monsieur le Procureur de la République, Tribunal de Première Instance de Kayes
- Monsieur le Directeur Régional de [Service] de Kayes
- Monsieur le Chef du Centre d'État Civil de Kayes
- Monsieur le Directeur de l'École/Lycée [Nom]`;

export default async function handler(req) {
  // CORS preflight
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'Clé API non configurée',
      message: 'Ajoutez ANTHROPIC_API_KEY dans les variables d\'environnement Vercel'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { prompt, context } = await req.json();

    const userMessage = context
      ? `Contexte fourni : ${context}\n\nDemande : ${prompt}`
      : prompt;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const data = await response.json();

    if (data.content && data.content[0]) {
      return new Response(JSON.stringify({
        success: true,
        text: data.content[0].text,
        tokens: data.usage
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({ error: 'Réponse vide de l\'IA', raw: data }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
