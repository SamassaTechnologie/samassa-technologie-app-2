/* ==================================================================
   RÉDACTEUR IA – MALI  |  modeles-succession.js
   Ajoute la catégorie « Succession & Famille » (13 modèles) :
     HÉRITAGE : demande de jugement d'hérédité, déclaration d'héritiers,
       PV de réunion de famille, procuration d'héritier, renonciation,
       partage amiable, inventaire des biens, déblocage des comptes
       d'un défunt, mutation de titre foncier après décès.
     FAMILLE : pension alimentaire, garde des enfants, tutelle,
       autorisation parentale de sortie du territoire d'un mineur.
   Principes : les parts d'héritage ne sont JAMAIS fixées dans les textes
   (le tribunal les détermine selon la loi ou la coutume applicable au
   défunt) et aucun numéro de loi ou d'article n'est cité.
   À charger APRÈS app.js et modeles-ventes.js (voir index.html).
   ================================================================== */
(function () {
  'use strict';
  if (typeof MODELES === 'undefined' || typeof L === 'undefined' ||
      typeof D === 'undefined' || typeof R === 'undefined') return;     // sécurité
  const CAT = 'Succession & Famille';
  if (MODELES.some(m => m.cat === CAT)) return;                          // déjà installé
  if (typeof ICO !== 'undefined') ICO[CAT] = '👪';

  /* ---------- Éléments communs ---------- */
  const CH   = (...champs) => champs.join('|');
  const PJ   = (...lignes) => 'PJ:Pièces jointes:a:' + lignes.join('\n');
  const TRIB = "Monsieur le Président du Tribunal de Première Instance de ……………";
  const TEM  = "TEMOIN1:Nom du 1er témoin|TEMOIN2:Nom du 2e témoin";
  const CHEF = "CHEF:Chef de quartier / autorité locale (facultatif)";
  const SIG_T    = [['Le 1er témoin', 'TEMOIN1'], ['Le 2e témoin', 'TEMOIN2']];
  const SIG_CHEF = ['Visa du chef de quartier', 'CHEF'];
  const DEFUNT   = CH("DEFUNT:Nom complet du défunt (de la défunte)", "DATE_DECES:Date du décès:d");
  const HERITIERS = "HERITIERS:Liste des héritiers (un par ligne avec nom – lien de parenté – date de naissance):a";

  MODELES.push(

    /* ============ 1) JUGEMENT D'HÉRÉDITÉ ============ */
    L(CAT, "Demande de jugement d'hérédité (héritage)", "Requête aux fins de jugement d'hérédité",
      CH(DEFUNT,
         "LIEU_DECES:Lieu du décès",
         "DOMICILE_D:Dernier domicile du défunt",
         "CONFESSION:Confession ou coutume du défunt (ex. musulmane)",
         "LIEN:Votre lien avec le défunt (ex. fils, épouse, frère)",
         HERITIERS,
         "BIENS:Biens laissés par le défunt (maisons, terrains, comptes bancaires, bétail...):a",
         TEM,
         PJ("Copie de l'acte de décès du défunt",
            "Copie des pièces d'identité des héritiers",
            "Copie du livret de famille ou de l'acte de mariage du défunt",
            "Copies des actes de naissance des héritiers",
            "Copie des pièces d'identité des deux témoins")),
      "J'ai l'honneur de solliciter de votre haute bienveillance l'établissement d'un jugement d'hérédité à la suite du décès de [DEFUNT], survenu le [DATE_DECES] à [LIEU_DECES].\n" +
      "Le défunt (la défunte) avait son dernier domicile à [DOMICILE_D] et relevait de la confession ou de la coutume suivante : [CONFESSION].\n" +
      "Agissant en qualité de [LIEN] du défunt, je demande au tribunal de constater le décès, de désigner les personnes appelées à lui succéder et de déterminer leurs droits conformément à la loi ou à la coutume qui lui était applicable.\n" +
      "À ma connaissance, les héritiers sont les suivants :\n[HERITIERS]\n" +
      "Le défunt (la défunte) a laissé les biens suivants : [BIENS].\n" +
      "Ce jugement m'est nécessaire pour accomplir les formalités de la succession (banque, titres fonciers, pensions, démarches administratives).\n" +
      "Je me tiens à la disposition du tribunal, avec deux témoins majeurs, [TEMOIN1] et [TEMOIN2], pour confirmer ces informations.\n" +
      "Je joins à la présente les pièces justificatives.",
      TRIB),

    /* ============ 2) DÉCLARATION D'HÉRITIERS ============ */
    D(CAT, "Déclaration d'héritiers (liste des ayants droit)",
      CH("DECLARANT:Nom du déclarant", "ID_D:N° de pièce d'identité du déclarant", "ADRESSE_D:Adresse du déclarant",
         DEFUNT, "LIEU_DECES:Lieu du décès", HERITIERS, TEM, CHEF),
      "Je soussigné(e) [DECLARANT], pièce d'identité n° [ID_D], demeurant à [ADRESSE_D], déclare sur l'honneur que [DEFUNT], décédé(e) le [DATE_DECES] à [LIEU_DECES], a laissé pour lui succéder les personnes suivantes :\n" +
      "[HERITIERS]\n" +
      "Je certifie qu'à ma connaissance il n'existe aucun autre héritier.\n" +
      "Les témoins soussignés, qui connaissaient le défunt (la défunte) et sa famille, confirment l'exactitude de cette déclaration.\n" +
      "Toute fausse déclaration m'expose aux sanctions prévues par la loi. La présente déclaration est établie pour servir et valoir ce que de droit, notamment à l'appui d'une demande de jugement d'hérédité.",
      {tdoc: "DÉCLARATION D'HÉRITIERS", sigs: [['Le déclarant', 'DECLARANT']].concat(SIG_T, [SIG_CHEF])}),

    /* ============ 3) PV DE RÉUNION DE FAMILLE ============ */
    D(CAT, "PV de réunion de famille (succession)",
      CH(DEFUNT,
         "DATE_REUNION:Date de la réunion:d",
         "LIEU_REUNION:Lieu de la réunion",
         "PRESIDENT:Président de séance (doyen ou chef de famille)",
         "SECRETAIRE:Secrétaire de séance",
         "PRESENTS:Membres présents (un par ligne avec nom et lien avec le défunt):a",
         "DECISIONS:Décisions prises par la famille:a",
         "REPRESENTANT:Héritier désigné pour représenter la famille"),
      "Le [DATE_REUNION], la famille de feu [DEFUNT], décédé(e) le [DATE_DECES], s'est réunie à [LIEU_REUNION], sous la présidence de [PRESIDENT].\n" +
      "## Membres présents\n[PRESENTS]\n" +
      "## Ordre du jour\n- Constat du décès et recensement des héritiers\n- Désignation d'un représentant de la famille pour les démarches de la succession\n- Examen des biens et des dettes laissés par le défunt\n" +
      "## Décisions prises\n[DECISIONS]\n" +
      "## Désignation du représentant\nLes membres présents désignent [REPRESENTANT] pour accomplir, au nom de la famille, les démarches nécessaires auprès du tribunal, des banques et des administrations. Le représentant ne peut vendre, donner ni engager aucun bien de la succession sans l'accord de tous les héritiers.\n" +
      "Le présent procès-verbal est établi pour servir et valoir ce que de droit. La séance est levée après lecture et approbation par les membres présents.",
      {tdoc: "PROCÈS-VERBAL DE RÉUNION DE FAMILLE", sigs: [['Le président de séance', 'PRESIDENT'], ['Le secrétaire de séance', 'SECRETAIRE'], ['Le représentant désigné', 'REPRESENTANT']]}),

    /* ============ 4) PROCURATION D'HÉRITIER ============ */
    D(CAT, "Procuration d'héritier (démarches de succession)",
      CH("MANDANT:Nom du mandant (l'héritier)", "ID_M:N° de pièce d'identité du mandant", "ADRESSE_M:Adresse du mandant",
         "MANDATAIRE:Nom du mandataire (la personne qui agira)", "ID_T:N° de pièce d'identité du mandataire", "ADRESSE_T:Adresse du mandataire",
         "DEFUNT:Nom complet du défunt (de la défunte)",
         "POUVOIRS:Pouvoirs donnés (un par ligne):a:Déposer et suivre la demande de jugement d'hérédité\nRetirer les copies du jugement et des actes d'état civil\nMe représenter auprès des banques, des services fonciers et des administrations pour la succession",
         "DUREE:Durée de validité:t:12 mois",
         TEM),
      "Je soussigné(e) [MANDANT], pièce d'identité n° [ID_M], demeurant à [ADRESSE_M], en ma qualité d'héritier(ère) de feu [DEFUNT], donne par la présente procuration à [MANDATAIRE], pièce d'identité n° [ID_T], demeurant à [ADRESSE_T], afin de me représenter dans les démarches relatives à la succession de [DEFUNT], et notamment :\n" +
      "[POUVOIRS]\n" +
      "Le mandataire ne peut ni vendre, ni donner, ni hypothéquer un bien de la succession, ni encaisser une somme revenant à la succession, sans mon accord écrit.\n" +
      "La présente procuration est valable pour une durée de [DUREE]. Je puis la révoquer à tout moment par écrit.\n" +
      "Fait en présence des témoins [TEMOIN1] et [TEMOIN2], qui y apposent leur signature.",
      {tdoc: "PROCURATION D'HÉRITIER", sigs: [['Le mandant', 'MANDANT'], ['Le mandataire', 'MANDATAIRE']].concat(SIG_T)}),

    /* ============ 5) RENONCIATION D'UN HÉRITIER ============ */
    D(CAT, "Renonciation d'un héritier à sa part (héritage)",
      CH("RENONCANT:Nom de l'héritier qui renonce", "ID_R:N° de pièce d'identité", "ADRESSE_R:Adresse",
         DEFUNT,
         "PART:Part concernée:t:l'intégralité de ma part",
         "BENEFICIAIRES:Au profit de (noms des bénéficiaires, un par ligne):a",
         TEM),
      "Je soussigné(e) [RENONCANT], pièce d'identité n° [ID_R], demeurant à [ADRESSE_R], héritier(ère) de feu [DEFUNT], décédé(e) le [DATE_DECES], déclare, librement et sans aucune contrainte, renoncer à ma part dans sa succession, à savoir : [PART].\n" +
      "Cette renonciation est faite au profit de :\n[BENEFICIAIRES]\n" +
      "Je reconnais avoir compris la portée de cette décision et n'avoir subi aucune pression. Elle ne concerne que les droits mentionnés ci-dessus.\n" +
      "La présente déclaration est faite en présence de deux témoins, [TEMOIN1] et [TEMOIN2]. Sa validité et son enregistrement restent soumis aux règles applicables et à l'appréciation des autorités compétentes (tribunal, notaire).",
      {tdoc: "RENONCIATION D'UN HÉRITIER À SA PART", sigs: [["L'héritier qui renonce", 'RENONCANT']].concat(SIG_T)}),

    /* ============ 6) PARTAGE AMIABLE ============ */
    D(CAT, "Partage amiable de succession (héritage)",
      CH(DEFUNT,
         "JUGEMENT:N° et date du jugement d'hérédité",
         "HERITIERS:Héritiers et part de chacun telle que fixée par le jugement (un par ligne):a",
         "BIENS_ATTRIBUES:Attribution des biens (qui reçoit quoi, un par ligne):a",
         "DETTES:Dettes et charges et leur répartition (écrire néant s'il n'y en a pas):a",
         "REPRESENTANT:Nom du représentant des héritiers",
         TEM),
      "## Article 1 : Objet\nLes héritiers de feu [DEFUNT], décédé(e) le [DATE_DECES], ont convenu de procéder au partage amiable de ses biens, conformément au jugement d'hérédité n° [JUGEMENT].\n" +
      "## Article 2 : Héritiers et parts\nLes héritiers et leurs parts, telles que fixées par le jugement d'hérédité, sont les suivants :\n[HERITIERS]\n" +
      "## Article 3 : Attribution des biens\nLes biens de la succession sont attribués comme suit :\n[BIENS_ATTRIBUES]\n" +
      "## Article 4 : Dettes et charges\n[DETTES]\n" +
      "## Article 5 : Accord des héritiers\nChaque héritier reconnaît avoir reçu la part qui lui est attribuée et déclare n'avoir plus aucune réclamation à formuler sur les biens partagés, sous réserve de la découverte de biens ou de dettes non connus à ce jour.\n" +
      "## Article 6 : Formalités\nLes héritiers s'engagent à accomplir ensemble les formalités nécessaires (mutation des titres fonciers, banques, services administratifs) et à supporter les frais à proportion de leur part.\n" +
      "## Article 7 : Litiges\nTout différend sera réglé à l'amiable, avec l'aide de la famille ; à défaut, par les juridictions maliennes compétentes.\n" +
      "Fait en autant d'exemplaires que d'héritiers, en présence des témoins [TEMOIN1] et [TEMOIN2]. Chaque héritier signe ou appose son empreinte à la suite de son nom sur la liste ci-dessus.",
      {tdoc: "ACTE DE PARTAGE AMIABLE DE SUCCESSION", sigs: [['Le représentant des héritiers', 'REPRESENTANT']].concat(SIG_T)}),

    /* ============ 7) INVENTAIRE DES BIENS ============ */
    D(CAT, "Inventaire des biens de la succession",
      CH("DECLARANT:Nom de la personne qui dresse l'inventaire",
         DEFUNT,
         "IMMEUBLES:Immeubles et terrains (adresse, titre foncier, superficie):a",
         "COMPTES:Comptes bancaires et épargne (banque et numéro):a",
         "AUTRES:Véhicules, bétail, matériel et autres biens:a",
         "CREANCES:Sommes dues au défunt (écrire néant s'il n'y en a pas):a",
         "DETTES:Dettes et charges du défunt (écrire néant s'il n'y en a pas):a",
         TEM),
      "Je soussigné(e) [DECLARANT], héritier(ère) ou représentant(e) des héritiers de feu [DEFUNT], décédé(e) le [DATE_DECES], dresse l'inventaire suivant des biens et des dettes laissés par le défunt (la défunte).\n" +
      "## Immeubles et terrains\n[IMMEUBLES]\n" +
      "## Comptes bancaires et épargne\n[COMPTES]\n" +
      "## Véhicules, bétail, matériel et autres biens\n[AUTRES]\n" +
      "## Sommes dues au défunt\n[CREANCES]\n" +
      "## Dettes et charges\n[DETTES]\n" +
      "Je certifie que cet inventaire est sincère et complet à ma connaissance. Il pourra être complété si d'autres biens ou dettes sont découverts. Il est établi en présence des témoins [TEMOIN1] et [TEMOIN2].",
      {tdoc: "INVENTAIRE DES BIENS DE LA SUCCESSION", sigs: [['Le déclarant', 'DECLARANT']].concat(SIG_T)}),

    /* ============ 8) DÉBLOCAGE DES COMPTES D'UN DÉFUNT ============ */
    R(CAT, "Demande de déblocage des comptes d'un défunt",
      "Monsieur le Directeur de la banque ……………, agence de ……………",
      CH(DEFUNT,
         "NUM_COMPTE:Numéro du ou des comptes",
         "QUALITE:Votre qualité (héritier, représentant des héritiers)",
         "JUGEMENT:N° et date du jugement d'hérédité",
         PJ("Copie du jugement d'hérédité",
            "Copie de l'acte de décès",
            "Copie de ma pièce d'identité",
            "Procuration des autres héritiers (si j'agis pour leur compte)")),
      "Je vous informe du décès de [DEFUNT], survenu le [DATE_DECES], titulaire du compte n° [NUM_COMPTE] ouvert dans vos livres.\n" +
      "Agissant en qualité de [QUALITE], je vous produis le jugement d'hérédité n° [JUGEMENT], qui détermine les héritiers du défunt (de la défunte) et leurs droits.\n" +
      "Je vous prie de bien vouloir me communiquer le solde de ce compte à la date du décès, ainsi que les formalités et les pièces complémentaires nécessaires au déblocage des fonds en faveur des héritiers, conformément à ce jugement.\n" +
      "Je reste à votre disposition pour tout renseignement."),

    /* ============ 9) MUTATION DE TITRE FONCIER APRÈS DÉCÈS ============ */
    R(CAT, "Mutation de titre foncier après décès (succession)",
      "Monsieur le Directeur Régional des Domaines et du Cadastre",
      CH(DEFUNT,
         "TITRE:N° du titre foncier",
         "JUGEMENT:N° et date du jugement d'hérédité",
         "BENEFICIAIRES:Héritiers bénéficiaires et part de chacun (un par ligne):a",
         PJ("Titre foncier original",
            "Copie du jugement d'hérédité",
            "Copie de l'acte de décès",
            "Copie des pièces d'identité des héritiers",
            "Acte de partage amiable (s'il a été établi)")),
      "Héritier(ère) de feu [DEFUNT], décédé(e) le [DATE_DECES], propriétaire du titre foncier n° [TITRE], je sollicite la mutation de ce titre au nom des héritiers désignés par le jugement d'hérédité n° [JUGEMENT], à savoir :\n" +
      "[BENEFICIAIRES]\n" +
      "Je joins à la présente les pièces nécessaires à l'instruction du dossier."),

    /* ============ 10) PENSION ALIMENTAIRE ============ */
    R(CAT, "Requête en pension alimentaire",
      TRIB,
      CH("DEBITEUR:Nom de la personne qui doit verser la pension",
         "LIEN:Son lien avec vous (ex. père des enfants, ex-époux)",
         "ENFANTS:Enfants bénéficiaires (un par ligne avec nom et âge):a",
         "MONTANT:Pension mensuelle demandée (F CFA):m",
         "SITUATION:Exposé de la situation (depuis quand la pension n'est plus versée, ressources...):a",
         PJ("Copies des actes de naissance des enfants",
            "Copie de l'acte de mariage ou du jugement concernant l'union",
            "Copie de ma pièce d'identité",
            "Justificatifs des charges des enfants (scolarité, santé)")),
      "J'ai l'honneur de vous exposer ce qui suit : [SITUATION].\n" +
      "[DEBITEUR], [LIEN], ne subvient pas, ou plus, de façon suffisante aux besoins des enfants suivants :\n[ENFANTS]\n" +
      "En conséquence, je sollicite du tribunal qu'il fixe à la charge de [DEBITEUR] une pension alimentaire mensuelle de [MONTANT] F CFA ([MONTANT_L] francs CFA), payable chaque mois entre mes mains.\n" +
      "Je joins à la présente les pièces justificatives."),

    /* ============ 11) GARDE DES ENFANTS ============ */
    R(CAT, "Requête en attribution de la garde des enfants",
      TRIB,
      CH("AUTRE_PARENT:Nom de l'autre parent",
         "ENFANTS:Enfants concernés (un par ligne avec nom et date de naissance):a",
         "SITUATION:Exposé des faits:a",
         "VISITE:Droit de visite proposé pour l'autre parent:a",
         PJ("Copies des actes de naissance des enfants",
            "Copie de l'acte de mariage ou du jugement concernant l'union",
            "Copie de ma pièce d'identité",
            "Toute pièce utile (attestations, témoignages)")),
      "J'ai l'honneur de vous exposer ce qui suit : [SITUATION].\n" +
      "Les enfants concernés, nés de mon union avec [AUTRE_PARENT], sont les suivants :\n[ENFANTS]\n" +
      "Dans l'intérêt supérieur des enfants, je sollicite que leur garde me soit confiée.\n" +
      "Je propose, pour le droit de visite de l'autre parent : [VISITE].\n" +
      "Je joins à la présente les pièces justificatives."),

    /* ============ 12) TUTELLE ============ */
    R(CAT, "Requête en ouverture de tutelle (enfants orphelins)",
      TRIB,
      CH("MINEURS:Mineurs concernés (un par ligne avec nom et date de naissance):a",
         "PARENTS_DEC:Parent(s) décédé(s) (noms et dates de décès):a",
         "TUTEUR:Personne proposée comme tuteur",
         "LIEN_TUTEUR:Lien du tuteur avec les enfants",
         "MOTIFS:Raisons de ce choix:a",
         "AVIS:Avis de la famille réunie:a",
         PJ("Copies des actes de naissance des mineurs",
            "Copie de l'acte de décès du ou des parents",
            "Copie de ma pièce d'identité et de celle du tuteur proposé",
            "Procès-verbal de la réunion de famille")),
      "J'ai l'honneur de solliciter l'ouverture d'une tutelle en faveur des mineurs suivants :\n[MINEURS]\n" +
      "Ces enfants sont orphelins de : [PARENTS_DEC].\n" +
      "Afin de protéger leur personne et leurs intérêts, il est proposé de désigner comme tuteur : [TUTEUR], [LIEN_TUTEUR]. Ce choix est motivé par : [MOTIFS].\n" +
      "La famille, réunie à cet effet, a donné l'avis suivant : [AVIS].\n" +
      "Je sollicite que le tribunal désigne le tuteur et fixe les conditions de l'administration des biens des mineurs."),

    /* ============ 13) SORTIE DU TERRITOIRE D'UN MINEUR ============ */
    D(CAT, "Autorisation parentale de sortie du territoire (mineur)",
      CH("PARENT:Nom du parent (ou tuteur) qui autorise",
         "ID_P:N° de pièce d'identité du parent",
         "ADRESSE_P:Adresse du parent",
         "QUALITE_P:Qualité:s:père,mère,tuteur légal",
         "ENFANT:Nom complet de l'enfant",
         "NAISS_E:Date de naissance de l'enfant:d",
         "LIEU_NAISS_E:Lieu de naissance de l'enfant",
         "DESTINATION:Pays et ville de destination",
         "DATE_DEPART:Date de départ:d",
         "DATE_RETOUR:Date de retour:d",
         "MOTIF:Motif du voyage",
         "ACCOMPAGNATEUR:Nom de la personne qui accompagne l'enfant",
         "ID_ACC:N° de pièce d'identité de l'accompagnateur",
         "LIEN_ACC:Lien de l'accompagnateur avec l'enfant"),
      "Je soussigné(e) [PARENT], pièce d'identité n° [ID_P], demeurant à [ADRESSE_P], en qualité de [QUALITE_P] de l'enfant [ENFANT], né(e) le [NAISS_E] à [LIEU_NAISS_E], autorise cet enfant à quitter le territoire malien pour se rendre à [DESTINATION], du [DATE_DEPART] au [DATE_RETOUR], pour le motif suivant : [MOTIF].\n" +
      "L'enfant voyagera accompagné(e) de [ACCOMPAGNATEUR], pièce d'identité n° [ID_ACC], [LIEN_ACC].\n" +
      "Je certifie être titulaire de l'autorité parentale sur cet enfant. Je m'engage à faire légaliser la présente autorisation par l'autorité compétente avant son utilisation.",
      {tdoc: "AUTORISATION PARENTALE DE SORTIE DU TERRITOIRE", sigs: [['Le parent / tuteur', 'PARENT']]})
  );

  /* ---------- Rafraîchir la liste des modèles ---------- */
  if (typeof afficherAccueil === 'function') afficherAccueil();
})();
