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
  "Monsieur le Maire")
];

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
  return `<div class="ent"><img src="${logo}" alt=""><div><b>${esc(P.nom)}</b><i>${esc(P.slogan)}</i><small>Tél : ${esc(P.tel)} – ${esc(P.email)}</small></div></div>`
    + B.map(blocHtml).join('') + `<div class="pied">${esc(pied())}</div>`;
}

/* ==================================================================
   7. EXPORT WORD (.docx) avec docx.js — modifiable dans Word
   Times New Roman 12, marges 2,5 cm, en-tête logo, pied de page adresse
   ================================================================== */
// Chargement de docx.js avec plusieurs sources de secours (local, jsDelivr, unpkg)
function chargerScript(url){
  return new Promise((ok, ko) => {
    const el = document.createElement('script'); el.src = url;
    if (url.startsWith('http')) el.crossOrigin = 'anonymous';   // permet la mise en cache hors ligne
    el.onload = ok; el.onerror = () => { el.remove(); ko(); };
    document.head.appendChild(el);
  });
}
async function assurerDocx(){
  if (typeof docx !== 'undefined') return true;
  const sources = ['libs/docx.js', 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.js', 'https://unpkg.com/docx@8.5.0/build/index.js'];
  for (const u of sources) { try { await chargerScript(u); if (typeof docx !== 'undefined') return true; } catch (e) {} }
  return false;
}

let logoCache = null;
async function logoInfo(){
  if (logoCache) return logoCache;
  const src = LS.get('logo', null) || 'logo.png';
  try {
    const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
    const dim = await new Promise(res => { const im = new Image(); im.onload = () => res([im.width, im.height]); im.onerror = () => res([1, 1]); im.src = src; });
    logoCache = {data: buf, w: dim[0], h: dim[1]};
  } catch (e) { logoCache = null; }
  return logoCache;
}

async function telechargerWord(){
  if (!(await assurerDocx())) { alert("Impossible de charger la bibliothèque Word. Vérifiez votre connexion Internet puis réessayez (le premier chargement nécessite Internet)."); return; }
  const {Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ShadingType, ImageRun, Header, Footer, Packer} = docx;
  const AL = {left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, both: AlignmentType.JUSTIFIED};
  const BLEU = '1AA7E8', TW = 9072; // largeur utile A4 avec marges 2,5 cm (en twips)
  const none = {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'}, ligne = {style: BorderStyle.SINGLE, size: 4, color: '444444'};
  const runs = rs => rs.flatMap(r => String(r.x).split('\n').map((t, i) => new TextRun({text: t, break: i ? 1 : 0, bold: r.b, italics: r.i, underline: r.u ? {} : undefined, size: r.sz, color: r.c})));

  const para = b => new Paragraph({
    alignment: AL[b.al || 'left'], children: runs(b.runs),
    spacing: {before: (b.sb || 0) * 20, after: (b.sa ?? 6) * 20, line: 276},
    indent: {left: b.ind || undefined, firstLine: b.fi ? 567 : undefined},
    border: b.bb ? {bottom: {style: BorderStyle.SINGLE, size: 6, color: BLEU, space: 1}} : undefined
  });
  const tableau = t => new Table({
    width: {size: TW, type: WidthType.DXA}, columnWidths: t.w.map(x => Math.round(TW * x / 100)),
    borders: t.bord ? undefined : {top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none},
    rows: t.rows.map(r => new TableRow({children: r.map((c, i) => new TableCell({
      width: {size: Math.round(TW * t.w[i] / 100), type: WidthType.DXA},
      borders: t.bord ? {top: ligne, bottom: ligne, left: ligne, right: ligne} : {top: none, bottom: none, left: none, right: none},
      shading: c.fill ? {type: ShadingType.CLEAR, color: 'auto', fill: c.fill} : undefined,
      margins: {top: 60, bottom: 60, left: 80, right: 80},
      children: c.blocs.map(para)
    }))}))
  });
  const enfants = blocs.map(b => b.tbl ? tableau(b.tbl) : para(b));

  // En-tête : [LOGO CYBER] + nom, slogan, contacts
  const logo = await logoInfo();
  const cLogo = logo
    ? new Paragraph({children: [new ImageRun({data: logo.data, transformation: {width: Math.round(55 * logo.w / logo.h), height: 55}})]})
    : new Paragraph({children: [new TextRun({text: '[LOGO CYBER]', color: '999999'})]});
  const cTxt = [
    new Paragraph({spacing: {after: 0}, children: [new TextRun({text: P.nom, bold: true, size: 30, color: '0B6FB8'})]}),
    new Paragraph({spacing: {after: 0}, children: [new TextRun({text: P.slogan, italics: true, size: 20})]}),
    new Paragraph({spacing: {after: 0}, children: [new TextRun({text: `Tél : ${P.tel} – ${P.email}`, size: 18})]})
  ];
  const entete = new Header({children: [
    new Table({
      width: {size: TW, type: WidthType.DXA}, columnWidths: [1600, TW - 1600],
      borders: {top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none},
      rows: [new TableRow({children: [
        new TableCell({width: {size: 1600, type: WidthType.DXA}, borders: {top: none, bottom: none, left: none, right: none}, children: [cLogo]}),
        new TableCell({width: {size: TW - 1600, type: WidthType.DXA}, borders: {top: none, bottom: none, left: none, right: none}, children: cTxt})
      ]})]}),
    new Paragraph({border: {bottom: {style: BorderStyle.SINGLE, size: 8, color: BLEU, space: 1}}, children: []})
  ]});
  const basPage = new Footer({children: [new Paragraph({alignment: AlignmentType.CENTER, border: {top: {style: BorderStyle.SINGLE, size: 6, color: BLEU, space: 4}}, children: [new TextRun({text: pied(), size: 18})]}), new Paragraph({alignment: AlignmentType.CENTER, children: [new TextRun({children: ['Page ', docx.PageNumber.CURRENT, ' / ', docx.PageNumber.TOTAL_PAGES], size: 18})]})]});

  const doc = new Document({
    creator: P.nom, title: modele.titre,
    styles: {default: {document: {run: {font: 'Times New Roman', size: 24}}}},
    sections: [{
      properties: {page: {size: {width: 11906, height: 16838}, margin: {top: 1417, right: 1417, bottom: 1417, left: 1417, header: 567, footer: 567}}},
      headers: {default: entete}, footers: {default: basPage}, children: enfants
    }]
  });
  const blob = await Packer.toBlob(doc);
  const nom = norm(modele.titre).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + new Date().toISOString().slice(0, 10) + '.docx';
  if (window.saveAs) saveAs(blob, nom);
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; a.click(); }
}

/* ==================================================================
   8. ACCUEIL : recherche + catégories
   ================================================================== */
let catActive = 'Tous';
const ICO = {'Emploi':'💼','Administration':'🏛️','Entreprise Cyber':'🖨️','Scolaire':'🎓','Divers':'✉️','Vente & Commerce':'🛒','Immobilier':'🏠'};
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

// Installation PWA
let evtInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evtInstall = e; $('#btnInstall').hidden = false; });
$('#btnInstall').onclick = async () => { if (evtInstall) { evtInstall.prompt(); evtInstall = null; $('#btnInstall').hidden = true; } };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- Démarrage ---------- */
if (LS.get('logo', null)) $('.brand img').src = LS.get('logo');
majCompteur();
afficherAccueil();
assurerDocx();   // précharge la bibliothèque Word
