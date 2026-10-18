/* ==================================================================
   RÉDACTEUR IA – MALI  |  modeles-ventes.js
   1) Ajoute la signature de 2 TÉMOINS aux modèles de vente existants
      (et le visa du chef de quartier pour les terrains / parcelles).
   2) Ajoute de nouveaux modèles de vente : terrain, promesse de vente,
      maison, champ, boutique, bétail, matériel d'occasion, vente par
      acomptes, reçu d'acompte.
   À charger APRÈS app.js (voir index.html).
   ================================================================== */
(function () {
  'use strict';
  if (typeof MODELES === 'undefined' || typeof D === 'undefined') return;       // sécurité
  if (MODELES.some(m => m.titre === 'Vente de terrain')) return;                 // déjà installé

  /* ---------- Éléments communs ---------- */
  const TEM  = "TEMOIN1:Nom du 1er témoin|TEMOIN2:Nom du 2e témoin";
  const CHEF = "CHEF:Chef de quartier / autorité locale (facultatif)";
  const SIG_V = [['Le vendeur', 'VENDEUR'], ["L'acheteur", 'ACHETEUR']];
  const SIG_T = [['Le 1er témoin', 'TEMOIN1'], ['Le 2e témoin', 'TEMOIN2']];
  const SIG_CHEF = ['Visa du chef de quartier', 'CHEF'];
  const TEMF = "\nLe présent document est établi en présence des témoins [TEMOIN1] et [TEMOIN2], qui y apposent leur signature.";

  const PARTIES = "VENDEUR:Nom du vendeur|ID_V:N° de pièce d'identité du vendeur|ADRESSE_V:Adresse du vendeur|ACHETEUR:Nom de l'acheteur|ID_A:N° de pièce d'identité de l'acheteur|ADRESSE_A:Adresse de l'acheteur";
  const ENTRE = "Entre les soussignés :\nLe vendeur : [VENDEUR], demeurant à [ADRESSE_V], pièce d'identité n° [ID_V] ;\nL'acheteur : [ACHETEUR], demeurant à [ADRESSE_A], pièce d'identité n° [ID_A].\nIl a été convenu et arrêté ce qui suit :\n";
  const PAIE = "PRIX:Prix de vente (F CFA):m|MODE:Paiement:s:intégralement ce jour,par acomptes selon l'échéancier convenu entre les parties";

  /* ---------- 1) Témoins sur les modèles de vente existants ---------- */
  const ajouterTemoins = (titre, chef) => {
    const m = MODELES.find(x => x.titre === titre);
    if (!m || m.champs.some(c => c.k === 'TEMOIN1')) return;
    m.champs = m.champs.concat(parse(TEM + (chef ? '|' + CHEF : '')));
    m.sigs = (m.sigs || SIG_V).concat(SIG_T, chef ? [SIG_CHEF] : []);
    m.corps += TEMF;
  };
  ajouterTemoins('Attestation de vente');
  ajouterTemoins('Contrat de vente');
  ajouterTemoins('Vente de véhicule / moto');
  ajouterTemoins('Cession de parcelle', true);

  /* ---------- 2) Nouveaux modèles de vente ---------- */
  const vente = (titre, champs, corps, o = {}) => D('Vente & Commerce', titre,
    PARTIES + '|' + champs + '|' + TEM + (o.chef ? '|' + CHEF : ''),
    ENTRE + corps + TEMF,
    {tdoc: o.tdoc || titre.toUpperCase(), sigs: SIG_V.concat(SIG_T, o.chef ? [SIG_CHEF] : [])});

  const TERRAIN = "LOCALITE:Localité / quartier / commune|LOT:Lot / îlot / parcelle n°|SUPERFICIE:Superficie (m²)|LIMITES:Limites du terrain (Nord, Sud, Est, Ouest):a|ORIGINE:Origine de propriété (titre foncier n°, permis d'occuper, lettre d'attribution, héritage...)";

  MODELES.push(
    vente('Vente de terrain', TERRAIN + '|' + PAIE,
      "## Article 1 : Objet\nLe vendeur vend à l'acheteur, qui accepte, le terrain situé à [LOCALITE], lot / parcelle n° [LOT], d'une superficie de [SUPERFICIE] m².\n" +
      "## Article 2 : Limites\n[LIMITES]\n" +
      "## Article 3 : Origine de propriété\nLe vendeur déclare détenir ce terrain en vertu de : [ORIGINE].\n" +
      "## Article 4 : Prix et paiement\nLa vente est conclue moyennant le prix de [PRIX] F CFA ([PRIX_L] francs CFA), payé [MODE]. Le vendeur en donne quittance pour les sommes déjà reçues.\n" +
      "## Article 5 : Garantie\nLe vendeur garantit être le seul propriétaire du terrain, qu'il est libre de tout litige, hypothèque, gage ou occupation, et qu'il n'a fait l'objet d'aucune autre vente.\n" +
      "## Article 6 : Transfert de propriété et jouissance\nL'acheteur devient propriétaire et entre en jouissance du terrain à compter de ce jour, sous réserve du paiement intégral du prix.\n" +
      "## Article 7 : Frais et régularisation\nLes frais de mutation, d'enregistrement et de régularisation sont à la charge de l'acheteur. Les parties s'engagent à se présenter devant le notaire et les services compétents (Domaines et Cadastre, mairie) pour régulariser le présent acte et le transfert du titre.\n" +
      "## Article 8 : Litiges\nTout différend sera réglé à l'amiable ; à défaut, par les juridictions maliennes compétentes.\nFait en trois exemplaires originaux.",
      {chef: true, tdoc: 'ACTE DE VENTE DE TERRAIN'}),

    vente('Promesse de vente de terrain',
      "LOCALITE:Localité / quartier / commune|LOT:Lot / îlot / parcelle n°|SUPERFICIE:Superficie (m²)|PRIX:Prix convenu (F CFA):m|ACOMPTE:Acompte versé ce jour (F CFA):m|DATE_LIM:Date limite de signature de l'acte définitif:d",
      "## Article 1 : Promesse\nLe vendeur promet de vendre à l'acheteur, qui promet d'acheter, le terrain situé à [LOCALITE], lot / parcelle n° [LOT], d'une superficie de [SUPERFICIE] m².\n" +
      "## Article 2 : Prix\nLe prix convenu est de [PRIX] F CFA ([PRIX_L] francs CFA).\n" +
      "## Article 3 : Acompte\nL'acheteur verse ce jour un acompte de [ACOMPTE] F CFA ([ACOMPTE_L] francs CFA), dont le vendeur donne quittance. Cet acompte s'imputera sur le prix.\n" +
      "## Article 4 : Acte définitif\nL'acte de vente définitif sera signé au plus tard le [DATE_LIM], contre paiement du solde.\n" +
      "## Article 5 : Désistement\nSi l'acheteur renonce à l'achat, l'acompte reste acquis au vendeur. Si le vendeur renonce à la vente, il restitue l'acompte à l'acheteur.\n" +
      "## Article 6 : Engagement du vendeur\nJusqu'à la date limite, le vendeur s'interdit de vendre ou de promettre ce terrain à un tiers.",
      {chef: true}),

    vente('Vente de maison / villa',
      "ADRESSE_BIEN:Adresse de la maison|DESCRIPTION:Description (nombre de pièces, dépendances...):a|ORIGINE:Origine de propriété (titre foncier, permis d'occuper, acte d'achat...)|" + PAIE,
      "## Article 1 : Objet\nLe vendeur vend à l'acheteur, qui accepte, la maison située à [ADRESSE_BIEN], comprenant : [DESCRIPTION].\n" +
      "## Article 2 : Origine de propriété\nLe vendeur déclare détenir ce bien en vertu de : [ORIGINE].\n" +
      "## Article 3 : Prix et paiement\nLa vente est conclue moyennant le prix de [PRIX] F CFA ([PRIX_L] francs CFA), payé [MODE]. Le vendeur en donne quittance pour les sommes déjà reçues.\n" +
      "## Article 4 : Garantie\nLe vendeur garantit que la maison est libre de toute hypothèque, occupation et litige, et que les factures d'eau et d'électricité sont à jour à la date de la vente.\n" +
      "## Article 5 : Remise des clés et des documents\nLe vendeur remet à l'acheteur, à la signature, les clés et tous les documents relatifs au bien.\n" +
      "## Article 6 : Frais et régularisation\nLes frais de mutation et d'enregistrement sont à la charge de l'acheteur. Les parties s'engagent à régulariser la vente devant le notaire et les services compétents.\n" +
      "## Article 7 : Litiges\nTout différend sera réglé à l'amiable ; à défaut, par les juridictions maliennes compétentes."),

    vente('Vente de champ / terrain agricole',
      "VILLAGE:Village / commune|SUPERFICIE:Superficie (hectares)|LIMITES:Limites du champ (Nord, Sud, Est, Ouest):a|ORIGINE:Origine du droit (héritage, attribution coutumière, achat...)|CULTURE:Culture ou usage actuel|" + PAIE,
      "## Article 1 : Objet\nLe vendeur vend à l'acheteur, qui accepte, le champ situé à [VILLAGE], d'une superficie de [SUPERFICIE] hectares, actuellement utilisé pour : [CULTURE].\n" +
      "## Article 2 : Limites\n[LIMITES]\n" +
      "## Article 3 : Origine du droit\nLe vendeur déclare détenir ce champ en vertu de : [ORIGINE], sans contestation de la part de sa famille ou de tiers.\n" +
      "## Article 4 : Prix et paiement\nLa vente est conclue moyennant le prix de [PRIX] F CFA ([PRIX_L] francs CFA), payé [MODE]. Le vendeur en donne quittance pour les sommes déjà reçues.\n" +
      "## Article 5 : Jouissance\nL'acheteur entre en jouissance du champ à compter de ce jour.\n" +
      "## Article 6 : Litiges\nTout différend sera réglé à l'amiable, avec l'appui des autorités locales ; à défaut, par les juridictions maliennes compétentes.",
      {chef: true}),

    vente('Vente de boutique / fonds de commerce',
      "BOUTIQUE:Désignation (enseigne, adresse)|ACTIVITE:Activité exercée|ELEMENTS:Éléments cédés (stock, matériel, clientèle, droit au bail...):a|BAIL:Situation du local (propriétaire, loyer, bail)|" + PAIE,
      "## Article 1 : Objet\nLe vendeur cède à l'acheteur, qui accepte, la boutique [BOUTIQUE], exerçant l'activité de [ACTIVITE], avec les éléments suivants : [ELEMENTS].\n" +
      "## Article 2 : Local\nSituation du local : [BAIL].\n" +
      "## Article 3 : Prix et paiement\nLa cession est conclue moyennant le prix de [PRIX] F CFA ([PRIX_L] francs CFA), payé [MODE]. Le vendeur en donne quittance pour les sommes déjà reçues.\n" +
      "## Article 4 : Garantie\nLe vendeur garantit que l'établissement est libre de toute dette, saisie ou litige, et prend en charge les dettes et impôts antérieurs à ce jour.\n" +
      "## Article 5 : Prise de possession\nL'acheteur prend possession de la boutique à compter de ce jour.\n" +
      "## Article 6 : Litiges\nTout différend sera réglé à l'amiable ; à défaut, par les juridictions maliennes compétentes."),

    vente('Vente de bétail',
      "ESPECE:Espèce (bovins, ovins, caprins...)|NB:Nombre de têtes|DESCRIPTION:Description des animaux (sexe, âge, signes distinctifs):a|" + PAIE,
      "## Article 1 : Objet\nLe vendeur vend à l'acheteur, qui accepte, [NB] tête(s) de [ESPECE] : [DESCRIPTION].\n" +
      "## Article 2 : Prix et paiement\nLa vente est conclue moyennant le prix de [PRIX] F CFA ([PRIX_L] francs CFA), payé [MODE]. Le vendeur en donne quittance pour les sommes déjà reçues.\n" +
      "## Article 3 : Garantie\nLe vendeur déclare être le propriétaire des animaux, qui ne sont ni volés ni objet de litige. Les animaux sont vendus en l'état, l'acheteur ayant pu les examiner.\n" +
      "## Article 4 : Remise\nLes animaux sont remis à l'acheteur à la signature, avec le carnet de vaccination le cas échéant. Les risques sont à la charge de l'acheteur à compter de la remise."),

    vente("Vente de matériel informatique / téléphone d'occasion",
      "ARTICLE:Article(s) vendu(s) (marque, modèle):a|SERIE:N° de série / IMEI|ETAT:État:s:bon état de fonctionnement,fonctionne avec défauts signalés,en panne (vendu pour pièces)|DEFAUTS:Défauts signalés (facultatif)|GARANTIE:Garantie:s:aucune garantie,garantie de 7 jours,garantie de 1 mois|" + PAIE,
      "## Article 1 : Objet\nLe vendeur vend à l'acheteur : [ARTICLE], n° de série / IMEI : [SERIE].\n" +
      "## Article 2 : État\nL'article est vendu en [ETAT]. Défauts signalés : [DEFAUTS].\n" +
      "## Article 3 : Prix et paiement\nLa vente est conclue moyennant le prix de [PRIX] F CFA ([PRIX_L] francs CFA), payé [MODE].\n" +
      "## Article 4 : Garantie\nGarantie accordée : [GARANTIE]. Elle ne couvre pas la foudre, les chocs, l'humidité ni toute intervention extérieure.\n" +
      "## Article 5 : Propriété\nLe vendeur déclare être le propriétaire de l'article, qui n'est ni volé ni gagé."),

    D('Vente & Commerce', 'Contrat de vente par acomptes',
      "VENDEUR:Nom du vendeur|ACHETEUR:Nom de l'acheteur|BIEN:Bien vendu (description):a|PRIX:Prix total (F CFA):m|ACOMPTE:Acompte versé ce jour (F CFA):m|NB_ECH:Nombre d'échéances|MONTANT_ECH:Montant de chaque échéance (F CFA):m|PERIODE:Périodicité (ex. chaque fin de mois)|DATE_PREM:Date de la première échéance:d|" + TEM,
      "Entre [VENDEUR], ci-après le vendeur, et [ACHETEUR], ci-après l'acheteur, il a été convenu ce qui suit :\n" +
      "## Article 1 : Objet\nLe vendeur vend à l'acheteur : [BIEN].\n" +
      "## Article 2 : Prix\nLe prix total est de [PRIX] F CFA ([PRIX_L] francs CFA).\n" +
      "## Article 3 : Paiement\nL'acheteur verse ce jour un acompte de [ACOMPTE] F CFA ([ACOMPTE_L] francs CFA), puis règle le solde en [NB_ECH] échéance(s) de [MONTANT_ECH] F CFA ([MONTANT_ECH_L] francs CFA) chacune, [PERIODE], la première échéance étant fixée au [DATE_PREM].\n" +
      "## Article 4 : Propriété\nLe bien est remis à l'acheteur ce jour, mais la propriété ne lui est transférée qu'après paiement intégral du prix.\n" +
      "## Article 5 : Défaut de paiement\nSi une échéance n'est pas payée huit jours après mise en demeure, la totalité du solde devient immédiatement exigible.\n" +
      "## Article 6 : Litiges\nTout différend sera réglé à l'amiable ; à défaut, par les juridictions maliennes compétentes." + TEMF,
      {sigs: SIG_V.concat(SIG_T)}),

    D('Vente & Commerce', "Reçu d'acompte sur vente",
      "VENDEUR:Nom du vendeur|ACHETEUR:Nom de l'acheteur|BIEN:Bien concerné:a|PRIX:Prix total (F CFA):m|ACOMPTE:Acompte reçu (F CFA):m|RESTE:Reste à payer (F CFA):m|DATE_LIM:Solde à payer avant le:d|" + TEM,
      "Je soussigné(e) [VENDEUR], vendeur, reconnais avoir reçu de Monsieur/Madame [ACHETEUR] la somme de [ACOMPTE] F CFA ([ACOMPTE_L] francs CFA), à titre d'acompte sur le prix total de [PRIX] F CFA ([PRIX_L] francs CFA) concernant : [BIEN].\n" +
      "Le reste à payer est de [RESTE] F CFA ([RESTE_L] francs CFA), à régler avant le [DATE_LIM].\n" +
      "Tant que le prix n'est pas intégralement payé, le vendeur s'engage à ne pas vendre ce bien à un tiers." + TEMF,
      {tdoc: "REÇU D'ACOMPTE SUR VENTE", sigs: SIG_V.concat(SIG_T)})
  );

  /* ---------- 3) Mise en page des signatures : 2 par ligne ---------- */
  // Avec 4 ou 5 signatures (vendeur, acheteur, 2 témoins, visa), on les répartit sur plusieurs lignes.
  const construireBase = construire;
  construire = function (m, v) {
    const B = construireBase(m, v);
    if (m.type === 'd' && m.sigs && m.sigs.length > 2) {
      const t = B.length ? B[B.length - 1].tbl : null;
      if (t && t.rows.length === 1 && t.rows[0].length === m.sigs.length) {
        const cells = t.rows[0], rows = [];
        for (let i = 0; i < cells.length; i += 2) {
          const r = cells.slice(i, i + 2);
          while (r.length < 2) r.push({blocs: [{runs: [{x: ''}], sa: 0}]});
          rows.push(r);
        }
        t.rows = rows; t.w = [50, 50];
      }
    }
    return B;
  };

  /* ---------- 4) Rafraîchir la liste des modèles ---------- */
  if (typeof afficherAccueil === 'function') afficherAccueil();
})();
