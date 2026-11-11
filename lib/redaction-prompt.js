// Construction du message envoyé au modèle pour le Rédacteur IA (fonction pure, testée).
// completer = 'exemple' : le document est rédigé en entier même avec peu d'informations ;
// les valeurs inventées sont placées entre [[doubles crochets]] pour être surlignées et vérifiées.

export const CONSIGNE_EXEMPLE = `MODE « EXEMPLE COMPLET » — cette consigne REMPLACE les règles 3 et 5 :
- Rédige un document COMPLET, entièrement rédigé et prêt à relire, même si la demande donne très peu d'informations. Ne pose aucune question.
- Utilise TOUTES les informations fournies par l'utilisateur, exactement telles qu'il les a données (noms, dates, montants, lieux, motifs). Ne les modifie pas et ne les mets JAMAIS entre crochets.
- Pour chaque information NON fournie mais nécessaire (nom, adresse, fonction, date, durée, motif détaillé, description…), écris une valeur d'exemple réaliste pour le Mali et place-la entre doubles crochets, ainsi : [[Moussa DIARRA]], [[Quartier Légal Ségou, Kayes]], [[10 jours]].
- EXCEPTIONS, à laisser en [À COMPLÉTER] si non fournies : numéros officiels (NINA, pièce d'identité, passeport, NIF, RCCM, compte bancaire, immatriculation), numéros de téléphone, montants d'argent, et toute référence à une loi ou un décret.
- Date du document : utilise la date du jour indiquée, sans crochets.
- Texte brut uniquement : pas de markdown (ni ** ni #), pas de cadre dessiné, pas de tirets de séparation.`;

export function construirePrompt(body, today) {
  const { prompt = '', forme = 'lettre_personnelle', longueur = 'normal', ton = 'formel', dest = '', nom = '', mode = 'nouveau', previous = '', instruction = '', completer = '' } = body || {};
  const exemple = completer === 'exemple';
  if (mode === 'affiner') {
    return `DOCUMENT EXISTANT À AMÉLIORER :
═══════════════════════════════
${previous}
═══════════════════════════════

INSTRUCTION D'AMÉLIORATION :
${instruction || prompt}

Applique l'instruction ci-dessus au document. Retourne UNIQUEMENT le document amélioré, sans commentaire.${exemple ? `
Les passages entre [[doubles crochets]] sont des valeurs d'exemple : garde ces crochets autour de celles qui restent, retire-les autour de toute valeur que l'instruction fournit, et mets entre [[ ]] toute nouvelle valeur que tu inventes. Texte brut, sans markdown ni cadre.` : ''}`;
  }
  let p = `DEMANDE : ${prompt}`;
  if (dest) p += `\nDestinataire : ${dest}`;
  if (nom) p += `\nDemandeur : ${nom}`;
  p += `\nForme : ${forme}`;
  p += `\nLongueur souhaitée : ${longueur}`;
  p += `\nTon : ${ton}`;
  p += `\nDate du jour : ${today}`;
  p += `\nVille : Kayes, Mali`;
  if (exemple) p += `\n\n${CONSIGNE_EXEMPLE}`;
  return p;
}
