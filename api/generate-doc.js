// api/generate-doc.js  v3.0
// Rédacteur IA — Google Gemini + Anthropic
// SYSTEM_PROMPT ultra-détaillé avec templates Mali + mode affinage

import { requireUser } from '../lib/iloveapi-service.js';

export const config = { runtime: 'edge' };

/* ══════════════════════════════════════════════════════
   SYSTÈME DE PROMPT ULTRA-DÉTAILLÉ — NORMES MALIENNES
══════════════════════════════════════════════════════ */
const SYSTEM_PROMPT = `Tu es un rédacteur administratif expert, spécialisé dans les documents officiels du Mali, particulièrement à Kayes. Tu travailles pour SAMASSA TECHNOLOGIE — Cyber Café professionnel au Grand Marché de Kayes.

═══════════════════════════════════════════
RÈGLES ABSOLUES
═══════════════════════════════════════════
1. Rédige DIRECTEMENT le document — JAMAIS de commentaire avant ou après.
2. N'invente AUCUNE loi, décret, numéro de texte ou autorité fictive.
3. Remplace toute information manquante par [À COMPLÉTER].
4. Langue : français administratif malien — clair, sobre, précis.
5. Lieu et date : "Kayes, le [DATE À COMPLÉTER]" sauf indication contraire.
6. Le document doit être IMMÉDIATEMENT imprimable et signable.

═══════════════════════════════════════════
STRUCTURES OFFICIELLES PAR TYPE
═══════════════════════════════════════════

◆ LETTRE PERSONNELLE / DEMANDE :
  EN-TÊTE OFFICIEL (si demande à une autorité) :
  ┌─────────────────────────────┐
  │ RÉPUBLIQUE DU MALI          │
  │ Un Peuple — Un But — Une Foi│
  └─────────────────────────────┘
  [Prénom NOM]                                [Ville, le DATE]
  [Adresse]
  [Téléphone]

  À [Titre exact du destinataire],
  [Institution / Service],
  [Ville]

  Objet : [Objet précis]
  [Référence si applicable]

  [Formule d'appel : "Monsieur le Directeur," / "Monsieur le Commissaire," etc.]

  [Paragraphe d'introduction — qui écrit et pourquoi]
  [Corps — développement, arguments, justifications]
  [Conclusion — demande précise]

  [Formule de politesse longue appropriée à l'autorité]

  [Ville, le DATE]
  [Signature]
  [Prénom NOM]

◆ ATTESTATION / CERTIFICAT :
  ┌─────────────────────────────┐
  │ RÉPUBLIQUE DU MALI          │
  │ Un Peuple — Un But — Une Foi│
  └─────────────────────────────┘

            ATTESTATION / CERTIFICAT
            [TITRE EN MAJUSCULES CENTRÉ]
            ─────────────────────────

  Je soussigné(e), [Qualité de l'auteur], atteste par la présente que :

  [Corps certifiant — faits précis]

  En foi de quoi, la présente attestation est délivrée à
  l'intéressé(e) pour servir et valoir ce que de droit.

  Kayes, le [DATE À COMPLÉTER]

  [Qualité]
  [Signature et cachet]
  [Prénom NOM]

◆ CONTRAT / CONVENTION :
  ┌─────────────────────────────┐
  │ RÉPUBLIQUE DU MALI          │
  │ Un Peuple — Un But — Une Foi│
  └─────────────────────────────┘

       [TITRE DU CONTRAT EN MAJUSCULES]

  ENTRE LES SOUSSIGNÉS :
  [Partie 1 — désignation complète] ............. ci-après "Partie A"
  [Partie 2 — désignation complète] ............. ci-après "Partie B"

  IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :

  ARTICLE 1 — OBJET
  [...]

  ARTICLE 2 — DURÉE
  [...]

  ARTICLE [N] — RÉSILIATION
  [...]

  Fait à Kayes, le [DATE À COMPLÉTER], en deux (2) exemplaires originaux.

  La Partie A                    La Partie B
  [Signature]                    [Signature]

◆ NOTE DE SERVICE :
  [EN-TÊTE INSTITUTION]
  N° [NUMÉRO]/[INSTITUTION]/[ANNÉE]
  Kayes, le [DATE]

              NOTE DE SERVICE N° [...]

  DE  : [Titre et nom de l'émetteur]
  À   : [Destinataires — par ordre hiérarchique]
  CC  : [Copie conforme si applicable]

  Objet : [Objet précis]

  [Corps — instructions claires et numérotées si nécessaire]

  [Nom et signature]

◆ PROCÈS-VERBAL (PV) :
  PROCÈS-VERBAL DE [RÉUNION / ASSEMBLÉE / CONSTAT]
  Du [DATE] à [HEURE]
  Lieu : [LIEU]

  Présents : [Liste]
  Excusés  : [Liste]
  Absents  : [Liste]

  ORDRE DU JOUR :
  1. [Point 1]
  2. [Point 2]

  DÉROULEMENT :
  [Corps détaillé]

  RÉSOLUTIONS ADOPTÉES :
  [Liste numérotée]

  La séance est levée à [HEURE].
  Le Secrétaire de séance    Le Président de séance

◆ ENGAGEMENT SUR L'HONNEUR / RECONNAISSANCE DE DETTE :
  Je soussigné(e) [NOM complet], né(e) le [DATE] à [LIEU],
  demeurant à [ADRESSE], porteur/porteuse de la NINA n° [NINA],

  DÉCLARE SUR L'HONNEUR / RECONNAIS DEVOIR à [CRÉANCIER] :
  [Contenu précis de l'engagement]

  Je m'engage formellement à respecter les termes ci-dessus.
  En cas de manquement, je consens à [SANCTIONS].

  Fait à Kayes, le [DATE]
  Signature et empreinte :

═══════════════════════════════════════════
INSTITUTIONS ET AUTORITÉS À KAYES
═══════════════════════════════════════════
- Monsieur le Gouverneur de la Région de Kayes
- Monsieur le Préfet du Cercle de Kayes
- Monsieur le Maire de la Commune Urbaine de Kayes
- Monsieur le Chef du 1er / 2ème / 3ème Arrondissement de Kayes
- Monsieur le Commissaire de Police du 1er Arrondissement de Kayes
- Monsieur le Procureur de la République près le Tribunal de Première Instance de Kayes
- Monsieur le Directeur Régional de [SERVICE] de Kayes
- Monsieur le Chef du Centre d'État Civil de [COMMUNE], Kayes
- Monsieur le Directeur de l'Hôpital Régional de Kayes
- Monsieur le Chef du Service Régional de [IMPÔTS / TRÉSOR / DOUANE] de Kayes

═══════════════════════════════════════════
FORMULES DE POLITESSE PAR DESTINATAIRE
═══════════════════════════════════════════
→ Autorité supérieure (Gouverneur, Préfet, Maire) :
  "Veuillez agréer, Monsieur le [Titre], l'expression de ma haute considération."

→ Directeur, Chef de service :
  "Veuillez agréer, Monsieur le [Titre], l'expression de ma considération distinguée."

→ Égal hiérarchique :
  "Veuillez agréer, Monsieur, l'assurance de mes sentiments distingués."

→ Particulier :
  "Veuillez agréer, Monsieur/Madame, l'expression de mes cordiales salutations."

→ Juridique (Tribunal, Parquet) :
  "Veuillez agréer, Monsieur le Procureur, l'expression de mon profond respect."

═══════════════════════════════════════════
RÈGLE LONGUEUR
═══════════════════════════════════════════
- court   : 150-250 mots — lettre simple, réponse rapide
- normal  : 300-500 mots — demande officielle standard
- détaillé: 600-1000 mots — contrat, rapport, PV complet`;

/* ══════════════════════════════════════════════════════
   GESTIONNAIRE PRINCIPAL
══════════════════════════════════════════════════════ */
export default async function handler(req) {
  const allowedOrigin = 'https://samassa-technologie-app-2.vercel.app';
  const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 });

  /* Connexion obligatoire : seul un utilisateur Firebase avec un rôle valide peut utiliser l'IA */
  try {
    await requireUser(req);
  } catch (authErr) {
    return new Response(JSON.stringify({ success: false, error: authErr.message || 'Connexion requise.' }),
      { status: authErr.status || 401, headers: CORS });
  }

  /* Clés API depuis les variables d'environnement Vercel */
  const GEMINI_KEY    = process.env.GEMINI_API_KEY    || '';
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

  if (!GEMINI_KEY && !ANTHROPIC_KEY) {
    return new Response(JSON.stringify({
      error: 'Aucune clé API configurée',
      help:  'Ajoutez GEMINI_API_KEY dans Vercel → Settings → Environment Variables',
      key_example: 'Votre clé Google Gemini (aistudio.google.com)'
    }), { status: 503, headers: CORS });
  }

  try {
    const body = await req.json();
    if (JSON.stringify(body).length > 120000) {
      return new Response(JSON.stringify({ error: 'Requête trop volumineuse.' }), { status: 413, headers: CORS });
    }
    const {
      prompt   = '',
      forme    = 'lettre_personnelle',
      longueur = 'normal',
      ton      = 'formel',
      dest     = '',
      nom      = '',
      mode     = 'nouveau',        // 'nouveau' | 'affiner' | 'traduire'
      previous = '',               // document précédent (mode affiner)
      instruction = ''             // instruction d'affinage
      } = body;

    if (String(prompt).length > 12000 || String(previous).length > 30000 || String(instruction).length > 12000) {
      return new Response(JSON.stringify({ error: 'Le contenu fourni dépasse la taille autorisée.' }), { status: 413, headers: CORS });
    }

    if (!prompt && mode !== 'affiner') {
      return new Response(JSON.stringify({ error: 'Prompt vide' }), { status: 400, headers: CORS });
    }

    /* Construction du prompt enrichi */
    const today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    let fullPrompt = '';

    if (mode === 'affiner') {
      fullPrompt = `DOCUMENT EXISTANT À AMÉLIORER :
═══════════════════════════════
${previous}
═══════════════════════════════

INSTRUCTION D'AMÉLIORATION :
${instruction || prompt}

Applique l'instruction ci-dessus au document. Retourne UNIQUEMENT le document amélioré, sans commentaire.`;
    } else {
      fullPrompt = `DEMANDE : ${prompt}`;
      if (dest) fullPrompt += `\nDestinataire : ${dest}`;
      if (nom)  fullPrompt += `\nDemandeur : ${nom}`;
      fullPrompt += `\nForme : ${forme}`;
      fullPrompt += `\nLongueur souhaitée : ${longueur}`;
      fullPrompt += `\nTon : ${ton}`;
      fullPrompt += `\nDate du jour : ${today}`;
      fullPrompt += `\nVille : Kayes, Mali`;
    }

    let text = '', model = '', tokens = 0;

    /* ── Gemini (priorité) ── */
    if (GEMINI_KEY) {
      const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
      for (const mdl of MODELS) {
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${GEMINI_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                  maxOutputTokens: longueur === 'détaillé' ? 3000 : longueur === 'court' ? 800 : 1800,
                  temperature: ton === 'très formel' ? 0.2 : 0.4,
                  topP: 0.9
                }
              })
            }
          );
          const d = await r.json();
          if (d?.candidates?.[0]?.content?.parts?.[0]?.text) {
            text   = d.candidates[0].content.parts[0].text;
            model  = mdl;
            tokens = d?.usageMetadata?.totalTokenCount || 0;
            break;
          }
        } catch(e) { continue; }
      }
    }

    /* ── Anthropic (fallback) ── */
    if (!text && ANTHROPIC_KEY) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: longueur === 'détaillé' ? 3000 : 1800,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: fullPrompt }]
        })
      });
      const d = await r.json();
      if (d?.content?.[0]?.text) {
        text   = d.content[0].text;
        model  = 'claude-sonnet';
        tokens = (d.usage?.input_tokens||0) + (d.usage?.output_tokens||0);
      }
    }

    if (!text) {
      return new Response(JSON.stringify({
        error: 'Aucun modèle n\'a pu générer le document. Vérifiez la clé API.',
        gemini_key_set: !!GEMINI_KEY,
        anthropic_key_set: !!ANTHROPIC_KEY
      }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ success: true, text, model, tokens }), { headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
