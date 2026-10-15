/* ==================================================================
   RÉDACTEUR IA – MALI  |  app.js
   100 % local : aucun serveur, aucune API, aucune clé.
   Principe : modèle + formulaire -> "document intermédiaire" (blocs)
   -> aperçu HTML / impression  ET  fichier Word (.docx) modifiable.
   ================================================================== */
'use strict';

/* ---------- 0. OUTILS ---------- */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmt = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');   // 1 500 000
const dateFr = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'}); };
const LS = { // stockage local du navigateur (sécurisé par try/catch)
  get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};

/* ---------- 1. PARAMÈTRES DU CYBER (modifiables dans ⚙) ---------- */
const PARAM_DEFAUT = {
  nom: 'SAMASSA TECHNOLOGIE', slogan: "Tout pour l'Informatique",
  tel: '00223 77291931', email: 'boussesamassa10@gmail.com',
  adresse: 'Grand Marché de Kayes, près du 1er arrondissement de la police, Rue Soundiata KEITA',
  ville: 'Kayes', nif: '', rccm: ''
};
let P = Object.assign({}, PARAM_DEFAUT, LS.get('param', {}));
// Options d'impression : en-tête (infos du cyber), logo, pied de page (adresse) — mémorisées
const OPT = Object.assign({entete: true, logo: true, pied: true}, LS.get('opt', {}));

/* ---------- 2. NOMBRE EN LETTRES (pour factures, reçus, contrats) ---------- */
function enLettres(n){
  n = Math.floor(Number(n) || 0); if (n === 0) return 'zéro';
  const u = ['','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
  const d = ['','','vingt','trente','quarante','cinquante','soixante'];
  const m100 = x => {
    if (x < 20) return u[x];
    const t = Math.floor(x / 10), r = x % 10;
    if (t === 7 || t === 9) { const rest = x - (t === 7 ? 60 : 80); return (t === 7 ? 'soixante' : 'quatre-vingt') + (t === 7 && rest === 11 ? ' et ' : '-') + u[rest]; }
    if (t === 8) return r === 0 ? 'quatre-vingts' : 'quatre-vingt-' + u[r];
    return d[t] + (r === 0 ? '' : r === 1 ? ' et un' : '-' + u[r]);
  };
  const m1000 = x => { const c = Math.floor(x / 100), r = x % 100; let s = '';
    if (c) s = c === 1 ? 'cent' : u[c] + ' cent' + (r === 0 ? 's' : '');
    if (r) s += (s ? ' ' : '') + m100(r); return s; };
  const mil = Math.floor(n / 1e9), mi = Math.floor(n % 1e9 / 1e6), k = Math.floor(n % 1e6 / 1e3), r = n % 1e3, out = [];
  if (mil) out.push(m1000(mil) + ' milliard' + (mil > 1 ? 's' : ''));
  if (mi)  out.push(m1000(mi) + ' million' + (mi > 1 ? 's' : ''));
  if (k)   out.push(k === 1 ? 'mille' : m1000(k).replace(/cents$/, 'cent').replace(/vingts$/, 'vingt') + ' mille');
  if (r)   out.push(m1000(r));
  return out.join(' ');
}

/* ==================================================================
   3. BIBLIOTHÈQUE DE 50 MODÈLES (format JSON simplifié)
   Champs : "CLE:Libellé:type:défaut" séparés par |
   types : t=texte  a=zone de texte  d=date  n=nombre  m=montant F CFA  s=liste (défaut = options a,b,c)
   Dans le texte : [CLE] est remplacé par la valeur (en gras). [CLE_L] = montant en lettres.
   "## " = titre en gras, "- " = puce. "@nom" = valeur prise dans les paramètres du cyber.
   ================================================================== */
const parse = s => !s ? [] : s.split('|').map(x => { const [k, l, t, ...v] = x.split(':'); return {k, l, t: t || 't', v: v.join(':')}; });
const FIN = "Dans l'attente d'une suite favorable, je vous prie d'agréer, [APPEL], l'expression de ma haute considération.";
const FIN_NOUS = "Veuillez agréer, [APPEL], l'expression de nos salutations distinguées.";
// L = lettre administrative, D = document (attestation, contrat...), autres = spéciaux (cv, facture)
const L = (cat, titre, objet, champs, corps, dest = '', fin = '', cyber = false) => ({cat, titre, type:'l', objet, champs: parse(champs), corps, dest, fin, cyber});
const D = (cat, titre, champs, corps, o = {}) => Object.assign({cat, titre, type:'d', champs: parse(champs), corps}, o);

const MODELES = [
/* ---------------- EMPLOI (10) ---------------- */
L('Emploi', "Demande d'emploi", "Demande d'emploi",
  "POSTE:Poste sollicité|ENTREPRISE:Entreprise visée|DIPLOME:Diplôme / formation|EXP:Expérience (ex. 3 ans)|PJ:Pièces jointes:a:CV\nCopie des diplômes\nCopie de la pièce d'identité",
  "J'ai l'honneur de venir, par la présente, solliciter un emploi de [POSTE] au sein de [ENTREPRISE].\nTitulaire de [DIPLOME] et justifiant de [EXP] d'expérience, je suis rigoureux(se), motivé(e) et disposé(e) à m'investir pleinement dans les missions qui me seront confiées.\nEn espérant que ma demande retiendra votre bienveillante attention, je reste à votre disposition pour tout entretien.",
  "Monsieur le Directeur"),
{cat:'Emploi', titre:'CV', type:'c', champs: parse("NOM:Nom et prénom|TEL:Téléphone|EMAIL:Email|ADRESSE:Adresse|NAISS:Date et lieu de naissance|NATION:Nationalité:t:Malienne|SITUATION:Situation familiale|PROFIL:Profil / objectif:a|FORMATION:Formations (une par ligne):a|EXPERIENCE:Expériences professionnelles (une par ligne):a|COMPETENCES:Compétences (une par ligne):a|LANGUES:Langues (ex. Français, Bambara, Anglais)|LOISIRS:Centres d'intérêt")},
L('Emploi', "Lettre de motivation", "Candidature au poste de ...",
  "POSTE:Poste visé|ENTREPRISE:Entreprise|DIPLOME:Diplôme / formation|ATOUTS:Vos atouts et qualités:a",
  "Informé(e) de l'ouverture d'un poste de [POSTE] au sein de [ENTREPRISE], je vous adresse ma candidature avec un vif intérêt.\nTitulaire de [DIPLOME], je dispose des atouts suivants : [ATOUTS].\nMotivé(e) et conscient(e) des exigences du poste, je suis convaincu(e) de pouvoir contribuer efficacement à la réussite de votre structure. Je me tiens à votre disposition pour un entretien afin de vous exposer plus en détail ma motivation.",
  "Monsieur le Directeur des Ressources Humaines"),
L('Emploi', "Demande de stage", "Demande de stage",
  "ECOLE:Établissement|FILIERE:Filière|NIVEAU:Niveau d'études|DUREE:Durée (ex. 3 mois)|PERIODE:Période souhaitée|ENTREPRISE:Structure d'accueil",
  "Étudiant(e) en [NIVEAU] [FILIERE] à [ECOLE], j'ai l'honneur de solliciter auprès de [ENTREPRISE] un stage de [DUREE] pour la période [PERIODE].\nCe stage me permettrait de mettre en pratique les connaissances acquises durant ma formation et de découvrir le monde professionnel.\nJe m'engage à respecter le règlement intérieur de votre structure et à faire preuve de sérieux et d'assiduité.",
  "Monsieur le Directeur"),
L('Emploi', "Candidature spontanée", "Candidature spontanée",
  "POSTE:Poste / domaine visé|ENTREPRISE:Entreprise|DIPLOME:Diplôme / formation|EXP:Expérience",
  "Sans qu'une offre ait été publiée, je me permets de vous adresser ma candidature pour un poste de [POSTE] au sein de [ENTREPRISE].\nTitulaire de [DIPLOME] avec [EXP] d'expérience, je souhaite mettre mes compétences au service de votre structure.\nJe joins à la présente mon curriculum vitae et reste disponible pour un entretien.",
  "Monsieur le Directeur"),
L('Emploi', "Lettre de démission", "Démission",
  "POSTE:Poste occupé|ENTREPRISE:Entreprise|DATE_FIN:Date de fin de contrat:d|PREAVIS:Préavis (ex. 1 mois)",
  "Par la présente, j'ai l'honneur de vous présenter ma démission du poste de [POSTE] que j'occupe au sein de [ENTREPRISE].\nConformément aux dispositions du Code du travail, je respecterai un préavis de [PREAVIS] et mon départ prendra effet le [DATE_FIN].\nJe vous remercie de la confiance que vous m'avez accordée durant toute cette période.",
  "Monsieur le Directeur", "Veuillez agréer, [APPEL], l'expression de mes salutations distinguées."),
L('Emploi', "Demande d'attestation de travail", "Demande d'attestation de travail",
  "POSTE:Poste occupé|DEPUIS:Date d'embauche:d|ENTREPRISE:Entreprise",
  "Employé(e) à [ENTREPRISE] en qualité de [POSTE] depuis le [DEPUIS], j'ai l'honneur de solliciter la délivrance d'une attestation de travail.\nCe document me sera nécessaire pour la constitution d'un dossier administratif.",
  "Monsieur le Directeur"),
D('Emploi', "Certificat de travail", "EMPLOYEUR:Entreprise / employeur:t:@nom|SALARIE:Nom du salarié|POSTE:Poste occupé|DU:Date d'entrée:d|AU:Date de sortie:d",
  "Je soussigné(e), [SIGNATAIRE], représentant [EMPLOYEUR], certifie que Monsieur/Madame [SALARIE] a travaillé au sein de notre structure en qualité de [POSTE] du [DU] au [AU].\nIl/Elle nous quitte libre de tout engagement.\nEn foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit."),
L('Emploi', "Demande d'augmentation / d'avancement", "Demande de révision de ma situation salariale",
  "POSTE:Poste occupé|ANCIENNETE:Ancienneté (ex. 4 ans)|MOTIF:Motifs de la demande:a",
  "Occupant le poste de [POSTE] depuis [ANCIENNETE], j'ai l'honneur de solliciter une révision de ma situation salariale / un avancement.\nCette demande se justifie par les motifs suivants : [MOTIF].\nJe reste disponible pour tout échange sur ma demande.",
  "Monsieur le Directeur"),
L('Emploi', "Demande de mutation", "Demande de mutation",
  "POSTE:Poste occupé|SERVICE_ACTUEL:Service / ville actuel(le)|SERVICE_SOUHAITE:Service / ville souhaité(e)|MOTIF:Motifs:a",
  "Actuellement [POSTE] à [SERVICE_ACTUEL], j'ai l'honneur de solliciter ma mutation à [SERVICE_SOUHAITE].\nCette demande est motivée par : [MOTIF].\nJe suis disposé(e) à rejoindre mon nouveau poste dès que votre décision me sera notifiée.",
  "Monsieur le Directeur"),

/* ---------------- ADMINISTRATION (14) ---------------- */
L('Administration', "Demande de NIF", "Demande d'attribution d'un NIF",
  "NAISS:Date et lieu de naissance|ACTIVITE:Activité exercée|ENTREPRISE:Nom commercial / raison sociale|ADRESSE_ACT:Adresse de l'activité|PJ:Pièces jointes:a:Copie de la pièce d'identité\nCertificat de résidence",
  "Né(e) le [NAISS], j'exerce l'activité de [ACTIVITE] sous l'enseigne [ENTREPRISE], à [ADRESSE_ACT].\nAfin de régulariser ma situation fiscale, j'ai l'honneur de solliciter l'attribution d'un Numéro d'Identification Fiscale (NIF).",
  "Monsieur le Directeur Général des Impôts"),
L('Administration', "Demande de RCCM", "Demande d'immatriculation au RCCM",
  "NAISS:Date et lieu de naissance|ACTIVITE:Activité commerciale|ENTREPRISE:Nom commercial|ADRESSE_ACT:Adresse du siège|PJ:Pièces jointes:a:Copie de la pièce d'identité\nCasier judiciaire\nNIF",
  "Né(e) le [NAISS], je souhaite exercer l'activité de [ACTIVITE] sous le nom commercial [ENTREPRISE], dont le siège est situé à [ADRESSE_ACT].\nJ'ai l'honneur de solliciter mon immatriculation au Registre du Commerce et du Crédit Mobilier (RCCM).",
  "Monsieur le Greffier en Chef du Tribunal de Commerce"),
L('Administration', "Certificat de résidence (demande)", "Demande de certificat de résidence",
  "NAISS:Date et lieu de naissance|QUARTIER:Quartier / adresse de résidence|DEPUIS:Résident depuis (ex. 2018)|MOTIF:Motif de la demande",
  "Né(e) le [NAISS], je réside à [QUARTIER] depuis [DEPUIS].\nJ'ai l'honneur de solliciter la délivrance d'un certificat de résidence, nécessaire pour [MOTIF].",
  "Monsieur le Maire de la Commune"),
D('Administration', "Procuration", "MANDANT:Nom du mandant (celui qui donne le pouvoir)|NAISS_M:Né(e) le / à|ADRESSE_M:Adresse du mandant|MANDATAIRE:Nom du mandataire|ID_MAND:Pièce d'identité du mandataire (n°)|POUVOIRS:Pouvoirs donnés:a",
  "Je soussigné(e) [MANDANT], né(e) le [NAISS_M], demeurant à [ADRESSE_M], donne par la présente procuration à Monsieur/Madame [MANDATAIRE], titulaire de la pièce d'identité n° [ID_MAND], pour me représenter et accomplir en mon nom les actes suivants :\n[POUVOIRS]\nLe mandataire est autorisé à signer tout document nécessaire à l'exécution de ce mandat.\nLa présente procuration est établie pour servir et valoir ce que de droit.",
  {sigs:[['Le mandant','MANDANT'],['Le mandataire','MANDATAIRE']]}),
D('Administration', "Attestation", "BENEFICIAIRE:Personne concernée|OBJ_ATT:Objet de l'attestation:a",
  "Je soussigné(e), [SIGNATAIRE], atteste par la présente que [BENEFICIAIRE] [OBJ_ATT].\nEn foi de quoi, la présente attestation est établie pour servir et valoir ce que de droit."),
L('Administration', "Recours gracieux", "Recours gracieux",
  "DECISION:Décision contestée:a|DATE_DEC:Date de la décision:d|ARGUMENTS:Vos arguments:a",
  "J'ai l'honneur de former un recours gracieux contre la décision suivante, notifiée le [DATE_DEC] : [DECISION].\nJe conteste cette décision pour les motifs suivants : [ARGUMENTS].\nJe sollicite en conséquence le réexamen de mon dossier ainsi que le retrait ou la révision de la décision contestée.",
  "Monsieur le Directeur"),
L('Administration', "Demande de congé", "Demande de congé",
  "TYPE:Type de congé:s:annuel,de maladie,de maternité,exceptionnel|POSTE:Poste occupé|DU:Du:d|AU:Au:d|NBJ:Nombre de jours|REMPLACANT:Remplaçant (facultatif)",
  "Occupant le poste de [POSTE], j'ai l'honneur de solliciter un congé [TYPE] de [NBJ] jours, du [DU] au [AU].\nPendant mon absence, mes tâches seront assurées par [REMPLACANT].\nJe vous remercie de bien vouloir m'accorder cette autorisation.",
  "Monsieur le Directeur"),
L('Administration', "Demande d'acte de naissance", "Demande d'acte de naissance",
  "TYPE:Document demandé:s:un extrait d'acte de naissance,une copie intégrale d'acte de naissance|PERSONNE:Nom de la personne concernée|NAISS:Date de naissance|LIEU_NAISS:Lieu de naissance|PERE:Nom du père|MERE:Nom de la mère",
  "J'ai l'honneur de solliciter la délivrance de [TYPE] au nom de [PERSONNE], né(e) le [NAISS] à [LIEU_NAISS], fils/fille de [PERE] et de [MERE].\nCe document m'est nécessaire pour la constitution d'un dossier administratif.",
  "Monsieur l'Officier d'État Civil"),
L('Administration', "Demande de casier judiciaire", "Demande de bulletin n°3 du casier judiciaire",
  "NAISS:Date et lieu de naissance|PERE:Nom du père|MERE:Nom de la mère|MOTIF:Motif de la demande",
  "Né(e) le [NAISS], fils/fille de [PERE] et de [MERE], j'ai l'honneur de solliciter la délivrance d'un extrait de casier judiciaire (bulletin n°3).\nCe document est nécessaire pour [MOTIF].",
  "Monsieur le Greffier en Chef du Tribunal"),
L('Administration', "Demande de certificat de nationalité", "Demande de certificat de nationalité malienne",
  "NAISS:Date et lieu de naissance|PERE:Nom du père|MERE:Nom de la mère|MOTIF:Motif de la demande",
  "Né(e) le [NAISS], fils/fille de [PERE] et de [MERE], j'ai l'honneur de solliciter la délivrance d'un certificat de nationalité malienne.\nCe document est nécessaire pour [MOTIF].",
  "Monsieur le Président du Tribunal de Grande Instance"),
L('Administration', "Demande d'autorisation d'exercer", "Demande d'autorisation d'exercer une activité",
  "ACTIVITE:Activité envisagée|ENTREPRISE:Nom de l'établissement|LIEU_ACT:Lieu d'exercice",
  "J'ai l'honneur de solliciter l'autorisation d'exercer l'activité de [ACTIVITE] sous l'enseigne [ENTREPRISE], à [LIEU_ACT].\nJe m'engage à respecter la réglementation en vigueur et à me conformer à toutes les obligations légales et fiscales.",
  "Monsieur le Maire"),
L('Administration', "Réclamation", "Réclamation",
  "OBJ_REC:Sujet de la réclamation:a|DEMANDE:Ce que vous demandez:a",
  "J'ai l'honneur de porter à votre connaissance la réclamation suivante : [OBJ_REC].\nEn conséquence, je sollicite : [DEMANDE].\nJe vous remercie de bien vouloir examiner ma requête dans les meilleurs délais.",
  "Monsieur le Directeur"),
D('Administration', "Contrat de bail", "BAILLEUR:Nom du bailleur (propriétaire)|LOCATAIRE:Nom du locataire|ADRESSE_BIEN:Adresse du bien loué|USAGE:Usage (habitation, commerce...)|LOYER:Loyer mensuel (F CFA):m|CAUTION:Caution (F CFA):m|DEBUT:Début du bail:d|DUREE:Durée (ex. 1 an)",
  "Entre [BAILLEUR], ci-après le bailleur, et [LOCATAIRE], ci-après le locataire, il a été convenu ce qui suit :\n## Article 1 : Objet\nLe bailleur donne en location au locataire le bien situé à [ADRESSE_BIEN], à usage de [USAGE].\n## Article 2 : Durée\nLe bail est conclu pour une durée de [DUREE] à compter du [DEBUT].\n## Article 3 : Loyer\nLe loyer mensuel est fixé à [LOYER] F CFA ([LOYER_L] francs CFA), payable au plus tard le 5 de chaque mois.\n## Article 4 : Caution\nLe locataire verse une caution de [CAUTION] F CFA ([CAUTION_L] francs CFA), restituable en fin de bail après état des lieux.\n## Article 5 : Obligations\nLe locataire s'engage à user paisiblement du bien, à l'entretenir et à ne pas le sous-louer sans l'accord écrit du bailleur.\n## Article 6 : Résiliation\nChaque partie peut résilier le bail moyennant un préavis de trois mois notifié par écrit.",
  {sigs:[['Le bailleur','BAILLEUR'],['Le locataire','LOCATAIRE']]}),
D('Administration', "Attestation d'hébergement", "HEBERGEUR:Nom de l'hébergeant|HEBERGE:Nom de la personne hébergée|ADRESSE_HEB:Adresse du logement|DEPUIS:Hébergé depuis:d",
  "Je soussigné(e) [HEBERGEUR], atteste sur l'honneur héberger à mon domicile, situé à [ADRESSE_HEB], Monsieur/Madame [HEBERGE], depuis le [DEPUIS].\nLa présente attestation est établie pour servir et valoir ce que de droit.",
  {sigs:[['L\'hébergeant','HEBERGEUR']]}),

/* ---------------- ENTREPRISE CYBER (14) ---------------- */
{cat:'Entreprise Cyber', titre:'Facture normalisée Mali', type:'f', lib:'FACTURE', art:'la présente facture', champs:[]},
{cat:'Entreprise Cyber', titre:'Devis', type:'f', lib:'DEVIS', art:'le présent devis', champs:[]},
D('Entreprise Cyber', "Reçu", "NUMERO:N° du reçu|CLIENT:Reçu de (nom du client)|MONTANT:Montant (F CFA):m|MOTIF:Motif du paiement:a|MODE:Mode de paiement:s:Espèces,Orange Money,Moov Money,Virement",
  "Reçu de Monsieur/Madame [CLIENT], la somme de [MONTANT_L] francs CFA ([MONTANT] F CFA), en règlement de : [MOTIF].\nMode de paiement : [MODE].\nLe présent reçu lui est délivré pour servir et valoir ce que de droit.",
  {tdoc:"REÇU N° [NUMERO]", sigs:[['Le client','CLIENT'],['Le cyber','CYBER']]}),
D('Entreprise Cyber', "Contrat de travail", "EMPLOYEUR:Employeur:t:@nom|EMPLOYE:Nom de l'employé(e)|POSTE:Poste|DEBUT:Date de début:d|DUREE:Durée (ex. CDD de 6 mois)|LIEU_TRAVAIL:Lieu de travail:t:@ville|SALAIRE:Salaire mensuel (F CFA):m",
  "Entre [EMPLOYEUR], ci-après l'employeur, et [EMPLOYE], ci-après l'employé(e), il est convenu ce qui suit :\n## Article 1 : Engagement\nL'employé(e) est engagé(e) en qualité de [POSTE], à compter du [DEBUT], pour une durée de [DUREE], à [LIEU_TRAVAIL].\n## Article 2 : Rémunération\nLa rémunération mensuelle est fixée à [SALAIRE] F CFA ([SALAIRE_L] francs CFA).\n## Article 3 : Durée du travail\nLa durée du travail est celle fixée par la législation en vigueur au Mali.\n## Article 4 : Obligations\nL'employé(e) s'engage à exécuter ses tâches avec diligence, à respecter la confidentialité et le règlement intérieur.\n## Article 5 : Rupture\nChaque partie peut mettre fin au contrat dans le respect du préavis prévu par le Code du travail.",
  {sigs:[["L'employeur",'EMPLOYEUR'],["L'employé(e)",'EMPLOYE']]}),
D('Entreprise Cyber', "Attestation de service fait", "CLIENT:Nom du client|PRESTATION:Prestations exécutées:a|MONTANT:Montant (F CFA):m|DATE_EX:Date d'exécution:d",
  "Je soussigné(e), [SIGNATAIRE], atteste que [CYBER] a exécuté, pour le compte de [CLIENT], les prestations suivantes, le [DATE_EX] :\n[PRESTATION]\nMontant : [MONTANT] F CFA ([MONTANT_L] francs CFA).\nLe service est déclaré fait. La présente attestation est établie pour servir et valoir ce que de droit."),
D('Entreprise Cyber', "PV de réception", "CLIENT:Client|OBJ_PV:Objet réceptionné (matériel, travaux...):a|DATE_REC:Date de réception:d|ETAT:État:s:conforme,conforme avec réserves,non conforme|OBSERVATIONS:Observations:a",
  "Le [DATE_REC], il a été procédé à la réception de : [OBJ_PV], fourni(e) par [CYBER] à [CLIENT].\nAprès vérification, la livraison est déclarée [ETAT].\nObservations : [OBSERVATIONS].\nLe présent procès-verbal est dressé en deux exemplaires pour servir et valoir ce que de droit.",
  {tdoc:"PROCÈS-VERBAL DE RÉCEPTION", sigs:[['Pour le client','CLIENT'],['Pour le cyber','CYBER']]}),
L('Entreprise Cyber', "Lettre de relance", "Relance de paiement",
  "FACTURE_N:N° de la facture|DATE_FACT:Date de la facture:d|MONTANT:Montant dû (F CFA):m|ECHEANCE:Payer avant le:d",
  "Sauf erreur ou omission de notre part, la facture n° [FACTURE_N] du [DATE_FACT], d'un montant de [MONTANT] F CFA ([MONTANT_L] francs CFA), demeure impayée à ce jour.\nNous vous prions de bien vouloir procéder à son règlement avant le [ECHEANCE].\nSi votre paiement est intervenu entre-temps, nous vous prions de ne pas tenir compte de la présente.",
  "Monsieur le Directeur", FIN_NOUS, true),
L('Entreprise Cyber', "Mise en demeure", "Mise en demeure de payer",
  "FACTURE_N:N° de la facture|DATE_FACT:Date de la facture:d|MONTANT:Montant dû (F CFA):m|DELAI:Délai accordé (ex. 8 jours)",
  "Malgré notre précédente relance restée sans suite, la facture n° [FACTURE_N] du [DATE_FACT], d'un montant de [MONTANT] F CFA ([MONTANT_L] francs CFA), n'a toujours pas été réglée.\nPar la présente, nous vous mettons en demeure de payer cette somme dans un délai de [DELAI] à compter de la réception de ce courrier.\nÀ défaut, nous nous verrons contraints d'engager toute procédure légale utile pour le recouvrement de notre créance, sans autre avis.",
  "Monsieur le Directeur", FIN_NOUS, true),
D('Entreprise Cyber', "Convention", "PARTIE1:Première partie:t:@nom|PARTIE2:Deuxième partie|OBJ_CONV:Objet de la convention:a|DUREE:Durée|CONDITIONS:Conditions particulières:a",
  "Entre [PARTIE1] et [PARTIE2], il a été convenu ce qui suit :\n## Article 1 : Objet\n[OBJ_CONV]\n## Article 2 : Durée\nLa présente convention est conclue pour une durée de [DUREE].\n## Article 3 : Conditions\n[CONDITIONS]\n## Article 4 : Litiges\nTout litige sera réglé à l'amiable ; à défaut, il sera soumis aux juridictions maliennes compétentes.",
  {sigs:[['Première partie','PARTIE1'],['Deuxième partie','PARTIE2']]}),
{cat:'Entreprise Cyber', titre:'Bon de commande', type:'f', lib:'BON DE COMMANDE', art:'le présent bon de commande', champs:[]},
{cat:'Entreprise Cyber', titre:'Bon de livraison', type:'f', lib:'BON DE LIVRAISON', art:'le présent bon de livraison', noprix:true, champs:[]},
D('Entreprise Cyber', "Décharge", "OBJET_DEC:Objet / somme remis(e):a|DATE_REMISE:Date de remise:d",
  "Je soussigné(e) [SIGNATAIRE], reconnais avoir reçu de [CYBER], le [DATE_REMISE] : [OBJET_DEC].\nJe donne par la présente décharge pleine et entière pour cette remise.\nLa présente décharge est établie pour servir et valoir ce que de droit."),
D('Entreprise Cyber', "Reconnaissance de dette", "DEBITEUR:Nom du débiteur|CREANCIER:Nom du créancier:t:@nom|MONTANT:Montant (F CFA):m|ECHEANCE:Date de remboursement:d",
  "Je soussigné(e) [DEBITEUR], reconnais devoir à [CREANCIER] la somme de [MONTANT] F CFA ([MONTANT_L] francs CFA).\nJe m'engage à la rembourser au plus tard le [ECHEANCE].\nEn cas de non-paiement à l'échéance, le créancier pourra engager toute action légale pour recouvrer sa créance.\nLa présente reconnaissance de dette est établie pour servir et valoir ce que de droit.",
  {sigs:[['Le débiteur','DEBITEUR']]}),
D('Entreprise Cyber', "Contrat de prestation de services", "PRESTATAIRE:Prestataire:t:@nom|CLIENT:Client|PRESTATION:Prestation à réaliser:a|PRIX:Prix (F CFA):m|DELAI:Délai d'exécution|PAIEMENT:Paiement:s:à la commande,à la livraison,50 % à la commande et 50 % à la livraison",
  "Entre [PRESTATAIRE], ci-après le prestataire, et [CLIENT], ci-après le client, il est convenu ce qui suit :\n## Article 1 : Objet\nLe prestataire s'engage à réaliser la prestation suivante : [PRESTATION].\n## Article 2 : Délai\nLa prestation sera exécutée dans un délai de [DELAI].\n## Article 3 : Prix\nLe prix est fixé à [PRIX] F CFA ([PRIX_L] francs CFA), payable [PAIEMENT].\n## Article 4 : Responsabilité\nLe prestataire s'engage à exécuter sa mission avec soin ; le client s'engage à fournir les éléments nécessaires.\n## Article 5 : Litiges\nTout litige sera réglé à l'amiable ; à défaut, par les juridictions maliennes compétentes.",
  {sigs:[['Le prestataire','PRESTATAIRE'],['Le client','CLIENT']]}),

/* ---------------- SCOLAIRE (6) ---------------- */
L('Scolaire', "Demande d'inscription", "Demande d'inscription",
  "NAISS:Date et lieu de naissance|CLASSE:Classe / filière demandée|ANNEE:Année scolaire (ex. 2026-2027)|ETAB_PREC:Établissement précédent",
  "Né(e) le [NAISS] et ancien(ne) élève de [ETAB_PREC], j'ai l'honneur de solliciter mon inscription en [CLASSE] pour l'année scolaire [ANNEE].\nJe m'engage à respecter le règlement intérieur de votre établissement.",
  "Monsieur le Directeur de l'établissement"),
L('Scolaire', "Demande de bourse", "Demande de bourse d'études",
  "NIVEAU:Niveau d'études|ETAB:Établissement|MOTIF:Motifs de la demande:a",
  "Étudiant(e) en [NIVEAU] à [ETAB], j'ai l'honneur de solliciter l'octroi d'une bourse d'études.\nMa demande est motivée par : [MOTIF].\nJe joins à la présente les pièces justificatives nécessaires.",
  "Monsieur le Directeur National des Bourses"),
L('Scolaire', "Demande de transfert", "Demande de transfert",
  "ELEVE:Nom de l'élève|CLASSE:Classe|ETAB_ACTUEL:Établissement actuel|ETAB_SOUHAITE:Établissement souhaité|MOTIF:Motifs:a",
  "J'ai l'honneur de solliciter le transfert de l'élève [ELEVE], actuellement en classe de [CLASSE] à [ETAB_ACTUEL], vers [ETAB_SOUHAITE].\nCette demande est motivée par : [MOTIF].",
  "Monsieur le Directeur"),
L('Scolaire', "Justification d'absence", "Justification d'absence",
  "ELEVE:Nom de l'élève|CLASSE:Classe|DU:Absent du:d|AU:Au:d|MOTIF:Motif de l'absence:a",
  "Je vous prie de bien vouloir excuser l'absence de [ELEVE], élève en classe de [CLASSE], du [DU] au [AU].\nCette absence est due à : [MOTIF].\nJe vous remercie de votre compréhension.",
  "Monsieur le Directeur"),
L('Scolaire', "Demande de relevé de notes", "Demande de relevé de notes",
  "FILIERE:Filière / classe|ANNEE:Année concernée|MATRICULE:N° matricule (si connu)",
  "Ancien(ne) étudiant(e) / élève en [FILIERE] (matricule [MATRICULE]), j'ai l'honneur de solliciter la délivrance de mon relevé de notes de l'année [ANNEE].\nCe document m'est nécessaire pour la constitution d'un dossier.",
  "Monsieur le Directeur"),
L('Scolaire', "Demande de duplicata de diplôme", "Demande de duplicata de diplôme",
  "DIPLOME:Diplôme concerné|ANNEE:Année d'obtention|MATRICULE:N° matricule (si connu)|MOTIF:Motif (perte, vol...)",
  "Titulaire du [DIPLOME] obtenu en [ANNEE] (matricule [MATRICULE]), j'ai l'honneur de solliciter la délivrance d'un duplicata de mon diplôme, l'original ayant été perdu : [MOTIF].\nJe joins à la présente une déclaration de perte.",
  "Monsieur le Directeur"),

/* ---------------- DIVERS (6) ---------------- */
L('Divers', "Demande d'aide / de subvention", "Demande d'aide financière",
  "PROJET:Votre situation ou projet:a|BESOIN:Aide demandée (montant, nature):a",
  "J'ai l'honneur de solliciter votre soutien pour la situation / le projet suivant : [PROJET].\nL'aide sollicitée est la suivante : [BESOIN].\nJe reste à votre disposition pour tout complément d'information.",
  "Monsieur le Directeur"),
L('Divers', "Lettre de recommandation", "Lettre de recommandation",
  "PERSONNE:Personne recommandée|QUALITE:Relation (ex. ancien employé)|DUREE:Durée de collaboration|QUALITES:Qualités à souligner:a",
  "Je soussigné(e) recommande vivement [PERSONNE], que j'ai connu(e) en tant que [QUALITE] pendant [DUREE].\nDurant cette période, j'ai pu apprécier ses qualités : [QUALITES].\nJe n'hésite donc pas à recommander cette personne pour tout poste ou formation qu'elle souhaiterait intégrer.",
  "Madame, Monsieur"),
L('Divers', "Lettre d'invitation", "Invitation",
  "EVENEMENT:Événement|DATE_EV:Date:d|HEURE:Heure|LIEU_EV:Lieu",
  "J'ai le plaisir de vous inviter à [EVENEMENT], qui se tiendra le [DATE_EV] à [HEURE], à [LIEU_EV].\nVotre présence nous honorerait et contribuerait à la réussite de cette rencontre.",
  "Monsieur le Directeur"),
L('Divers', "Lettre de remerciement", "Remerciements",
  "RAISON:Raison du remerciement:a",
  "Je tiens à vous adresser mes sincères remerciements pour : [RAISON].\nVotre soutien m'a été d'une grande utilité et je vous en suis profondément reconnaissant(e).",
  "Monsieur le Directeur", "Veuillez agréer, [APPEL], l'expression de ma profonde gratitude."),
L('Divers', "Demande de rendez-vous", "Demande de rendez-vous",
  "MOTIF:Motif du rendez-vous:a|DISPO:Vos disponibilités",
  "J'ai l'honneur de solliciter un entretien auprès de vous afin de discuter de : [MOTIF].\nMes disponibilités sont les suivantes : [DISPO].\nJe vous remercie de bien vouloir me faire connaître la date qui vous conviendrait.",
  "Monsieur le Directeur"),
L('Divers', "Plainte", "Dépôt de plainte",
  "FAITS:Exposé des faits:a|DATE_FAITS:Date des faits:d|LIEU_FAITS:Lieu des faits|CONTRE:Contre qui (ou X)|TEMOINS:Témoins (facultatif)",
  "J'ai l'honneur de porter plainte contre [CONTRE] pour des faits survenus le [DATE_FAITS] à [LIEU_FAITS].\nVoici les faits : [FAITS].\nTémoins éventuels : [TEMOINS].\nJe sollicite l'ouverture d'une enquête et me tiens à votre disposition pour toute audition.",
  "Monsieur le Commissaire de Police"),

/* ---------------- VENTE & COMMERCE (8) ---------------- */
D('Vente & Commerce', "Attestation de vente", "VENDEUR:Nom du vendeur|ACHETEUR:Nom de l'acheteur|ARTICLE:Objet vendu (description):a|PRIX:Prix de vente (F CFA):m|DATE_VENTE:Date de la vente:d|MODE:Paiement:s:comptant,par acomptes",
  "Je soussigné(e) [VENDEUR], atteste avoir vendu à Monsieur/Madame [ACHETEUR], le [DATE_VENTE], l'objet suivant : [ARTICLE].\nLa vente est conclue pour un prix de [PRIX] F CFA ([PRIX_L] francs CFA), payé [MODE].\nLe vendeur déclare que l'objet vendu est sa propriété, libre de tout gage ou litige, et en transfère la propriété à l'acheteur à compter de ce jour.\nLa présente attestation est établie pour servir et valoir ce que de droit.",
  {sigs:[['Le vendeur','VENDEUR'],["L'acheteur",'ACHETEUR']]}),
D('Vente & Commerce', "Contrat de vente", "VENDEUR:Nom du vendeur:t:@nom|ACHETEUR:Nom de l'acheteur|ARTICLE:Objet de la vente:a|PRIX:Prix (F CFA):m|DATE_VENTE:Date:d|LIVRAISON:Modalités de livraison",
  "Entre [VENDEUR], ci-après le vendeur, et [ACHETEUR], ci-après l'acheteur, il a été convenu ce qui suit :\n## Article 1 : Objet\nLe vendeur vend à l'acheteur : [ARTICLE].\n## Article 2 : Prix\nLe prix est fixé à [PRIX] F CFA ([PRIX_L] francs CFA).\n## Article 3 : Livraison\n[LIVRAISON].\n## Article 4 : Transfert de propriété\nLa propriété est transférée à l'acheteur après paiement intégral du prix.\n## Article 5 : Litiges\nTout litige sera réglé à l'amiable ; à défaut, par les juridictions maliennes compétentes.",
  {sigs:[['Le vendeur','VENDEUR'],["L'acheteur",'ACHETEUR']]}),
D('Vente & Commerce', "Vente de véhicule / moto", "VENDEUR:Nom du vendeur|ACHETEUR:Nom de l'acheteur|TYPE:Type (moto, voiture...)|MARQUE:Marque et modèle|IMMAT:Immatriculation|CHASSIS:N° de châssis|PRIX:Prix (F CFA):m|DATE_VENTE:Date de la vente:d",
  "Je soussigné(e) [VENDEUR], déclare avoir vendu à Monsieur/Madame [ACHETEUR], le [DATE_VENTE], le véhicule suivant : [TYPE] [MARQUE], immatriculé [IMMAT], châssis n° [CHASSIS].\nLa vente est conclue pour [PRIX] F CFA ([PRIX_L] francs CFA), payés intégralement.\nLe vendeur remet à l'acheteur les clés et les documents du véhicule, qui est vendu dans l'état où il se trouve.\nLa présente attestation est établie pour servir et valoir ce que de droit.",
  {sigs:[['Le vendeur','VENDEUR'],["L'acheteur",'ACHETEUR']]}),
{cat:'Vente & Commerce', titre:'Facture proforma', type:'f', lib:'FACTURE PROFORMA', art:'la présente facture proforma', champs:[]},
D('Vente & Commerce', "Attestation de garantie", "CLIENT:Nom du client|ARTICLE:Article garanti:a|DATE_ACHAT:Date d'achat:d|DUREE:Durée de garantie (ex. 6 mois)",
  "Je soussigné(e), [SIGNATAIRE], atteste que l'article suivant, vendu par [CYBER] à [CLIENT] le [DATE_ACHAT], est garanti pour une durée de [DUREE] : [ARTICLE].\nLa garantie couvre les défauts de fonctionnement. Elle ne couvre pas les dommages liés à une mauvaise utilisation, à la foudre, aux chocs ou à une intervention extérieure."),
L('Vente & Commerce', "Demande de devis", "Demande de devis",
  "OBJ_DEVIS:Produits / services souhaités:a|DELAI:Réponse souhaitée avant le",
  "Nous souhaitons recevoir un devis détaillé pour : [OBJ_DEVIS].\nNous vous prions de nous le faire parvenir avant le [DELAI], en précisant les prix unitaires, les délais de livraison et les conditions de paiement.",
  "Monsieur le Directeur Commercial"),
L('Vente & Commerce', "Lettre de commande", "Commande de marchandises",
  "ARTICLES:Articles et quantités:a|LIVRAISON:Lieu et délai de livraison|PAIEMENT:Mode de paiement",
  "Suite à votre offre, nous vous passons commande de : [ARTICLES].\nLivraison souhaitée : [LIVRAISON]. Paiement : [PAIEMENT].\nNous vous prions de bien vouloir nous confirmer cette commande.",
  "Monsieur le Directeur Commercial", FIN_NOUS, true),
L('Vente & Commerce', "Présentation de services", "Présentation de nos services",
  "SERVICES:Vos services:a:Impression, photocopie, saisie de documents\nVente de matériel informatique\nMaintenance et dépannage",
  "[CYBER] est une structure spécialisée en informatique, située à [CYBER_ADRESSE].\nNous vous proposons les services suivants : [SERVICES].\nNous restons à votre disposition au [CYBER_TEL] pour tout renseignement ou devis gratuit.",
  "Monsieur le Directeur", FIN_NOUS, true),

/* ---------------- IMMOBILIER (4) ---------------- */
D('Immobilier', "Cession de parcelle", "VENDEUR:Nom du vendeur|ACHETEUR:Nom de l'acheteur|PARCELLE:Description (lot, superficie, quartier):a|TITRE:Pièce justificative (titre, permis...)|PRIX:Prix (F CFA):m|DATE_VENTE:Date:d",
  "Je soussigné(e) [VENDEUR], cède à Monsieur/Madame [ACHETEUR], le [DATE_VENTE], la parcelle suivante : [PARCELLE], justifiée par : [TITRE].\nLa cession est conclue pour [PRIX] F CFA ([PRIX_L] francs CFA), payés ce jour.\nLe vendeur garantit être le propriétaire légitime et que la parcelle est libre de tout litige.\nLe présent acte devra être régularisé auprès des services compétents (notaire, domaines).",
  {sigs:[['Le vendeur','VENDEUR'],["L'acquéreur",'ACHETEUR']]}),
D('Immobilier', "Quittance de loyer", "BAILLEUR:Nom du bailleur|LOCATAIRE:Nom du locataire|PERIODE:Période (ex. mois de novembre 2026)|LOYER:Montant reçu (F CFA):m|ADRESSE_BIEN:Adresse du bien",
  "Je soussigné(e) [BAILLEUR], propriétaire du bien situé à [ADRESSE_BIEN], reconnais avoir reçu de Monsieur/Madame [LOCATAIRE] la somme de [LOYER] F CFA ([LOYER_L] francs CFA), au titre du loyer de la période : [PERIODE].\nLa présente quittance est délivrée pour servir et valoir ce que de droit.",
  {tdoc:"QUITTANCE DE LOYER", sigs:[['Le bailleur','BAILLEUR']]}),
L('Immobilier', "Préavis de départ (logement)", "Préavis de départ du logement",
  "ADRESSE_BIEN:Adresse du logement|DATE_DEPART:Date de départ:d|PREAVIS:Préavis (ex. 3 mois)",
  "J'ai l'honneur de vous informer de ma décision de quitter le logement que j'occupe à [ADRESSE_BIEN].\nLe préavis de [PREAVIS] commence à la réception de la présente et mon départ aura lieu le [DATE_DEPART].\nJe vous propose de fixer une date pour l'état des lieux et la restitution de la caution.",
  "Monsieur le Propriétaire"),
L('Immobilier', "Demande de raccordement (eau / électricité)", "Demande de raccordement",
  "TYPE:Type de raccordement:s:à l'eau,à l'électricité|USAGE:Usage:s:domestique,commercial|ADRESSE_BR:Adresse à raccorder",
  "J'ai l'honneur de solliciter un raccordement [TYPE] à usage [USAGE] pour le local situé à [ADRESSE_BR].\nJe m'engage à régler les frais de raccordement et à respecter les conditions d'abonnement.",
  "Monsieur le Directeur de l'agence"),

/* ---------------- EMPLOI (+4) ---------------- */
D('Emploi', "Attestation de stage", "STAGIAIRE:Nom du stagiaire|ECOLE:Établissement|SERVICE:Service / domaine|DU:Début:d|AU:Fin:d|APPRECIATION:Appréciation:a",
  "Je soussigné(e), [SIGNATAIRE], atteste que Monsieur/Madame [STAGIAIRE], étudiant(e) à [ECOLE], a effectué un stage au sein de [CYBER], dans le domaine : [SERVICE], du [DU] au [AU].\nAppréciation : [APPRECIATION].\nLa présente attestation lui est délivrée pour servir et valoir ce que de droit."),
D('Emploi', "Attestation de présence", "PERSONNE:Nom de la personne|EVENEMENT:Événement / formation|DATE_EV:Date:d",
  "Je soussigné(e), [SIGNATAIRE], atteste que Monsieur/Madame [PERSONNE] était présent(e) à : [EVENEMENT], le [DATE_EV].\nLa présente attestation est délivrée pour servir et valoir ce que de droit."),
D('Emploi', "Attestation de prise de service", "AGENT:Nom de l'agent|POSTE:Poste|DATE_PS:Date de prise de service:d|STRUCTURE:Structure:t:@nom",
  "Je soussigné(e), [SIGNATAIRE], atteste que Monsieur/Madame [AGENT] a pris service le [DATE_PS] en qualité de [POSTE] au sein de [STRUCTURE].\nLa présente attestation est établie pour servir et valoir ce que de droit."),
L('Emploi', "Lettre de licenciement", "Notification de licenciement",
  "MOTIF:Motif du licenciement:a|DATE_EFFET:Date d'effet:d|PREAVIS:Préavis (ex. 1 mois)",
  "Nous vous informons de notre décision de mettre fin au contrat de travail qui nous lie, pour le motif suivant : [MOTIF].\nCette décision prend effet le [DATE_EFFET], sous réserve du préavis de [PREAVIS] prévu par le Code du travail.\nVous voudrez bien restituer le matériel et les documents de l'entreprise. Vos droits seront calculés conformément à la loi.",
  "Monsieur/Madame", FIN_NOUS, true),

/* ---------------- ADMINISTRATION (+5) ---------------- */
D('Administration', "Déclaration de perte", "OBJET_PERDU:Objet ou document perdu:a|DATE_PERTE:Date de la perte:d|LIEU_PERTE:Lieu de la perte|ADRESSE_DEC:Votre adresse",
  "Je soussigné(e) [SIGNATAIRE], demeurant à [ADRESSE_DEC], déclare avoir perdu le [DATE_PERTE], à [LIEU_PERTE] : [OBJET_PERDU].\nJe fais la présente déclaration pour servir et valoir ce que de droit."),
D('Administration', "Déclaration sur l'honneur", "NAISS:Date et lieu de naissance|ADRESSE_DEC:Adresse|DECLARATION:Contenu de la déclaration:a",
  "Je soussigné(e) [SIGNATAIRE], né(e) le [NAISS], demeurant à [ADRESSE_DEC], déclare sur l'honneur que : [DECLARATION].\nJe suis conscient(e) que toute fausse déclaration m'expose aux sanctions prévues par la loi."),
D('Administration', "Procès-verbal de réunion", "OBJ_REUNION:Objet de la réunion|DATE_REU:Date:d|LIEU_REUNION:Lieu|PARTICIPANTS:Participants:a|DECISIONS:Décisions prises:a|PRESIDENT:Président de séance|SECRETAIRE:Secrétaire",
  "Le [DATE_REU], à [LIEU_REUNION], une réunion s'est tenue sous la présidence de [PRESIDENT] sur le sujet : [OBJ_REUNION].\nParticipants : [PARTICIPANTS].\nAprès discussion, les décisions suivantes ont été prises : [DECISIONS].\nLa séance est levée et le présent procès-verbal est établi pour servir et valoir ce que de droit.",
  {sigs:[['Le président de séance','PRESIDENT'],['Le secrétaire','SECRETAIRE']]}),
L('Administration', "Demande de passeport / carte d'identité", "Demande de document d'identité",
  "TYPE:Document demandé:s:un passeport,une carte d'identité biométrique|NAISS:Date et lieu de naissance|PERE:Nom du père|MERE:Nom de la mère|MOTIF:Motif (première demande, renouvellement, perte)",
  "Né(e) le [NAISS], fils/fille de [PERE] et de [MERE], j'ai l'honneur de solliciter la délivrance de [TYPE].\nMotif de la demande : [MOTIF].\nJe joins à la présente les pièces exigées par le service.",
  "Monsieur le Directeur du service compétent"),
L('Administration', "Demande de légalisation de documents", "Demande de légalisation",
  "DOCS:Documents à légaliser:a",
  "J'ai l'honneur de solliciter la légalisation des documents suivants : [DOCS].\nJe m'engage à m'acquitter des frais exigés.",
  "Monsieur le Maire"),

/* ---------------- BANQUE & FINANCE (5) ---------------- */
L('Banque & Finance', "Ouverture de compte bancaire", "Demande d'ouverture de compte",
  "TYPE:Type de compte:s:courant,épargne,professionnel|NAISS:Date et lieu de naissance|PROFESSION:Profession|PJ:Pièces jointes:a:Copie de la pièce d'identité\nCertificat de résidence\nPhotos d'identité",
  "Né(e) le [NAISS], exerçant la profession de [PROFESSION], j'ai l'honneur de solliciter l'ouverture d'un compte [TYPE] dans les livres de votre établissement.\nJe m'engage à respecter les conditions de fonctionnement du compte et à fournir toutes les pièces exigées.",
  "Monsieur le Directeur de la Banque"),
L('Banque & Finance', "Fermeture de compte bancaire", "Demande de clôture de compte",
  "N_CPT:Numéro du compte|MOTIF:Motif de la clôture|SOLDE:Destination du solde (virement, retrait en espèces)",
  "Titulaire du compte n° [N_CPT] ouvert dans vos livres, j'ai l'honneur de solliciter sa clôture pour le motif suivant : [MOTIF].\nJe vous prie de bien vouloir remettre le solde par la voie suivante : [SOLDE], après déduction des frais éventuels, et de me délivrer un quitus de clôture.",
  "Monsieur le Directeur de la Banque"),
L('Banque & Finance', "Demande de crédit / prêt", "Demande de crédit",
  "N_CPT:Numéro de compte|MONTANT:Montant demandé (F CFA):m|OBJ_CREDIT:Objet du crédit|DUREE:Durée de remboursement|REVENU:Revenu mensuel (F CFA):m",
  "Titulaire du compte n° [N_CPT], j'ai l'honneur de solliciter un crédit de [MONTANT] F CFA ([MONTANT_L] francs CFA) destiné à : [OBJ_CREDIT].\nMon revenu mensuel est de [REVENU] F CFA et je propose un remboursement sur [DUREE].\nJe me tiens à votre disposition pour fournir tout justificatif.",
  "Monsieur le Directeur de la Banque"),
L('Banque & Finance', "Demande de relevé de compte", "Demande de relevé de compte",
  "N_CPT:Numéro du compte|PERIODE:Période souhaitée (ex. janvier à juin 2026)",
  "Titulaire du compte n° [N_CPT], j'ai l'honneur de solliciter la délivrance de mon relevé de compte pour la période : [PERIODE].",
  "Monsieur le Directeur de la Banque"),
L('Banque & Finance', "Opposition carte / chéquier perdu", "Opposition sur carte ou chéquier",
  "ELEM:Élément perdu:s:ma carte bancaire,mon chéquier|N_CPT:Numéro du compte|DATE_PERTE:Date de la perte:d|CIRC:Circonstances",
  "Je vous informe de la perte ou du vol de [ELEM], associé au compte n° [N_CPT], survenu le [DATE_PERTE] : [CIRC].\nJe vous prie de procéder immédiatement à son opposition et de m'en délivrer un nouveau.",
  "Monsieur le Directeur de la Banque"),

/* ---------------- IMPÔTS & TRÉSOR (6) ---------------- */
L('Impôts & Trésor', "Demande de quitus fiscal", "Demande d'attestation de situation fiscale",
  "NIF_P:Votre NIF|ENTREPRISE:Entreprise / activité|MOTIF:Motif (marché, banque, appel d'offres...)",
  "Titulaire du NIF [NIF_P] et exerçant sous l'enseigne [ENTREPRISE], j'ai l'honneur de solliciter la délivrance d'une attestation de situation fiscale (quitus), nécessaire pour : [MOTIF].",
  "Monsieur le Directeur Général des Impôts"),
L('Impôts & Trésor', "Demande de délai de paiement d'impôt", "Demande de délai de paiement",
  "NIF_P:Votre NIF|NATURE:Impôt concerné|MONTANT:Montant dû (F CFA):m|DELAI_SOUHAITE:Délai souhaité|MOTIF:Difficultés rencontrées:a",
  "Titulaire du NIF [NIF_P], je suis redevable de [NATURE] pour un montant de [MONTANT] F CFA ([MONTANT_L] francs CFA).\nFaisant face à des difficultés de trésorerie : [MOTIF], j'ai l'honneur de solliciter un délai de paiement de [DELAI_SOUHAITE].\nJe m'engage à respecter l'échéancier qui me sera accordé.",
  "Monsieur le Directeur Général des Impôts"),
L('Impôts & Trésor', "Contestation d'imposition", "Réclamation contre une imposition",
  "NIF_P:Votre NIF|NATURE:Impôt contesté|ANNEE:Année d'imposition|MONTANT:Montant réclamé (F CFA):m|ARGUMENTS:Motifs de la contestation:a",
  "Titulaire du NIF [NIF_P], j'ai reçu un avis d'imposition au titre de [NATURE] pour l'année [ANNEE], d'un montant de [MONTANT] F CFA.\nJe conteste cette imposition pour les motifs suivants : [ARGUMENTS].\nJe sollicite en conséquence sa révision ou son annulation.",
  "Monsieur le Directeur Général des Impôts"),
L('Impôts & Trésor', "Déclaration de cessation d'activité", "Cessation d'activité",
  "NIF_P:Votre NIF|ENTREPRISE:Entreprise|DATE_CESS:Date de cessation:d|MOTIF:Motif",
  "J'ai l'honneur de vous informer de la cessation de mon activité exercée sous l'enseigne [ENTREPRISE] (NIF [NIF_P]), à compter du [DATE_CESS].\nMotif : [MOTIF].\nJe vous prie de bien vouloir prendre acte de cette cessation et de m'indiquer les formalités à accomplir.",
  "Monsieur le Directeur Général des Impôts"),
L('Impôts & Trésor', "Demande de paiement (Trésor public)", "Demande de paiement de facture",
  "STRUCTURE:Structure débitrice|FACTURE_N:N° de la facture / du marché|OBJ_MARCHE:Objet des prestations|MONTANT:Montant dû (F CFA):m",
  "Notre entreprise a exécuté pour le compte de [STRUCTURE] les prestations suivantes : [OBJ_MARCHE] (facture / marché n° [FACTURE_N]).\nLe montant de [MONTANT] F CFA ([MONTANT_L] francs CFA) demeure impayé à ce jour.\nNous sollicitons le règlement de cette somme dans les meilleurs délais.",
  "Monsieur le Directeur National du Trésor et de la Comptabilité Publique", FIN_NOUS, true),
L('Impôts & Trésor', "Demande de patente", "Demande de patente",
  "NIF_P:Votre NIF|ACTIVITE:Activité exercée|ADRESSE_ACT:Adresse de l'activité",
  "J'exerce l'activité de [ACTIVITE] à [ADRESSE_ACT] (NIF [NIF_P]).\nJ'ai l'honneur de solliciter ma prise en charge au titre de la contribution des patentes et la délivrance du document correspondant.",
  "Monsieur le Directeur Général des Impôts"),

/* ---------------- DOMAINES & FONCIER (4) ---------------- */
L('Domaines & Foncier', "Demande de titre foncier", "Demande d'immatriculation foncière",
  "PARCELLE:Description (lot, îlot, quartier)|SUPERFICIE:Superficie (m²)|ORIGINE:Origine du droit (achat, héritage, attribution)|PJ:Pièces jointes:a:Acte de cession ou de vente\nPlan de situation\nCopie de la pièce d'identité",
  "Je suis propriétaire de la parcelle située à [PARCELLE], d'une superficie de [SUPERFICIE] m², acquise par : [ORIGINE].\nJ'ai l'honneur de solliciter son immatriculation et la délivrance d'un titre foncier à mon nom.",
  "Monsieur le Directeur Régional des Domaines et du Cadastre"),
L('Domaines & Foncier', "Demande d'attribution de parcelle", "Demande d'attribution de parcelle",
  "USAGE:Usage:s:habitation,commercial,agricole,industriel|LOCALITE:Localité souhaitée|SUPERFICIE:Superficie souhaitée (m²)|SITUATION:Votre situation:a",
  "J'ai l'honneur de solliciter l'attribution d'une parcelle à usage [USAGE], d'environ [SUPERFICIE] m², à [LOCALITE].\nMa situation : [SITUATION].\nJe m'engage à respecter la réglementation foncière et à mettre la parcelle en valeur.",
  "Monsieur le Maire"),
L('Domaines & Foncier', "Demande de permis de construire", "Demande de permis de construire",
  "TERRAIN:Adresse et références du terrain|NATURE:Nature de la construction|SURFACE:Surface bâtie (m²)|PJ:Pièces jointes:a:Titre ou acte de propriété\nPlans de la construction\nCopie de la pièce d'identité",
  "Propriétaire du terrain situé à [TERRAIN], j'ai l'honneur de solliciter un permis de construire pour : [NATURE], d'une surface de [SURFACE] m².\nJe m'engage à respecter les règles d'urbanisme et les prescriptions techniques.",
  "Monsieur le Maire"),
L('Domaines & Foncier', "Demande de bornage", "Demande de bornage de parcelle",
  "PARCELLE:Description de la parcelle|LIEU_PARC:Quartier / localité|MOTIF:Motif (litige, vente, titre foncier)",
  "Propriétaire de la parcelle [PARCELLE] située à [LIEU_PARC], j'ai l'honneur de solliciter son bornage par un géomètre du cadastre, en vue de : [MOTIF].\nJe m'engage à régler les frais correspondants.",
  "Monsieur le Chef du Bureau du Cadastre"),

/* ---------------- POLICE & JUSTICE (4) ---------------- */
L('Police & Justice', "Main courante / déclaration", "Déclaration de faits (main courante)",
  "FAITS:Exposé des faits:a|DATE_FAITS:Date des faits:d|LIEU_FAITS:Lieu des faits",
  "J'ai l'honneur de porter à votre connaissance les faits suivants, survenus le [DATE_FAITS] à [LIEU_FAITS] : [FAITS].\nJe souhaite que ces faits soient consignés sur le registre de main courante, sans engager de poursuites pour le moment.",
  "Monsieur le Commissaire de Police"),
L('Police & Justice', "Demande de copie de jugement", "Demande de copie de jugement",
  "JUGEMENT:Référence du jugement (n°, date)|PARTIES:Parties concernées|JURIDICTION:Juridiction",
  "J'ai l'honneur de solliciter la délivrance d'une copie du jugement référencé [JUGEMENT], rendu par [JURIDICTION] dans l'affaire opposant : [PARTIES].\nJe m'engage à régler les frais de timbres et de greffe.",
  "Monsieur le Greffier en Chef"),
L('Police & Justice', "Requête au tribunal", "Requête",
  "OBJ_REQ:Objet de la requête:a|EXPOSE:Exposé des faits:a",
  "J'ai l'honneur de vous exposer ce qui suit : [EXPOSE].\nEn conséquence, je sollicite de votre haute bienveillance : [OBJ_REQ].\nJe joins à la présente les pièces justificatives.",
  "Monsieur le Président du Tribunal"),
L('Police & Justice', "Autorisation de réunion / manifestation", "Demande d'autorisation de réunion",
  "EVENEMENT:Nature de l'événement|DATE_EV:Date:d|LIEU_EV:Lieu|PARTICIPANTS:Nombre de participants",
  "J'ai l'honneur de solliciter l'autorisation d'organiser [EVENEMENT], le [DATE_EV] à [LIEU_EV], avec environ [PARTICIPANTS] participants.\nJe m'engage à garantir le bon ordre et à respecter la réglementation en vigueur.",
  "Monsieur le Préfet"),

/* ---------------- SANTÉ (2) ---------------- */
L('Santé', "Demande de certificat médical", "Demande de certificat médical",
  "MOTIF:Motif (aptitude, arrêt de travail, voyage...)",
  "J'ai l'honneur de solliciter la délivrance d'un certificat médical nécessaire pour : [MOTIF].\nJe me présenterai à la consultation à la date que vous voudrez bien m'indiquer.",
  "Monsieur le Médecin Chef"),
L('Santé', "Demande de dossier médical", "Demande de copie de dossier médical",
  "PATIENT:Nom du patient|PERIODE:Période concernée|MOTIF:Motif de la demande",
  "J'ai l'honneur de solliciter la copie du dossier médical de [PATIENT] pour la période [PERIODE], en vue de : [MOTIF].",
  "Monsieur le Médecin Chef"),

/* ---------------- ASSURANCE (3) ---------------- */
L('Assurance', "Déclaration de sinistre", "Déclaration de sinistre",
  "N_POLICE:N° de police d'assurance|DATE_SIN:Date du sinistre:d|LIEU_SIN:Lieu du sinistre|DESCRIPTION:Description et dégâts:a",
  "Assuré(e) sous la police n° [N_POLICE], je vous déclare le sinistre survenu le [DATE_SIN] à [LIEU_SIN] : [DESCRIPTION].\nJe vous prie de bien vouloir diligenter une expertise et me faire connaître la suite réservée à mon dossier.",
  "Monsieur le Directeur de la compagnie d'assurance"),
L('Assurance', "Demande de remboursement", "Demande de remboursement",
  "N_POLICE:N° de police|OBJ_REMB:Objet du remboursement|MONTANT:Montant (F CFA):m",
  "Assuré(e) sous la police n° [N_POLICE], j'ai l'honneur de solliciter le remboursement de : [OBJ_REMB], pour un montant de [MONTANT] F CFA ([MONTANT_L] francs CFA).\nJe joins les justificatifs.",
  "Monsieur le Directeur de la compagnie d'assurance"),
L('Assurance', "Résiliation de contrat d'assurance", "Résiliation de contrat d'assurance",
  "N_POLICE:N° de police|DATE_EFFET:Date d'effet souhaitée:d|MOTIF:Motif",
  "J'ai l'honneur de vous notifier la résiliation de mon contrat d'assurance n° [N_POLICE], à compter du [DATE_EFFET], pour le motif suivant : [MOTIF].\nJe vous prie de m'en accuser réception.",
  "Monsieur le Directeur de la compagnie d'assurance"),

/* ---------------- DOUANE & TRANSPORT (3) ---------------- */
L('Douane & Transport', "Demande d'exonération douanière", "Demande d'exonération de droits de douane",
  "MARCHANDISES:Marchandises concernées:a|VALEUR:Valeur estimée (F CFA):m|PROVENANCE:Provenance|MOTIF:Motif de l'exonération",
  "J'ai l'honneur de solliciter l'exonération des droits et taxes de douane sur : [MARCHANDISES], en provenance de [PROVENANCE], d'une valeur de [VALEUR] F CFA.\nMotif : [MOTIF].",
  "Monsieur le Directeur Général des Douanes"),
L('Douane & Transport', "Demande d'agrément de transport", "Demande d'agrément de transport",
  "ACTIVITE_T:Type de transport (marchandises, voyageurs...)|VEHICULES:Véhicules concernés (immatriculation, type):a",
  "J'ai l'honneur de solliciter un agrément pour exercer l'activité de transport de [ACTIVITE_T] avec les véhicules suivants : [VEHICULES].\nJe m'engage à respecter la réglementation des transports.",
  "Monsieur le Directeur des Transports"),
L('Douane & Transport', "Demande de duplicata de carte grise", "Demande de duplicata de carte grise",
  "IMMAT:Immatriculation|MARQUE:Marque et type|MOTIF:Motif (perte, vol, détérioration)",
  "Propriétaire du véhicule [MARQUE], immatriculé [IMMAT], j'ai l'honneur de solliciter un duplicata de la carte grise, l'original ayant été perdu ou détérioré : [MOTIF].",
  "Monsieur le Directeur des Transports"),

/* ---------------- ASSOCIATION & ENTREPRISE (4) ---------------- */
L('Association & Entreprise', "Demande de récépissé d'association", "Demande de récépissé de déclaration d'association",
  "NOM_ASSO:Nom de l'association|SIEGE:Siège|OBJECTIFS:Objectifs:a|PJ:Pièces jointes:a:Statuts\nRèglement intérieur\nPV de l'assemblée constitutive\nListe des membres du bureau",
  "J'ai l'honneur de vous déclarer la création de l'association [NOM_ASSO], dont le siège est à [SIEGE].\nElle a pour objectifs : [OBJECTIFS].\nJe sollicite la délivrance du récépissé de déclaration.",
  "Monsieur le Ministre de l'Administration Territoriale"),
D('Association & Entreprise', "Convocation d'assemblée générale", "ASSO:Nom de l'association / société:t:@nom|DATE_AG:Date de l'assemblée:d|HEURE:Heure|LIEU_AG:Lieu|ORDRE:Ordre du jour:a",
  "Les membres de [ASSO] sont convoqués en assemblée générale le [DATE_AG] à [HEURE], à [LIEU_AG].\nOrdre du jour :\n[ORDRE]\nVotre présence est indispensable. En cas d'empêchement, vous pouvez donner pouvoir à un autre membre.",
  {tdoc:"CONVOCATION À L'ASSEMBLÉE GÉNÉRALE"}),
L('Association & Entreprise', "Demande de partenariat", "Proposition de partenariat",
  "PROJET:Présentation de votre structure / projet:a|PROPOSITION:Ce que vous proposez:a",
  "Nous nous permettons de vous présenter notre structure : [PROJET].\nNous vous proposons un partenariat sur la base suivante : [PROPOSITION].\nNous serions heureux de vous rencontrer pour en discuter.",
  "Monsieur le Directeur", FIN_NOUS, true),
L('Association & Entreprise', "Soumission à un appel d'offres", "Soumission - appel d'offres",
  "REF_AO:Référence de l'appel d'offres|OBJ_AO:Objet de l'appel d'offres|MONTANT:Montant de l'offre (F CFA):m|VALIDITE:Validité de l'offre (ex. 90 jours)",
  "En réponse à l'appel d'offres n° [REF_AO] relatif à : [OBJ_AO], nous avons l'honneur de soumettre notre offre pour un montant de [MONTANT] F CFA ([MONTANT_L] francs CFA).\nNotre offre reste valable [VALIDITE]. Nous joignons les pièces administratives et techniques exigées.",
  "Monsieur le Président de la Commission d'ouverture des offres", FIN_NOUS, true),

/* ---------------- ÉTAT CIVIL (3) ---------------- */
L('État civil', "Demande d'acte de mariage", "Demande d'acte de mariage",
  "EPOUX:Nom de l'époux|EPOUSE:Nom de l'épouse|DATE_MAR:Date du mariage:d|LIEU_MAR:Lieu du mariage",
  "J'ai l'honneur de solliciter la délivrance d'une copie de l'acte de mariage de [EPOUX] et de [EPOUSE], célébré le [DATE_MAR] à [LIEU_MAR].",
  "Monsieur l'Officier d'État Civil"),
L('État civil', "Demande d'acte de décès", "Demande d'acte de décès",
  "DEFUNT:Nom du défunt|DATE_DECES:Date du décès:d|LIEU_DECES:Lieu du décès|LIEN:Votre lien de parenté",
  "En ma qualité de [LIEN], j'ai l'honneur de solliciter la délivrance d'un acte de décès au nom de [DEFUNT], décédé(e) le [DATE_DECES] à [LIEU_DECES].",
  "Monsieur l'Officier d'État Civil"),
L('État civil', "Demande de jugement supplétif", "Requête aux fins de jugement supplétif d'acte de naissance",
  "PERSONNE:Nom de la personne concernée|NAISS:Date de naissance|LIEU_NAISS:Lieu de naissance|PERE:Nom du père|MERE:Nom de la mère|MOTIF:Raison de l'absence d'acte",
  "J'ai l'honneur de solliciter un jugement supplétif d'acte de naissance au profit de [PERSONNE], né(e) le [NAISS] à [LIEU_NAISS], fils/fille de [PERE] et de [MERE].\nL'acte n'a pas pu être établi pour la raison suivante : [MOTIF].\nJe joins les pièces et témoignages utiles.",
  "Monsieur le Président du Tribunal"),

/* ---------------- AGRICULTURE (1) ---------------- */
L('Agriculture', "Demande d'appui agricole", "Demande d'appui (semences, engrais, matériel)",
  "CULTURE:Cultures pratiquées|SUPERFICIE:Superficie exploitée (ha)|LOCALITE:Localité|BESOIN:Appui demandé:a",
  "Exploitant(e) agricole à [LOCALITE], je cultive [CULTURE] sur [SUPERFICIE] hectares.\nJ'ai l'honneur de solliciter l'appui suivant : [BESOIN].\nJe m'engage à utiliser cet appui exclusivement pour mon exploitation.",
  "Monsieur le Directeur Régional de l'Agriculture")
];

/* ===== EXTENSION : modèles 107 à 200 (écriture compacte) ===== */
const R = (cat, titre, dest, champs, corps, cy = false) => L(cat, titre, titre, champs, corps, dest, cy ? FIN_NOUS : '', cy);
const A = (cat, titre, champs, phrase, o = {}) => D(cat, titre, champs, "Je soussigné(e), [SIGNATAIRE], atteste que " + phrase + "\nLa présente attestation est établie pour servir et valoir ce que de droit.", o);
const C2 = (cat, titre, champs, corps, a, ka, b, kb) => D(cat, titre, champs, corps, {sigs: [[a, ka], [b, kb]]});
const DIR = "Monsieur le Directeur";
MODELES.push(
/* Emploi (10) */
R('Emploi', "Demande de reprise de service", DIR, "POSTE:Poste|DATE_REP:Date de reprise:d|ABSENCE:Motif de l'absence", "Après mon absence pour : [ABSENCE], j'ai l'honneur de vous informer de ma reprise de service au poste de [POSTE] à compter du [DATE_REP]."),
R('Emploi', "Demande d'autorisation d'absence", DIR, "DU:Du:d|AU:Au:d|MOTIF:Motif:a", "Je sollicite l'autorisation de m'absenter du [DU] au [AU] pour le motif suivant : [MOTIF].\nJe prendrai les dispositions nécessaires pour assurer la continuité de mon service."),
R('Emploi', "Demande de formation", DIR, "FORMATION:Formation souhaitée|ORGANISME:Organisme|COUT:Coût estimé (F CFA):m", "Je sollicite l'autorisation de suivre la formation suivante : [FORMATION], dispensée par [ORGANISME], pour un coût estimé à [COUT] F CFA.\nCette formation renforcera mes compétences au service de la structure."),
R('Emploi', "Demande d'avance sur salaire", DIR, "MONTANT:Montant (F CFA):m|MOTIF:Motif|REMB:Modalités de remboursement", "Je sollicite une avance sur salaire de [MONTANT] F CFA ([MONTANT_L] francs CFA) pour : [MOTIF].\nJe propose de la rembourser ainsi : [REMB]."),
R('Emploi', "Avertissement à un employé", "Monsieur/Madame", "FAITS:Faits reprochés:a|DATE_FAITS:Date des faits:d", "Nous constatons que, le [DATE_FAITS], les faits suivants se sont produits : [FAITS].\nCes agissements constituent un manquement à vos obligations. Nous vous adressons le présent avertissement et vous invitons à vous conformer au règlement intérieur.", true),
R('Emploi', "Convocation à un entretien préalable", "Monsieur/Madame", "DATE_ENT:Date de l'entretien:d|HEURE:Heure|MOTIF:Objet de l'entretien", "Nous vous convoquons à un entretien le [DATE_ENT] à [HEURE] à notre siège, au sujet de : [MOTIF].\nVous pouvez vous faire assister par une personne de votre choix.", true),
R('Emploi', "Lettre d'embauche", "Monsieur/Madame", "POSTE:Poste|DATE_DEB:Date de début:d|SALAIRE:Salaire mensuel (F CFA):m|ESSAI:Période d'essai", "Nous avons le plaisir de vous informer de votre recrutement au poste de [POSTE], à compter du [DATE_DEB], avec une rémunération mensuelle de [SALAIRE] F CFA ([SALAIRE_L] francs CFA).\nUne période d'essai de [ESSAI] est prévue. Veuillez confirmer votre acceptation par écrit.", true),
R('Emploi', "Fin de période d'essai", "Monsieur/Madame", "POSTE:Poste|DATE_FIN:Date de fin d'essai:d|DECISION:Décision:s:confirmé(e) dans vos fonctions,non retenu(e)", "À l'issue de votre période d'essai au poste de [POSTE], arrivée à terme le [DATE_FIN], nous vous informons que vous êtes [DECISION].", true),
R('Emploi', "Demande de réintégration", DIR, "POSTE:Poste|DATE_DEP:Date de départ:d|MOTIF:Motifs de la demande:a", "Ayant quitté mon poste de [POSTE] le [DATE_DEP], je sollicite ma réintégration dans la structure.\nMotifs : [MOTIF]."),
D('Emploi', "Rapport d'activités", "PERIODE:Période|ACTIV:Activités réalisées:a|DIFF:Difficultés rencontrées:a|PERSP:Perspectives:a", "## Période\n[PERIODE]\n## Activités réalisées\n[ACTIV]\n## Difficultés rencontrées\n[DIFF]\n## Perspectives\n[PERSP]", {tdoc: "RAPPORT D'ACTIVITÉS"}),

/* Administration (11) */
R('Administration', "Demande de certificat de vie", "Monsieur le Maire", "NAISS:Date et lieu de naissance|MOTIF:Motif", "Né(e) le [NAISS], je sollicite un certificat de vie nécessaire pour : [MOTIF]."),
R('Administration', "Demande de certificat de célibat", "Monsieur le Maire", "NAISS:Date et lieu de naissance|MOTIF:Motif", "Né(e) le [NAISS], je sollicite un certificat de célibat nécessaire pour : [MOTIF]."),
R('Administration', "Demande de certificat de bonne vie et mœurs", "Monsieur le Commissaire de Police", "NAISS:Date et lieu de naissance|MOTIF:Motif", "Né(e) le [NAISS], je sollicite un certificat de bonne vie et mœurs nécessaire pour : [MOTIF]."),
R('Administration', "Demande d'audience", "Monsieur le Directeur", "MOTIF:Objet de l'audience:a", "Je sollicite une audience auprès de vous afin de vous entretenir de : [MOTIF].\nJe me tiens à votre disposition à la date qui vous conviendra."),
R('Administration', "Demande de rectification d'acte d'état civil", "Monsieur le Président du Tribunal", "ACTE:Acte concerné|ERREUR:Erreur constatée:a|CORRECT:Mention correcte:a", "Je sollicite la rectification de l'acte suivant : [ACTE].\nErreur constatée : [ERREUR]. Mention correcte : [CORRECT].\nJe joins les pièces justificatives."),
R('Administration', "Demande d'inscription sur la liste électorale", "Monsieur le Maire", "NAISS:Date et lieu de naissance|QUARTIER:Quartier de résidence", "Né(e) le [NAISS] et résidant à [QUARTIER], je sollicite mon inscription sur la liste électorale de la commune."),
R('Administration', "Demande de visa", "Monsieur le Consul", "PAYS:Pays de destination|SEJOUR:Durée du séjour|MOTIF:Motif du voyage|DATE_VOY:Date de départ prévue:d", "Je sollicite un visa pour [PAYS], pour un séjour de [SEJOUR], à compter du [DATE_VOY].\nMotif : [MOTIF]. Je m'engage à quitter le territoire à l'expiration du visa."),
A('Administration', "Attestation de domicile", "PERSONNE:Nom de la personne|ADRESSE_DOM:Adresse|DEPUIS:Depuis:d", "Monsieur/Madame [PERSONNE] est domicilié(e) à [ADRESSE_DOM] depuis le [DEPUIS]."),
A('Administration', "Attestation de bonne conduite", "PERSONNE:Nom de la personne|DUREE:Depuis combien de temps le/la connaissez-vous", "je connais Monsieur/Madame [PERSONNE] depuis [DUREE] et qu'il/elle est de bonne conduite et de bonne moralité."),
D('Administration', "Procès-verbal de constat", "CONSTAT:Faits constatés:a|TEMOINS:Témoins|DATE_CONST:Date du constat:d|LIEU_CONST:Lieu", "Le [DATE_CONST], à [LIEU_CONST], nous avons constaté les faits suivants : [CONSTAT].\nTémoins présents : [TEMOINS].\nLe présent procès-verbal est établi pour servir et valoir ce que de droit.", {tdoc: "PROCÈS-VERBAL DE CONSTAT"}),
R('Administration', "Demande de dérogation", DIR, "OBJ_DER:Objet de la dérogation|MOTIF:Motifs:a", "Je sollicite une dérogation concernant : [OBJ_DER].\nMotifs : [MOTIF]."),

/* Entreprise Cyber (13) */
C2('Entreprise Cyber', "Contrat de maintenance informatique", "PRESTATAIRE:Prestataire:t:@nom|CLIENT:Client|MATERIEL:Matériel couvert:a|REDEV:Redevance mensuelle (F CFA):m|DUREE:Durée", "Entre [PRESTATAIRE] et [CLIENT], il est convenu ce qui suit :\n## Article 1 : Objet\nMaintenance du matériel suivant : [MATERIEL].\n## Article 2 : Redevance\n[REDEV] F CFA ([REDEV_L] francs CFA) par mois, payable d'avance.\n## Article 3 : Durée\n[DUREE], renouvelable par accord écrit.\n## Article 4 : Exclusions\nLes pannes dues à la foudre, aux chocs ou à une mauvaise utilisation ne sont pas couvertes.", 'Le prestataire', 'Le client', 'PRESTATAIRE', 'CLIENT'),
C2('Entreprise Cyber', "Contrat de location de matériel", "LOUEUR:Loueur:t:@nom|LOCATAIRE:Locataire|MATERIEL:Matériel loué:a|LOYER:Prix de location (F CFA):m|DUREE:Durée|CAUTION:Caution (F CFA):m", "Entre [LOUEUR] et [LOCATAIRE], il est convenu ce qui suit :\n## Article 1 : Objet\nLocation du matériel suivant : [MATERIEL].\n## Article 2 : Prix et durée\n[LOYER] F CFA ([LOYER_L] francs CFA) pour [DUREE].\n## Article 3 : Caution\nUne caution de [CAUTION] F CFA est versée et restituée au retour du matériel en bon état.\n## Article 4 : Responsabilité\nLe locataire répond de toute perte ou détérioration.", 'Le loueur', 'Le locataire', 'LOUEUR', 'LOCATAIRE'),
C2('Entreprise Cyber', "Contrat de stage", "ENTREPRISE:Entreprise:t:@nom|STAGIAIRE:Stagiaire|ECOLE:Établissement|DU:Début:d|AU:Fin:d|INDEMN:Indemnité mensuelle (F CFA):m", "Entre [ENTREPRISE] et [STAGIAIRE], étudiant(e) à [ECOLE], il est convenu un stage du [DU] au [AU].\n## Article 1 : Obligations\nLe stagiaire respecte le règlement intérieur et la confidentialité.\n## Article 2 : Indemnité\n[INDEMN] F CFA par mois.\n## Article 3 : Fin de stage\nUne attestation de stage est remise à l'issue du stage.", "L'entreprise", 'Le stagiaire', 'ENTREPRISE', 'STAGIAIRE'),
C2('Entreprise Cyber', "Contrat de sous-traitance", "DONNEUR:Donneur d'ordre:t:@nom|SOUSTRAITANT:Sous-traitant|TRAVAUX:Travaux confiés:a|PRIX:Prix (F CFA):m|DELAI:Délai", "Entre [DONNEUR] et [SOUSTRAITANT], il est convenu ce qui suit :\n## Article 1 : Objet\nLe sous-traitant réalise : [TRAVAUX].\n## Article 2 : Prix\n[PRIX] F CFA ([PRIX_L] francs CFA).\n## Article 3 : Délai\n[DELAI].\n## Article 4 : Responsabilité\nLe sous-traitant répond de la qualité des travaux.", "Le donneur d'ordre", 'Le sous-traitant', 'DONNEUR', 'SOUSTRAITANT'),
D('Entreprise Cyber', "Reçu pour solde de tout compte", "EMPLOYE:Nom de l'employé|EMPLOYEUR:Employeur:t:@nom|MONTANT:Montant (F CFA):m|DETAIL:Détail (salaires, congés, indemnités):a", "Je soussigné(e) [EMPLOYE], reconnais avoir reçu de [EMPLOYEUR] la somme de [MONTANT] F CFA ([MONTANT_L] francs CFA), au titre de : [DETAIL].\nCette somme solde tout compte à la fin de mon contrat.", {sigs: [["L'employé(e)", 'EMPLOYE']]}),
D('Entreprise Cyber', "Note de service", "DEST:Destinataires|OBJ_NOTE:Objet|CONTENU:Contenu:a", "À l'attention de : [DEST]\nObjet : [OBJ_NOTE]\n[CONTENU]\nCette note prend effet dès sa diffusion.", {tdoc: "NOTE DE SERVICE"}),
{cat:'Entreprise Cyber', titre:'Avoir (note de crédit)', type:'f', lib:'AVOIR', art:'le présent avoir', champs:[]},
{cat:'Entreprise Cyber', titre:"Facture d'acompte", type:'f', lib:"FACTURE D'ACOMPTE", art:'la présente facture', champs:[]},
D('Entreprise Cyber', "Bon de caisse", "BENEF:Bénéficiaire|MONTANT:Montant (F CFA):m|MOTIF:Motif", "Bon pour la somme de [MONTANT] F CFA ([MONTANT_L] francs CFA), à remettre à [BENEF] pour : [MOTIF].", {tdoc: "BON DE CAISSE", sigs: [['Le caissier', 'CYBER'], ['Le bénéficiaire', 'BENEF']]}),
A('Entreprise Cyber', "Attestation de livraison", "CLIENT:Client|ARTICLES:Articles livrés:a|DATE_LIV:Date de livraison:d", "les articles suivants ont été livrés par [CYBER] à [CLIENT] le [DATE_LIV] : [ARTICLES]."),
R('Entreprise Cyber', "Réclamation à un fournisseur", "Monsieur le Directeur", "COMMANDE:Commande concernée|PROBLEME:Problème constaté:a|DEMANDE:Solution demandée", "Concernant la commande [COMMANDE], nous avons constaté : [PROBLEME].\nNous vous demandons : [DEMANDE], dans les meilleurs délais.", true),
R('Entreprise Cyber', "Remerciement à un client", "Monsieur/Madame", "ACHAT:Achat ou prestation", "Nous vous remercions de la confiance que vous nous avez accordée pour : [ACHAT].\nNous restons à votre entière disposition pour tout service complémentaire.", true),
D('Entreprise Cyber', "Procuration commerciale", "MANDANT:Mandant:t:@nom|MANDATAIRE:Mandataire|ACTES:Actes autorisés:a|DUREE:Durée de validité", "Je soussigné(e) [MANDANT] donne pouvoir à [MANDATAIRE] pour accomplir en mon nom les actes suivants : [ACTES].\nCette procuration est valable [DUREE].", {sigs: [['Le mandant', 'MANDANT'], ['Le mandataire', 'MANDATAIRE']]}),

/* Services Cyber (5) */
D('Services Cyber', "Fiche d'intervention", "CLIENT:Client|MATERIEL:Matériel|PANNE:Panne signalée:a|TRAVAUX:Travaux effectués:a|COUT:Coût (F CFA):m", "Client : [CLIENT]\nMatériel : [MATERIEL]\nPanne signalée : [PANNE]\nTravaux effectués : [TRAVAUX]\nCoût : [COUT] F CFA ([COUT_L] francs CFA).", {tdoc: "FICHE D'INTERVENTION", sigs: [['Le technicien', 'CYBER'], ['Le client', 'CLIENT']]}),
D('Services Cyber', "Bon de dépôt de matériel", "CLIENT:Client|MATERIEL:Matériel déposé|ETAT:État à la remise:a|PANNE:Panne signalée", "Reçu de [CLIENT] le matériel suivant : [MATERIEL].\nÉtat à la remise : [ETAT]. Panne signalée : [PANNE].\nLe matériel non retiré sous 3 mois ne pourra donner lieu à réclamation.", {tdoc: "BON DE DÉPÔT", sigs: [['Le cyber', 'CYBER'], ['Le client', 'CLIENT']]}),
A('Services Cyber', "Attestation de formation informatique", "PERSONNE:Nom du participant|MODULES:Modules suivis:a|DUREE:Durée|DATE_FIN:Date de fin:d", "Monsieur/Madame [PERSONNE] a suivi, au sein de [CYBER], une formation informatique de [DUREE] portant sur : [MODULES], achevée le [DATE_FIN]."),
{cat:'Services Cyber', titre:'Devis de réparation', type:'f', lib:'DEVIS DE RÉPARATION', art:'le présent devis', champs:[]},
D('Services Cyber', "Garantie de réparation", "CLIENT:Client|MATERIEL:Matériel réparé|TRAVAUX:Travaux effectués|DUREE:Durée de garantie", "[CYBER] garantit à [CLIENT] la réparation suivante pour une durée de [DUREE] : [MATERIEL] — [TRAVAUX].\nLa garantie ne couvre pas la foudre, les chocs, l'humidité ni toute intervention extérieure.", {tdoc: "GARANTIE DE RÉPARATION"}),

/* Scolaire (6) */
R('Scolaire', "Demande de certificat de scolarité", DIR, "CLASSE:Classe / filière|ANNEE:Année scolaire", "Élève / étudiant(e) en [CLASSE] pour l'année [ANNEE], je sollicite un certificat de scolarité."),
R('Scolaire', "Demande de changement de filière", DIR, "FILIERE_A:Filière actuelle|FILIERE_B:Filière souhaitée|MOTIF:Motifs:a", "Actuellement en [FILIERE_A], je sollicite mon passage en [FILIERE_B] pour les motifs suivants : [MOTIF]."),
R('Scolaire', "Demande de congé académique", DIR, "CLASSE:Classe / filière|DUREE:Durée|MOTIF:Motifs:a", "Étudiant(e) en [CLASSE], je sollicite un congé académique de [DUREE] pour : [MOTIF]."),
R('Scolaire', "Demande d'équivalence de diplôme", "Monsieur le Directeur de l'Enseignement Supérieur", "DIPLOME:Diplôme|PAYS:Pays / établissement d'obtention|ANNEE:Année", "Titulaire du diplôme [DIPLOME] obtenu en [ANNEE] à [PAYS], je sollicite son équivalence avec le diplôme malien correspondant."),
R('Scolaire', "Demande de dispense (sport / cours)", DIR, "ELEVE:Élève|CLASSE:Classe|MATIERE:Matière|DUREE:Durée|MOTIF:Motif", "Je sollicite une dispense de [MATIERE] pour [ELEVE], classe de [CLASSE], pendant [DUREE], pour le motif suivant : [MOTIF]."),
A('Scolaire', "Attestation de scolarité", "ELEVE:Nom de l'élève / étudiant|CLASSE:Classe / filière|ANNEE:Année scolaire", "[ELEVE] est régulièrement inscrit(e) en [CLASSE] pour l'année scolaire [ANNEE]."),

/* Banque (4) */
R('Banque & Finance', "Demande de chéquier", "Monsieur le Directeur de la Banque", "N_CPT:Numéro du compte|NB:Nombre de chéquiers", "Titulaire du compte n° [N_CPT], je sollicite la délivrance de [NB] chéquier(s)."),
R('Banque & Finance', "Demande de rééchelonnement de crédit", "Monsieur le Directeur de la Banque", "N_CRED:N° du crédit|MOTIF:Difficultés:a|PROPOSITION:Nouvel échéancier proposé", "Titulaire du crédit n° [N_CRED], je rencontre des difficultés : [MOTIF].\nJe sollicite un rééchelonnement selon la proposition suivante : [PROPOSITION]."),
R('Banque & Finance', "Demande de mainlevée de garantie", "Monsieur le Directeur de la Banque", "N_CRED:N° du crédit soldé|GARANTIE:Garantie à libérer", "Mon crédit n° [N_CRED] étant intégralement remboursé, je sollicite la mainlevée de la garantie suivante : [GARANTIE]."),
R('Banque & Finance', "Demande de domiciliation de salaire", "Monsieur le Directeur de la Banque", "N_CPT:Numéro du compte|EMPLOYEUR:Employeur", "Titulaire du compte n° [N_CPT], je sollicite la domiciliation de mon salaire versé par [EMPLOYEUR] sur ce compte."),

/* Impôts & Trésor (5) */
R('Impôts & Trésor', "Demande de remboursement de crédit de TVA", "Monsieur le Directeur Général des Impôts", "NIF_P:NIF|PERIODE:Période|MONTANT:Montant du crédit (F CFA):m", "Titulaire du NIF [NIF_P], je sollicite le remboursement du crédit de TVA de [MONTANT] F CFA ([MONTANT_L] francs CFA) constaté sur la période [PERIODE]."),
R('Impôts & Trésor', "Demande d'exonération fiscale", "Monsieur le Directeur Général des Impôts", "NIF_P:NIF|IMPOT:Impôt concerné|MOTIF:Fondement de la demande:a", "Titulaire du NIF [NIF_P], je sollicite l'exonération de [IMPOT] pour les motifs suivants : [MOTIF]."),
R('Impôts & Trésor', "Demande de remise gracieuse de pénalités", "Monsieur le Directeur Général des Impôts", "NIF_P:NIF|PENALITE:Pénalités (F CFA):m|MOTIF:Circonstances:a", "Titulaire du NIF [NIF_P], je sollicite la remise gracieuse des pénalités de [PENALITE] F CFA, en raison de : [MOTIF].\nJe me suis acquitté(e) du principal."),
R('Impôts & Trésor', "Demande de duplicata de NIF", "Monsieur le Directeur Général des Impôts", "NIF_P:NIF (si connu)|MOTIF:Motif (perte, détérioration)", "Titulaire du NIF [NIF_P], je sollicite un duplicata de mon attestation d'immatriculation : [MOTIF]."),
R('Impôts & Trésor', "Changement d'adresse fiscale", "Monsieur le Directeur Général des Impôts", "NIF_P:NIF|ANCIENNE:Ancienne adresse|NOUVELLE:Nouvelle adresse|DATE_CH:Date du changement:d", "Titulaire du NIF [NIF_P], je vous informe du transfert de mon adresse de [ANCIENNE] à [NOUVELLE], à compter du [DATE_CH]."),

/* Domaines & Foncier (4) */
R('Domaines & Foncier', "Demande de mutation de titre foncier", "Monsieur le Directeur Régional des Domaines et du Cadastre", "TITRE:N° du titre foncier|ANCIEN:Ancien propriétaire|ACTE:Acte de transfert", "Acquéreur du titre foncier n° [TITRE], appartenant à [ANCIEN], par [ACTE], je sollicite la mutation de ce titre à mon nom."),
R('Domaines & Foncier', "Demande de morcellement de parcelle", "Monsieur le Chef du Bureau du Cadastre", "TITRE:Titre / parcelle|NB:Nombre de lots|MOTIF:Motif", "Propriétaire de la parcelle [TITRE], je sollicite son morcellement en [NB] lots, en vue de : [MOTIF]."),
R('Domaines & Foncier', "Demande de permis d'occuper", "Monsieur le Maire", "LIEU_OCC:Emplacement|USAGE:Usage|SURFACE:Surface (m²)", "Je sollicite un permis d'occuper pour [LIEU_OCC], d'environ [SURFACE] m², à usage de [USAGE]."),
R('Domaines & Foncier', "Opposition foncière", "Monsieur le Directeur Régional des Domaines et du Cadastre", "PARCELLE:Parcelle concernée|MOTIF:Motifs de l'opposition:a", "Je forme opposition à toute opération concernant la parcelle [PARCELLE], pour les motifs suivants : [MOTIF].\nJe joins mes justificatifs."),

/* Immobilier (4) */
C2('Immobilier', "Contrat de bail commercial", "BAILLEUR:Bailleur|LOCATAIRE:Locataire|LOCAL:Local loué|ACTIVITE:Activité|LOYER:Loyer mensuel (F CFA):m|DUREE:Durée", "Entre [BAILLEUR] et [LOCATAIRE], il est convenu ce qui suit :\n## Article 1 : Objet\nLocation du local [LOCAL] pour l'activité de [ACTIVITE].\n## Article 2 : Loyer\n[LOYER] F CFA ([LOYER_L] francs CFA) par mois.\n## Article 3 : Durée\n[DUREE].\n## Article 4 : Obligations\nLe locataire entretient le local et ne change pas l'activité sans accord écrit.", 'Le bailleur', 'Le locataire', 'BAILLEUR', 'LOCATAIRE'),
C2('Immobilier', "État des lieux", "BAILLEUR:Bailleur|LOCATAIRE:Locataire|BIEN:Bien|ETAT:État constaté (pièce par pièce):a|TYPE:Type:s:d'entrée,de sortie", "État des lieux [TYPE] du bien [BIEN] entre [BAILLEUR] et [LOCATAIRE] :\n[ETAT]\nLes parties reconnaissent l'exactitude de cet état des lieux.", 'Le bailleur', 'Le locataire', 'BAILLEUR', 'LOCATAIRE'),
R('Immobilier', "Mise en demeure de loyers impayés", "Monsieur/Madame", "BIEN:Bien loué|MOIS:Mois impayés|MONTANT:Total dû (F CFA):m|DELAI:Délai", "Les loyers de [MOIS] du bien [BIEN] restent impayés, soit [MONTANT] F CFA ([MONTANT_L] francs CFA).\nNous vous mettons en demeure de payer sous [DELAI], faute de quoi nous engagerons la procédure de recouvrement et de résiliation du bail."),
R('Immobilier', "Demande de réparations au propriétaire", "Monsieur le Propriétaire", "BIEN:Bien loué|TRAVAUX:Réparations nécessaires:a", "Locataire du bien [BIEN], je vous signale que les réparations suivantes sont nécessaires : [TRAVAUX].\nJe vous prie de les faire exécuter rapidement."),

/* Police & Justice (5) */
R('Police & Justice', "Désistement de plainte", "Monsieur le Commissaire de Police", "PLAINTE:Référence de la plainte|CONTRE:Contre qui|MOTIF:Motif", "J'ai déposé une plainte référencée [PLAINTE] contre [CONTRE]. Pour le motif suivant : [MOTIF], je déclare m'en désister librement."),
R('Police & Justice', "Demande de liberté provisoire", "Monsieur le Procureur de la République", "DETENU:Nom du détenu|AFFAIRE:Affaire|GARANTIES:Garanties de représentation:a", "J'ai l'honneur de solliciter la liberté provisoire de [DETENU], poursuivi(e) dans l'affaire : [AFFAIRE].\nGaranties : [GARANTIES]."),
R('Police & Justice', "Demande d'assistance judiciaire", "Monsieur le Président du Tribunal", "AFFAIRE:Nature de l'affaire|REVENU:Votre situation financière:a", "Je sollicite l'assistance judiciaire pour l'affaire suivante : [AFFAIRE].\nMa situation financière ne me permet pas d'assumer les frais : [REVENU]."),
R('Police & Justice', "Plainte pour abus de confiance", "Monsieur le Procureur de la République", "CONTRE:Contre qui|BIEN:Bien / somme confié(e)|FAITS:Faits:a", "Je porte plainte contre [CONTRE] pour abus de confiance. Je lui avais confié : [BIEN]. Il/Elle l'a détourné : [FAITS].\nJe sollicite l'ouverture d'une enquête."),
R('Police & Justice', "Constitution de partie civile", "Monsieur le Doyen des Juges d'Instruction", "AFFAIRE:Affaire|PREJUDICE:Préjudice subi:a|MONTANT:Dommages-intérêts (F CFA):m", "Victime dans l'affaire [AFFAIRE], je me constitue partie civile.\nPréjudice subi : [PREJUDICE]. Je sollicite [MONTANT] F CFA de dommages-intérêts."),

/* Santé (3) */
R('Santé', "Demande d'évacuation sanitaire", "Monsieur le Directeur de l'hôpital", "PATIENT:Patient|DIAGNOSTIC:Diagnostic|DESTINATION:Structure de destination", "Je sollicite l'évacuation sanitaire de [PATIENT], atteint(e) de : [DIAGNOSTIC], vers [DESTINATION]. Le dossier médical est joint."),
R('Santé', "Demande de prise en charge médicale", DIR, "PATIENT:Patient|SOINS:Soins|COUT:Coût estimé (F CFA):m", "Je sollicite la prise en charge des soins suivants pour [PATIENT] : [SOINS], estimés à [COUT] F CFA."),
R('Santé', "Demande d'autorisation d'ouverture d'un établissement de santé", "Monsieur le Ministre de la Santé", "TYPE:Type d'établissement|LIEU_ETAB:Localisation|PERSONNEL:Personnel qualifié", "Je sollicite l'autorisation d'ouvrir [TYPE] à [LIEU_ETAB]. Personnel : [PERSONNEL]. Le dossier technique est joint."),

/* Assurance (3) */
R('Assurance', "Demande de devis d'assurance", "Monsieur le Directeur de la compagnie d'assurance", "BIEN:Bien à assurer|TYPE:Type de garantie", "Je souhaite un devis d'assurance pour : [BIEN], avec la garantie : [TYPE]."),
R('Assurance', "Souscription de contrat d'assurance", "Monsieur le Directeur de la compagnie d'assurance", "BIEN:Bien à assurer|DATE_EFF:Date d'effet:d|DUREE:Durée", "Je sollicite la souscription d'un contrat d'assurance pour : [BIEN], à compter du [DATE_EFF], pour une durée de [DUREE]."),
R('Assurance', "Déclaration de vol (assurance)", "Monsieur le Directeur de la compagnie d'assurance", "N_POLICE:N° de police|OBJET_VOLE:Biens volés:a|DATE_VOL:Date du vol:d|PLAINTE:Référence de la plainte", "Assuré(e) sous la police n° [N_POLICE], je déclare le vol survenu le [DATE_VOL] : [OBJET_VOLE]. Plainte déposée : [PLAINTE]."),

/* Douane & Transport (3) */
R('Douane & Transport', "Demande de dédouanement", "Monsieur le Chef du bureau des Douanes", "MARCHANDISES:Marchandises:a|VALEUR:Valeur (F CFA):m|PROVENANCE:Provenance", "Je sollicite le dédouanement de : [MARCHANDISES], en provenance de [PROVENANCE], d'une valeur de [VALEUR] F CFA."),
R('Douane & Transport', "Demande d'immatriculation de véhicule", "Monsieur le Directeur des Transports", "MARQUE:Marque et type|CHASSIS:N° de châssis|ORIGINE:Origine (neuf, occasion)", "Propriétaire du véhicule [MARQUE], châssis n° [CHASSIS] (origine : [ORIGINE]), je sollicite son immatriculation."),
R('Douane & Transport', "Demande de permis de conduire", "Monsieur le Directeur des Transports", "NAISS:Date et lieu de naissance|CATEGORIE:Catégorie (A, B, C...)", "Né(e) le [NAISS], je sollicite un permis de conduire de catégorie [CATEGORIE]. Je joins les pièces exigées."),

/* Association & Entreprise (4) */
D('Association & Entreprise', "PV d'assemblée constitutive", "ASSO:Nom de l'association|DATE_AG:Date:d|LIEU_AG:Lieu|MEMBRES:Membres fondateurs:a|BUREAU:Membres du bureau:a|PRESIDENT:Président de séance|SECRETAIRE:Secrétaire", "Le [DATE_AG], à [LIEU_AG], les membres fondateurs ([MEMBRES]) se sont réunis et ont décidé de créer l'association [ASSO].\nLes statuts ont été adoptés. Le bureau est élu : [BUREAU].\nLa séance est levée.", {tdoc: "PROCÈS-VERBAL D'ASSEMBLÉE CONSTITUTIVE", sigs: [['Le président de séance', 'PRESIDENT'], ['Le secrétaire', 'SECRETAIRE']]}),
R('Association & Entreprise', "Demande d'adhésion", "Monsieur le Président", "ASSO:Association|PROFESSION:Profession|MOTIF:Motivations", "Exerçant la profession de [PROFESSION], je sollicite mon adhésion à [ASSO]. Motivations : [MOTIF]."),
R('Association & Entreprise', "Démission d'une association", "Monsieur le Président", "ASSO:Association|MOTIF:Motif", "Je vous informe de ma démission de [ASSO], avec effet immédiat. Motif : [MOTIF]."),
R('Association & Entreprise', "Demande de subvention (association)", "Monsieur le Maire", "ASSO:Association|PROJET:Projet|MONTANT:Montant (F CFA):m", "L'association [ASSO] sollicite une subvention de [MONTANT] F CFA ([MONTANT_L] francs CFA) pour : [PROJET]. Le budget détaillé est joint."),

/* État civil (3) */
R('État civil', "Demande de livret de famille", "Monsieur l'Officier d'État Civil", "EPOUX:Époux|EPOUSE:Épouse|DATE_MAR:Date du mariage:d", "Mariés le [DATE_MAR], [EPOUX] et [EPOUSE] sollicitent la délivrance de leur livret de famille."),
R('État civil', "Demande de certificat de coutume", "Monsieur le Maire", "FUTUR:Futur époux|FUTURE:Future épouse|DATE_MAR:Date prévue:d", "[FUTUR] et [FUTURE] projettent de se marier le [DATE_MAR] et sollicitent un certificat de coutume."),
R('État civil', "Demande de publication de bans", "Monsieur l'Officier d'État Civil", "FUTUR:Futur époux|FUTURE:Future épouse|DATE_MAR:Date prévue:d", "[FUTUR] et [FUTURE] sollicitent la publication des bans en vue de leur mariage prévu le [DATE_MAR]."),

/* Agriculture (3) */
R('Agriculture', "Demande de crédit agricole", "Monsieur le Directeur de la Banque", "CULTURE:Cultures|SUPERFICIE:Superficie (ha)|MONTANT:Montant demandé (F CFA):m|REMB:Échéance de remboursement", "Exploitant(e) agricole ([CULTURE], [SUPERFICIE] ha), je sollicite un crédit de campagne de [MONTANT] F CFA, remboursable : [REMB]."),
R('Agriculture', "Demande de vaccination du bétail", "Monsieur le Directeur Régional de l'Élevage", "ESPECE:Espèce|NB:Nombre de têtes|LOCALITE:Localité", "Éleveur à [LOCALITE], je sollicite la vaccination de [NB] têtes de [ESPECE]."),
R('Agriculture', "Demande d'attestation d'exploitant agricole", "Monsieur le Directeur Régional de l'Agriculture", "CULTURE:Cultures|SUPERFICIE:Superficie (ha)|LOCALITE:Localité", "Exploitant(e) à [LOCALITE], cultivant [CULTURE] sur [SUPERFICIE] ha, je sollicite une attestation d'exploitant agricole."),

/* Télécom & Énergie (4) */
R('Télécom & Énergie', "Réclamation de facture (eau / électricité)", "Monsieur le Directeur de l'agence", "N_ABO:N° d'abonné|PERIODE:Période facturée|MONTANT:Montant facturé (F CFA):m|MOTIF:Motif de contestation:a", "Abonné n° [N_ABO], je conteste la facture de [PERIODE] ([MONTANT] F CFA) : [MOTIF]. Je sollicite un contrôle et une rectification."),
R('Télécom & Énergie', "Demande de rétablissement de service", "Monsieur le Directeur de l'agence", "N_ABO:N° d'abonné|SERVICE:Service|PAIEMENT:Preuve de paiement", "Abonné n° [N_ABO], je sollicite le rétablissement de mon service de [SERVICE]. Paiement : [PAIEMENT]."),
R('Télécom & Énergie', "Demande d'abonnement internet", "Monsieur le Directeur Commercial", "OFFRE:Offre souhaitée|ADRESSE_INST:Adresse d'installation", "Je sollicite un abonnement internet, offre [OFFRE], pour une installation à [ADRESSE_INST]."),
R('Télécom & Énergie', "Résiliation d'abonnement", "Monsieur le Directeur de l'agence", "N_ABO:N° d'abonné|SERVICE:Service|DATE_EFF:Date d'effet:d", "Abonné n° [N_ABO], je résilie mon abonnement [SERVICE] à compter du [DATE_EFF]."),

/* Social & Retraite (4) */
R('Social & Retraite', "Demande d'immatriculation à l'INPS", "Monsieur le Directeur de l'INPS", "NAISS:Date et lieu de naissance|EMPLOYEUR:Employeur|POSTE:Poste", "Employé(e) de [EMPLOYEUR] au poste de [POSTE], je sollicite mon immatriculation à l'INPS."),
R('Social & Retraite', "Demande de pension de retraite", "Monsieur le Directeur de l'INPS", "N_INPS:N° d'immatriculation|DERNIER:Dernier employeur|DATE_RET:Date de départ à la retraite:d", "Immatriculé(e) sous le n° [N_INPS], parti(e) à la retraite le [DATE_RET] ([DERNIER]), je sollicite la liquidation de ma pension."),
R('Social & Retraite', "Demande d'allocations familiales", "Monsieur le Directeur de l'INPS", "N_INPS:N° d'immatriculation|ENFANTS:Enfants (noms, dates de naissance):a", "Immatriculé(e) sous le n° [N_INPS], je sollicite les allocations familiales pour mes enfants : [ENFANTS]."),
R('Social & Retraite', "Demande de pension de réversion", "Monsieur le Directeur de l'INPS", "DEFUNT:Nom du défunt|N_INPS:N° d'immatriculation|LIEN:Lien de parenté", "En qualité de [LIEN] de [DEFUNT] (n° [N_INPS]), je sollicite la pension de réversion. L'acte de décès est joint.")
);

/* ==================================================================
   4. CONSTRUCTION DU DOCUMENT (modèle intermédiaire de "blocs")
   bloc paragraphe : {runs:[{x,b,i,u,sz,c}], al, sa, sb, fi, ind, bb}
   bloc tableau    : {tbl:{w:[%], rows:[[{blocs,fill}]], bord}}
   ================================================================== */
// Remplace [CLE] par la valeur saisie (en gras) ; vide => pointillés à compléter à la main
function riches(txt, v){
  const runs = [];
  txt.split(/(\[[A-Z_0-9]+\])/).forEach(s => {
    const m = s.match(/^\[([A-Z_0-9]+)\]$/);
    if (m) runs.push({x: v[m[1]] || '……………', b: true}); else if (s) runs.push({x: s});
  });
  return runs;
}

function construire(m, v){
  const val = k => v[k] || '……………';
  const B = [];
  const p = (r, o = {}) => B.push(Object.assign({runs: typeof r === 'string' ? [{x: r}] : r}, o));
  const cel = (t, al, b) => ({blocs: [{runs: [{x: String(t), b}], al: al || 'left', sa: 0}]});

  // En-tête officiel de la République du Mali
  const rep = () => {
    p([{x: 'RÉPUBLIQUE DU MALI', b: true, sz: 26}], {al: 'center', sa: 0});
    p([{x: 'Un Peuple – Un But – Une Foi', i: true}], {al: 'center', sa: 14});
  };
  // Corps de texte : paragraphes justifiés, "## " titres, "- " puces
  const corps = txt => txt.split('\n').forEach(l => {
    if (l.startsWith('## ')) p([{x: l.slice(3), b: true}], {sb: 6, sa: 3});
    else if (l.startsWith('- ')) p([{x: '•  '}, ...riches(l.slice(2), v)], {ind: 567, sa: 3});
    else p(riches(l, v), {al: 'both', fi: true, sa: 8});
  });

  /* ----- LETTRE ADMINISTRATIVE ----- */
  if (m.type === 'l') {
    rep();
    const gauche = [{runs: [{x: val('NOM'), b: true}], sa: 0}];
    if (v.ADRESSE) gauche.push({runs: [{x: v.ADRESSE}], sa: 0});
    if (v.TEL) gauche.push({runs: [{x: 'Tél : ' + v.TEL}], sa: 0});
    B.push({tbl: {w: [55, 45], rows: [[{blocs: gauche}, {blocs: [{runs: [{x: `${val('LIEU')}, le ${val('DATE')}`}], al: 'right'}]}]]}});
    if (v.REF) p([{x: 'Réf : ', b: true}, {x: v.REF}], {sb: 6});
    p([{x: 'Objet : ', b: true}, {x: val('OBJET'), b: true, u: true}], {sb: 10, sa: 10});
    p([{x: 'À'}], {ind: 4536, sa: 0});
    p([{x: val('DESTINATAIRE'), b: true}], {ind: 4536, sa: 14});
    p(val('APPEL') + ',', {sa: 8});
    corps(m.corps);
    corps(m.fin || FIN);
    if (v.PJ) { p([{x: 'P.J. :', b: true, u: true}], {sb: 8, sa: 2}); v.PJ.split('\n').filter(Boolean).forEach(l => p('- ' + l, {ind: 567, sa: 0})); }
    p([{x: val('NOM'), b: true}], {al: 'right', sb: 30});
  }

  /* ----- DOCUMENT (attestation, contrat, reçu...) ----- */
  else if (m.type === 'd') {
    rep();
    if (v.REF) p([{x: 'N° ', b: true}, {x: v.REF}], {sa: 8});
    p(riches(m.tdoc || m.titre.toUpperCase(), v).map(r => Object.assign(r, {b: true, u: true, sz: 28})), {al: 'center', sb: 10, sa: 14});
    corps(m.corps);
    p(riches('Fait à [LIEU], le [DATE]', v), {al: 'right', sb: 12});
    const sigs = m.sigs || [['Le signataire', 'SIGNATAIRE']];
    if (sigs.length === 1) {
      p([{x: sigs[0][0], b: true, u: true}], {al: 'right', sb: 6, sa: 36});
      p([{x: val(sigs[0][1]), b: true}], {al: 'right'});
    } else B.push({tbl: {w: sigs.map(() => 100 / sigs.length), rows: [sigs.map(s => ({blocs: [
      {runs: [{x: s[0], b: true, u: true}], al: 'center', sa: 36}, {runs: [{x: val(s[1]), b: true}], al: 'center'}]}))]}});
  }

  /* ----- FACTURE / DEVIS / BON DE COMMANDE / BON DE LIVRAISON ----- */
  else if (m.type === 'f') {
    rep();
    const np = !!m.noprix, tva = parseFloat(v.TVA) || 0;
    p([{x: `${m.lib} N° ${val('NUMERO')}`, b: true, sz: 30, c: '0B6FB8'}], {al: 'center', sb: 6, sa: 10});
    const em = [{runs: [{x: 'Émetteur', b: true, u: true}], sa: 2}, {runs: [{x: P.nom, b: true}], sa: 0}, {runs: [{x: P.adresse}], sa: 0}, {runs: [{x: 'Tél : ' + P.tel}], sa: 0}];
    if (P.nif) em.push({runs: [{x: 'NIF : ' + P.nif}], sa: 0});
    if (P.rccm) em.push({runs: [{x: 'RCCM : ' + P.rccm}], sa: 0});
    const cl = [{runs: [{x: m.lib === 'BON DE COMMANDE' ? 'Fournisseur' : 'Client', b: true, u: true}], sa: 2}, {runs: [{x: val('CLIENT'), b: true}], sa: 0}];
    if (v.ADRESSE_CL) cl.push({runs: [{x: v.ADRESSE_CL}], sa: 0});
    if (v.NIF_CL) cl.push({runs: [{x: 'NIF : ' + v.NIF_CL}], sa: 0});
    B.push({tbl: {w: [50, 50], rows: [[{blocs: em}, {blocs: cl}]]}});
    p(`${val('LIEU')}, le ${val('DATE')}`, {al: 'right', sb: 8, sa: 8});

    const cab = (t, al) => ({blocs: [{runs: [{x: t, b: true}], al: al || 'center', sa: 0}], fill: 'D9EAF7'});
    const lig = v._lignes.length ? v._lignes : [{d: '', q: 0, p: 0}];
    const rows = [np ? [cab('N°'), cab('Désignation'), cab('Quantité')] : [cab('N°'), cab('Désignation'), cab('Qté'), cab('Prix unitaire (F CFA)'), cab('Montant (F CFA)')]];
    let ht = 0;
    lig.forEach((l, i) => {
      const mt = l.q * l.p; ht += mt;
      rows.push(np ? [cel(i + 1, 'center'), cel(l.d), cel(l.q, 'center')]
                   : [cel(i + 1, 'center'), cel(l.d), cel(l.q, 'center'), cel(fmt(l.p), 'right'), cel(fmt(mt), 'right')]);
    });
    B.push({tbl: {w: np ? [8, 72, 20] : [7, 43, 10, 20, 20], rows, bord: true}});
    if (!np) {
      const tv = Math.round(ht * tva / 100), ttc = ht + tv;
      const tot = [[cel('Total HT', 'right', true), cel(fmt(ht) + ' F CFA', 'right')]];
      if (tva) tot.push([cel(`TVA ${tva} %`, 'right', true), cel(fmt(tv) + ' F CFA', 'right')]);
      tot.push([cel(tva ? 'Total TTC' : 'Net à payer', 'right', true), cel(fmt(ttc) + ' F CFA', 'right', true)]);
      B.push({tbl: {w: [65, 35], rows: tot, bord: true}});
      p([{x: `Arrêté ${m.art} à la somme de `}, {x: `${enLettres(ttc)} francs CFA (${fmt(ttc)} F CFA)`, b: true}, {x: '.'}], {sb: 10, sa: 4});
      if (m.lib === 'FACTURE' && v.MODE) p([{x: 'Mode de paiement : '}, {x: v.MODE, b: true}]);
      if (m.lib === 'DEVIS' && v.VALIDITE) p([{x: 'Validité de l\'offre : '}, {x: v.VALIDITE + ' jours', b: true}]);
    }
    p([{x: 'Le Gérant', b: true, u: true}], {al: 'right', sb: 10, sa: 30});
    p([{x: P.nom, b: true}], {al: 'right'});
  }

  /* ----- CV ----- */
  else if (m.type === 'c') {
    p([{x: val('NOM').toUpperCase(), b: true, sz: 36, c: '0B6FB8'}], {al: 'center', sa: 2});
    p([{x: [v.TEL && 'Tél : ' + v.TEL, v.EMAIL, v.ADRESSE].filter(Boolean).join('  |  ')}], {al: 'center', sa: 8});
    const titre = t => p([{x: t, b: true, c: '0B6FB8', sz: 26}], {sb: 10, sa: 4, bb: true});
    const liste = (t, txt) => { if (!txt) return; titre(t); txt.split('\n').filter(Boolean).forEach(l => p('•  ' + l, {ind: 284, sa: 2})); };
    if (v.NAISS || v.SITUATION || v.NATION) {
      titre('ÉTAT CIVIL');
      if (v.NAISS) p([{x: 'Né(e) le / à : '}, {x: v.NAISS, b: true}], {sa: 1});
      if (v.NATION) p([{x: 'Nationalité : '}, {x: v.NATION, b: true}], {sa: 1});
      if (v.SITUATION) p([{x: 'Situation familiale : '}, {x: v.SITUATION, b: true}], {sa: 1});
    }
    if (v.PROFIL) { titre('PROFIL'); p(v.PROFIL, {al: 'both'}); }
    liste('FORMATION', v.FORMATION); liste('EXPÉRIENCE PROFESSIONNELLE', v.EXPERIENCE); liste('COMPÉTENCES', v.COMPETENCES);
    if (v.LANGUES) { titre('LANGUES'); p(v.LANGUES); }
    if (v.LOISIRS) { titre("CENTRES D'INTÉRÊT"); p(v.LOISIRS); }
  }
  return B;
}

/* ==================================================================
   5. FORMULAIRE
   ================================================================== */
let modele = null, blocs = null;

// Numérotation automatique (FAC-2026-0001, DEV-2026-0001...) mémorisée localement
const NUMS = {'FACTURE':'FAC','DEVIS':'DEV','FACTURE PROFORMA':'PRO','BON DE COMMANDE':'BC','BON DE LIVRAISON':'BL'};
const prochainNum = lib => `${NUMS[lib] || 'DOC'}-${new Date().getFullYear()}-${String(LS.get('num_' + lib, 1)).padStart(4, '0')}`;

// Champs communs selon le type de modèle + champs propres au modèle
function champsDe(m){
  const jour = new Date().toISOString().slice(0, 10);
  const F = (k, l, t = 't', v = '') => ({k, l, t, v});
  let c = [];
  if (m.type === 'l') {
    const cy = m.cyber, dest = m.dest || '';
    c = [F('NOM', cy ? 'Expéditeur' : 'Votre nom et prénom', 't', cy ? '@nom' : ''), F('ADRESSE', 'Adresse', 't', cy ? '@adresse' : ''),
         F('TEL', 'Téléphone', 't', cy ? '@tel' : ''), F('LIEU', 'Ville', 't', '@ville'), F('DATE', 'Date', 'd', jour),
         F('DESTINATAIRE', 'Destinataire (fonction, structure, ville)', 'a', dest),
         F('APPEL', "Formule d'appel", 't', dest.split(' ').slice(0, 3).join(' ') || 'Monsieur le Directeur'),
         F('REF', 'Référence (facultatif)'), F('OBJET', 'Objet', 't', m.objet)];
  } else if (m.type === 'd') {
    c = [F('LIEU', 'Ville', 't', '@ville'), F('DATE', 'Date', 'd', jour), F('REF', 'N° / Référence (facultatif)')];
    if (!m.sigs) c.push(F('SIGNATAIRE', 'Nom du signataire'));
  } else if (m.type === 'f') {
    c = [F('NUMERO', 'Numéro', 't', prochainNum(m.lib)), F('LIEU', 'Ville', 't', '@ville'), F('DATE', 'Date', 'd', jour),
         F('CLIENT', m.lib === 'BON DE COMMANDE' ? 'Fournisseur' : 'Client'), F('ADRESSE_CL', 'Adresse (facultatif)'), F('NIF_CL', 'NIF (facultatif)')];
    if (!m.noprix) c.push(F('TVA', 'TVA (%)', 's', '0,18'));
    if (m.lib === 'FACTURE') c.push(F('MODE', 'Mode de paiement', 's', 'Espèces,Orange Money,Moov Money,Virement,Chèque'));
    if (m.lib === 'DEVIS') c.push(F('VALIDITE', "Validité de l'offre (jours)", 'n', '30'));
  }
  return c.concat(m.champs || []);
}

function ouvrir(i){
  modele = MODELES[i];
  $('#formTitre').textContent = modele.titre;
  const z = $('#champs'); z.innerHTML = '';
  champsDe(modele).forEach(f => {
    let val = f.v || ''; if (val[0] === '@') val = P[val.slice(1)] || '';
    let inp;
    if (f.t === 'a') inp = `<textarea data-k="${f.k}" data-t="a" rows="3">${esc(val)}</textarea>`;
    else if (f.t === 's') inp = `<select data-k="${f.k}" data-t="s">${val.split(',').map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
    else inp = `<input data-k="${f.k}" data-t="${f.t}" type="${f.t === 'd' ? 'date' : (f.t === 'n' || f.t === 'm') ? 'number' : 'text'}" value="${esc(val)}">`;
    const w = document.createElement('label');
    w.className = 'champ' + (f.t === 'a' ? ' large' : '');
    w.innerHTML = `<span>${esc(f.l)} <em>[${f.k}]</em></span>${inp}`;
    z.appendChild(w);
  });
  if (modele.type === 'f') { // lignes de facture
    const b = document.createElement('div'); b.className = 'lignes champ large';
    b.innerHTML = `<span><b>Lignes</b> (désignation, quantité${modele.noprix ? '' : ', prix unitaire'})</span><div id="lignes"></div><button type="button" class="btn sec" id="btnLigne">+ Ajouter une ligne</button>`;
    z.appendChild(b);
    $('#btnLigne').onclick = () => ajouterLigne();
    ajouterLigne();
  }
  $('#apercu').hidden = $('#btnWord').hidden = $('#btnPrint').hidden = true;
  $('#vueAccueil').hidden = true; $('#vueForm').hidden = false; window.scrollTo(0, 0);
}

function ajouterLigne(){
  const np = !!modele.noprix, r = document.createElement('div');
  r.className = 'ligne' + (np ? ' np' : '');
  r.innerHTML = `<input class="ld" list="services" placeholder="Désignation"><input class="lq" type="number" min="0" step="any" value="1" placeholder="Qté">${np ? '' : '<input class="lp" type="number" min="0" placeholder="Prix unitaire">'}<button type="button" class="x">✕</button>`;
  r.querySelector('.x').onclick = () => r.remove();
  $('#lignes').appendChild(r);
}

// Lit toutes les valeurs saisies
function lire(){
  const v = {CYBER: P.nom, CYBER_ADRESSE: P.adresse, CYBER_TEL: P.tel};
  $$('#champs [data-k]').forEach(e => {
    const k = e.dataset.k, t = e.dataset.t; let x = e.value.trim();
    if (t === 'd' && x) x = dateFr(x);
    if (t === 'm' && x) { v[k + '_L'] = enLettres(x); x = fmt(x); }
    v[k] = x;
  });
  v._lignes = $$('#lignes .ligne').map(r => ({
    d: r.querySelector('.ld').value.trim(), q: parseFloat(r.querySelector('.lq').value) || 0,
    p: r.querySelector('.lp') ? parseFloat(r.querySelector('.lp').value) || 0 : 0
  })).filter(l => l.d);
  return v;
}

/* ==================================================================
   6. APERÇU HTML (sert aussi à l'impression)
   ================================================================== */
const ALC = {left: 'left', center: 'center', right: 'right', both: 'justify'};
const runHtml = r => {
  let s = esc(r.x).replace(/\n/g, '<br>');
  if (r.b) s = `<b>${s}</b>`; if (r.i) s = `<i>${s}</i>`; if (r.u) s = `<u>${s}</u>`;
  return (r.sz || r.c) ? `<span style="${r.sz ? `font-size:${r.sz / 2}pt;` : ''}${r.c ? `color:#${r.c}` : ''}">${s}</span>` : s;
};
function blocHtml(b){
  if (b.tbl) {
    const t = b.tbl;
    return `<table style="margin:4pt 0">${t.rows.map(r => '<tr>' + r.map((c, i) =>
      `<td style="width:${t.w[i]}%;${t.bord ? 'border:1px solid #444;' : ''}${c.fill ? `background:#${c.fill};` : ''}">${c.blocs.map(blocHtml).join('')}</td>`).join('') + '</tr>').join('')}</table>`;
  }
  return `<p style="text-align:${ALC[b.al || 'left']};margin:${b.sb || 0}pt 0 ${b.sa ?? 6}pt ${b.ind ? b.ind / 20 + 'pt' : 0};${b.fi ? 'text-indent:1cm;' : ''}${b.bb ? 'border-bottom:1px solid #1aa7e8;' : ''}">${b.runs.map(runHtml).join('')}</p>`;
}
const pied = () => `${P.nom} – ${P.adresse} – Tél : ${P.tel} – ${P.email}${P.nif ? ' – NIF : ' + P.nif : ''}${P.rccm ? ' – RCCM : ' + P.rccm : ''}`;
function apercuHtml(B){
  const logo = LS.get('logo', null) || 'logo.png';
  const texte = `<div><b>${esc(P.nom)}</b><i>${esc(P.slogan)}</i><small>Tél : ${esc(P.tel)} – ${esc(P.email)}</small></div>`;
  const ent = (OPT.entete || OPT.logo) ? `<div class="ent">${OPT.logo ? `<img src="${logo}" alt="">` : ''}${OPT.entete ? texte : ''}</div>` : '';
  const bas = OPT.pied ? `<div class="pied">${esc(pied())}</div>` : '';
  return ent + B.map(blocHtml).join('') + bas;
}

/* ==================================================================
   7. EXPORT WORD (.docx) — générateur INTÉGRÉ, sans aucune bibliothèque
   ni connexion Internet. Un .docx est une archive ZIP de fichiers XML :
   on écrit donc nous-mêmes le ZIP (sans compression) et le XML Word.
   Times New Roman 12, marges 2,5 cm, en-tête logo, pied de page + pagination.
   ================================================================== */
let logoCache = null;
async function logoInfo(){ // logo (PNG) + dimensions, pour l'en-tête Word
  if (logoCache) return logoCache;
  const src = LS.get('logo', null) || 'logo.png';
  try {
    const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
    const dim = await new Promise(res => { const im = new Image(); im.onload = () => res([im.width, im.height]); im.onerror = () => res([1, 1]); im.src = src; });
    logoCache = {data: buf, w: dim[0], h: dim[1]};
  } catch (e) { logoCache = null; }
  return logoCache;
}

/* --- 7a. Écriture d'un fichier ZIP (méthode "stockée", sans compression) --- */
const utf8 = s => new TextEncoder().encode(s);
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC_T[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function creerZip(fichiers){ // fichiers : [{n: 'chemin', d: Uint8Array}]
  const parts = [], central = []; let off = 0;
  const heure = 0, date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  fichiers.forEach(f => {
    const nom = utf8(f.n), crc = crc32(f.d), L = new DataView(new ArrayBuffer(30)), C = new DataView(new ArrayBuffer(46));
    L.setUint32(0, 0x04034b50, true); L.setUint16(4, 20, true); L.setUint16(6, 0x0800, true); L.setUint16(10, heure, true); L.setUint16(12, date, true);
    L.setUint32(14, crc, true); L.setUint32(18, f.d.length, true); L.setUint32(22, f.d.length, true); L.setUint16(26, nom.length, true);
    C.setUint32(0, 0x02014b50, true); C.setUint16(4, 20, true); C.setUint16(6, 20, true); C.setUint16(8, 0x0800, true); C.setUint16(12, heure, true); C.setUint16(14, date, true);
    C.setUint32(16, crc, true); C.setUint32(20, f.d.length, true); C.setUint32(24, f.d.length, true); C.setUint16(28, nom.length, true); C.setUint32(42, off, true);
    parts.push(new Uint8Array(L.buffer), nom, f.d); central.push(new Uint8Array(C.buffer), nom);
    off += 30 + nom.length + f.d.length;
  });
  const cd = central.reduce((n, x) => n + x.length, 0), E = new DataView(new ArrayBuffer(22));
  E.setUint32(0, 0x06054b50, true); E.setUint16(8, fichiers.length, true); E.setUint16(10, fichiers.length, true); E.setUint32(12, cd, true); E.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(E.buffer)], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

/* --- 7b. Génération du XML Word à partir des blocs --- */
const xe = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const BLEU = '1AA7E8', TW = 9072;   // TW = largeur utile en twips (A4 moins marges 2,5 cm)
const runX = r => String(r.x).split('\n').map((t, i) =>
  `<w:r><w:rPr>${r.b ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${r.c ? `<w:color w:val="${r.c}"/>` : ''}${r.sz ? `<w:sz w:val="${r.sz}"/><w:szCs w:val="${r.sz}"/>` : ''}${r.u ? '<w:u w:val="single"/>' : ''}</w:rPr>${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${xe(t)}</w:t></w:r>`).join('');
const paraX = b => b.raw ? b.raw :
  `<w:p><w:pPr>${b.bb ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${BLEU}"/></w:pBdr>` : ''}<w:spacing w:before="${(b.sb || 0) * 20}" w:after="${(b.sa ?? 6) * 20}" w:line="276" w:lineRule="auto"/>${(b.ind || b.fi) ? `<w:ind w:left="${b.ind || 0}"${b.fi ? ' w:firstLine="567"' : ''}/>` : ''}<w:jc w:val="${b.al || 'left'}"/></w:pPr>${(b.runs || []).map(runX).join('')}</w:p>`;
const tableX = t => {
  const v = t.bord ? 'single' : 'nil', w = t.w.map(x => Math.round(TW * x / 100));
  const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="${v}" w:sz="4" w:space="0" w:color="444444"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${TW}" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${w.map(x => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>`
    + t.rows.map(r => '<w:tr>' + r.map((c, i) => `<w:tc><w:tcPr><w:tcW w:w="${w[i]}" w:type="dxa"/>${c.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${c.fill}"/>` : ''}<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>${c.blocs.map(paraX).join('')}</w:tc>`).join('') + '</w:tr>').join('') + '</w:tbl>';
};
const imageX = (cx, cy) => `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

function construireDocx(B, logo){
  const avecH = OPT.entete || OPT.logo, avecF = OPT.pied;   // parties à inclure dans le Word
  // Corps du document (un paragraphe vide sépare deux tableaux collés, sinon Word les fusionne)
  let corps = '', precTable = false;
  B.forEach(b => {
    if (b.tbl) { if (precTable) corps += '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>'; corps += tableX(b.tbl); precTable = true; }
    else { corps += paraX(b); precTable = false; }
  });
  if (precTable) corps += '<w:p/>';
  const document_ = `${XML}<w:document ${NS}><w:body>${corps}<w:sectPr>${avecH ? '<w:headerReference w:type="default" r:id="rIdH"/>' : ''}${avecF ? '<w:footerReference w:type="default" r:id="rIdF"/>' : ''}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  // En-tête : logo et/ou infos du cyber, puis filet bleu (selon les cases cochées)
  const cLogo = logo ? imageX(Math.round(55 * logo.w / logo.h * 9525), 55 * 9525) : paraX({runs: [{x: '[LOGO CYBER]', c: '999999'}], sa: 0});
  const cTxt = {blocs: [{runs: [{x: P.nom, b: true, c: '0B6FB8', sz: 30}], sa: 0}, {runs: [{x: P.slogan, i: true, sz: 20}], sa: 0}, {runs: [{x: `Tél : ${P.tel} – ${P.email}`, sz: 18}], sa: 0}]};
  const cells = (OPT.logo && OPT.entete) ? [{blocs: [{raw: cLogo}]}, cTxt] : OPT.logo ? [{blocs: [{raw: cLogo}]}] : [cTxt];
  const entete = avecH ? `${XML}<w:hdr ${NS}>` + tableX({w: cells.length === 2 ? [18, 82] : [100], rows: [cells]}) + paraX({runs: [], bb: true, sa: 0}) + '</w:hdr>' : '';

  // Pied de page : adresse + "Page X / Y"
  const pt = t => `<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${xe(t)}</w:t></w:r>`;
  const champ = c => `<w:fldSimple w:instr=" ${c} "><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>`;
  const pied_ = `${XML}<w:ftr ${NS}><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="6" w:space="4" w:color="${BLEU}"/></w:pBdr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr>${pt(pied())}</w:p>`
    + `<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr>${pt('Page ')}${champ('PAGE')}${pt(' / ')}${champ('NUMPAGES')}</w:p></w:ftr>`;

  const styles = `${XML}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', PK = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const types = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${avecH ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}${avecF ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}</Types>`;
  const rels = `${XML}<Relationships xmlns="${PK}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `${XML}<Relationships xmlns="${PK}"><Relationship Id="rIdS" Type="${R}/styles" Target="styles.xml"/>${avecH ? `<Relationship Id="rIdH" Type="${R}/header" Target="header1.xml"/>` : ''}${avecF ? `<Relationship Id="rIdF" Type="${R}/footer" Target="footer1.xml"/>` : ''}</Relationships>`;
  const f = [{n: '[Content_Types].xml', d: utf8(types)}, {n: '_rels/.rels', d: utf8(rels)}, {n: 'word/document.xml', d: utf8(document_)}, {n: 'word/_rels/document.xml.rels', d: utf8(docRels)},
             {n: 'word/styles.xml', d: utf8(styles)}];
  if (avecH) f.push({n: 'word/header1.xml', d: utf8(entete)});
  if (avecF) f.push({n: 'word/footer1.xml', d: utf8(pied_)});
  if (avecH && OPT.logo && logo) {
    f.push({n: 'word/_rels/header1.xml.rels', d: utf8(`${XML}<Relationships xmlns="${PK}"><Relationship Id="rIdLogo" Type="${R}/image" Target="media/logo.png"/></Relationships>`)});
    f.push({n: 'word/media/logo.png', d: logo.data});
  }
  return creerZip(f);
}

async function telechargerWord(){
  try {
    const blob = construireDocx(blocs, await logoInfo());
    const nom = norm(modele.titre).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + new Date().toISOString().slice(0, 10) + '.docx';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  } catch (e) { alert("Erreur lors de la création du fichier Word : " + e.message); }
}

/* ==================================================================
   8. ACCUEIL : recherche + catégories
   ================================================================== */
let catActive = 'Tous';
const ICO = {'Emploi':'💼','Administration':'🏛️','Entreprise Cyber':'🖨️','Scolaire':'🎓','Divers':'✉️','Vente & Commerce':'🛒','Immobilier':'🏠','Banque & Finance':'🏦','Impôts & Trésor':'💰','Domaines & Foncier':'🗺️','Police & Justice':'⚖️','Santé':'🩺','Assurance':'🛡️','Douane & Transport':'🚚','Association & Entreprise':'🤝','État civil':'📜','Agriculture':'🌾','Services Cyber':'🖥️','Télécom & Énergie':'💡','Social & Retraite':'👴'};
function afficherAccueil(){
  const cats = ['Tous', ...new Set(MODELES.map(m => m.cat))];
  $('#cats').innerHTML = cats.map(c => `<button class="${c === catActive ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}${c === 'Tous' ? ' (' + MODELES.length + ')' : ''}</button>`).join('');
  $$('#cats button').forEach(b => b.onclick = () => { catActive = b.dataset.c; afficherAccueil(); });
  const q = norm($('#recherche').value.trim());
  $('#liste').innerHTML = MODELES.map((m, i) => ({m, i}))
    .filter(({m}) => (catActive === 'Tous' || m.cat === catActive) && (!q || norm(m.titre + ' ' + m.cat).includes(q)))
    .map(({m, i}) => `<button class="carte" data-i="${i}"><b>${ICO[m.cat] || '📄'} ${esc(m.titre)}</b><small>${esc(m.cat)}</small></button>`).join('')
    || '<p>Aucun modèle trouvé.</p>';
  $$('#liste .carte').forEach(b => b.onclick = () => ouvrir(+b.dataset.i));
}

/* ==================================================================
   9. MODE CYBER : prix + compteur d'impressions
   ================================================================== */
let cpt = LS.get('cpt', 0), prix = LS.get('prix', 500);
function majCompteur(){ $('#cptImp').textContent = cpt; $('#prix').value = prix; $('#recette').textContent = fmt(cpt * prix); }

/* ==================================================================
   10. ÉVÉNEMENTS
   ================================================================== */
$('#recherche').oninput = afficherAccueil;
$('#btnRetour').onclick = () => { $('#vueForm').hidden = true; $('#vueAccueil').hidden = false; };
$('#btnGen').onclick = () => {
  const v = lire();
  if (modele.type === 'f' && v.NUMERO === prochainNum(modele.lib)) LS.set('num_' + modele.lib, LS.get('num_' + modele.lib, 1) + 1);
  blocs = construire(modele, v);
  const a = $('#apercu'); a.innerHTML = apercuHtml(blocs); a.hidden = false;
  $('#btnWord').hidden = $('#btnPrint').hidden = false;
  a.scrollIntoView({behavior: 'smooth'});
};
$('#btnWord').onclick = telechargerWord;
$('#btnPrint').onclick = () => { cpt++; LS.set('cpt', cpt); majCompteur(); window.print(); };
$('#prix').onchange = e => { prix = Math.max(0, +e.target.value || 0); LS.set('prix', prix); majCompteur(); };
$('#btnReset').onclick = () => { if (confirm("Remettre le compteur d'impressions à zéro ?")) { cpt = 0; LS.set('cpt', 0); majCompteur(); } };

// Paramètres du cyber
const idsP = {nom: 'pNom', slogan: 'pSlogan', tel: 'pTel', email: 'pEmail', adresse: 'pAdresse', ville: 'pVille', nif: 'pNif', rccm: 'pRccm'};
$('#btnParam').onclick = () => { for (const k in idsP) $('#' + idsP[k]).value = P[k] || ''; $('#dlgParam').showModal(); };
$('#pFermer').onclick = () => $('#dlgParam').close();
$('#pOk').onclick = () => { for (const k in idsP) P[k] = $('#' + idsP[k]).value.trim(); LS.set('param', P); $('#dlgParam').close(); };
$('#pLogo').onchange = e => { // le logo est réduit (hauteur 150 px) pour tenir dans la mémoire locale
  const f = e.target.files[0]; if (!f) return;
  const im = new Image();
  im.onload = () => {
    const h = Math.min(150, im.height), w = Math.round(im.width * h / im.height), c = document.createElement('canvas');
    c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
    LS.set('logo', c.toDataURL('image/png')); logoCache = null; $('.brand img').src = LS.get('logo', 'logo.png');
  };
  im.src = URL.createObjectURL(f);
};
$('#pLogoReset').onclick = () => { try { localStorage.removeItem('logo'); } catch (e) {} logoCache = null; $('.brand img').src = 'logo.png'; };

// Cases : en-tête / logo / pied de page (appliquées à l'aperçu, à l'impression et au Word)
const optIds = {entete: 'optEntete', logo: 'optLogo', pied: 'optPied'};
for (const k in optIds) {
  const e = $('#' + optIds[k]); e.checked = !!OPT[k];
  e.onchange = () => { OPT[k] = e.checked; LS.set('opt', OPT); if (blocs && !$('#apercu').hidden) $('#apercu').innerHTML = apercuHtml(blocs); };
}

// Installation PWA
let evtInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evtInstall = e; $('#btnInstall').hidden = false; });
$('#btnInstall').onclick = async () => { if (evtInstall) { evtInstall.prompt(); evtInstall = null; $('#btnInstall').hidden = true; } };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- Démarrage ---------- */
if (LS.get('logo', null)) $('.brand img').src = LS.get('logo');
majCompteur();
afficherAccueil();
