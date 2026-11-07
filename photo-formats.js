/* SAMASSA TECHNOLOGIE — Formats de photos d'identité par pays/document + calcul de planche.
   verifie=1 : dimensions confirmées par une source officielle/publique consultée ; 0 : norme ICAO courante à confirmer auprès de l'autorité. */
'use strict';
(function () {
  /* [code, pays, document, largeur mm, hauteur mm, tête min, tête max, fond, vérifié] */
  var T = [
    /* Mali et voisins */
    ['ML', 'Mali', 'Passeport biométrique', 35, 45, 32, 36, 'Blanc ou clair uni', 0], ['ML', 'Mali', 'Carte NINA / CNI', 35, 45, 32, 36, 'Blanc ou clair uni', 0], ['ML', 'Mali', 'Visa / autres démarches', 35, 45, 32, 36, 'Blanc ou clair uni', 0],
    ['SN', 'Sénégal', 'Passeport / CNI', 35, 45, 32, 36, 'Blanc uni', 0], ['CI', "Côte d'Ivoire", 'Passeport / CNI', 35, 45, 32, 36, 'Blanc uni', 0],
    ['BF', 'Burkina Faso', 'Passeport / CNIB', 35, 45, 32, 36, 'Blanc uni', 0], ['NE', 'Niger', 'Passeport / CNI', 35, 45, 32, 36, 'Blanc uni', 0],
    ['GN', 'Guinée', 'Passeport / CNI', 35, 45, 32, 36, 'Blanc uni', 0], ['MR', 'Mauritanie', 'Passeport / CNI', 35, 45, 32, 36, 'Blanc uni', 0],
    ['BJ', 'Bénin', 'Passeport / CNI', 35, 45, 32, 36, 'Blanc uni', 0], ['TG', 'Togo', 'Passeport / CNI', 35, 45, 32, 36, 'Blanc uni', 0],
    ['GH', 'Ghana', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['NG', 'Nigeria', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0],
    ['GM', 'Gambie', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['GW', 'Guinée-Bissau', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0],
    ['SL', 'Sierra Leone', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['LR', 'Liberia', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['CV', 'Cap-Vert', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0],
    /* Afrique centrale, est, nord, sud */
    ['CM', 'Cameroun', 'Passeport / CNI', 35, 45, 32, 36, 'Blanc uni', 0], ['GA', 'Gabon', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['CG', 'Congo', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0],
    ['CD', 'RD Congo', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['TD', 'Tchad', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['CF', 'Centrafrique', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0],
    ['MG', 'Madagascar', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['KE', 'Kenya', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['ET', 'Éthiopie', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0],
    ['MA', 'Maroc', 'Passeport / CNIE', 35, 45, 32, 36, 'Blanc uni', 0], ['DZ', 'Algérie', 'Passeport / CNI', 35, 45, 32, 36, 'Blanc uni', 0], ['TN', 'Tunisie', 'Passeport / CIN', 35, 45, 32, 36, 'Blanc uni', 0],
    ['EG', 'Égypte', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['ZA', 'Afrique du Sud', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0],
    /* Europe */
    ['FR', 'France', 'Passeport / CNI / titre de séjour', 35, 45, 32, 36, 'Clair uni (gris très clair/bleu clair/blanc cassé), sans ombre', 0], ['FR', 'France', 'Visa pour la France / Schengen', 35, 45, 32, 36, 'Clair uni', 0],
    ['BE', 'Belgique', 'Passeport / CI', 35, 45, 32, 36, 'Clair uni', 0], ['CH', 'Suisse', 'Passeport / CI', 35, 45, 32, 36, 'Clair uni', 0], ['DE', 'Allemagne', 'Passeport / CI', 35, 45, 32, 36, 'Clair uni', 0],
    ['IT', 'Italie', 'Passeport / CI', 35, 45, 32, 36, 'Clair uni', 0], ['PT', 'Portugal', 'Passeport / CC', 35, 45, 32, 36, 'Clair uni', 0], ['NL', 'Pays-Bas', 'Passeport / CI', 35, 45, 32, 36, 'Clair uni', 0],
    ['LU', 'Luxembourg', 'Passeport / CI', 35, 45, 32, 36, 'Clair uni', 0], ['PL', 'Pologne', 'Passeport', 35, 45, 32, 36, 'Blanc, éclairage régulier', 1], ['EU', 'Espace Schengen', 'Visa Schengen', 35, 45, 32, 36, 'Clair uni', 0],
    ['GB', 'Royaume-Uni', 'Passeport', 35, 45, 29, 34, 'Crème ou gris clair uni', 1], ['IE', 'Irlande', 'Passeport', 35, 45, 32, 36, 'Clair uni', 0], ['TR', 'Turquie', 'Passeport / visa', 50, 60, 32, 40, 'Blanc uni', 0], ['RU', 'Russie', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0],
    /* Amériques */
    ['US', 'États-Unis', 'Passeport / visa', 51, 51, 25, 35, 'Blanc ou blanc cassé', 1], ['CA', 'Canada', 'Passeport / visa / résidence', 50, 70, 31, 36, 'Blanc ou clair uni', 1],
    ['MX', 'Mexique', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['BR', 'Brésil', 'Passeport', 50, 70, 32, 44, 'Blanc uni', 0], ['AR', 'Argentine', 'Passeport', 40, 40, 25, 32, 'Blanc uni', 0],
    /* Asie, Moyen-Orient, Océanie */
    ['CN', 'Chine', 'Visa', 33, 48, 28, 33, 'Blanc', 1], ['JP', 'Japon', 'Passeport / visa', 35, 45, 32, 36, 'Blanc uni', 1], ['KR', 'Corée du Sud', 'Passeport / visa', 35, 45, 32, 36, 'Blanc uni', 1],
    ['IN', 'Inde', 'Passeport / visa', 51, 51, 25, 35, 'Blanc uni', 0], ['PK', 'Pakistan', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['HK', 'Hong Kong', 'Passeport / visa', 40, 50, 32, 36, 'Uni', 1],
    ['SG', 'Singapour', 'Passeport / visa', 35, 45, 25, 36, 'Blanc uni', 1], ['VN', 'Vietnam', 'Passeport / visa', 40, 60, 32, 44, 'Blanc uni', 0], ['TH', 'Thaïlande', 'Visa', 35, 45, 32, 36, 'Blanc uni', 0],
    ['ID', 'Indonésie', 'Visa', 40, 60, 32, 44, 'Rouge ou blanc selon le service', 0], ['PH', 'Philippines', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0], ['MY', 'Malaisie', 'Passeport / visa', 35, 50, 32, 40, 'Blanc uni', 0],
    ['SA', 'Arabie saoudite', 'Visa / Hajj', 40, 60, 32, 44, 'Blanc uni', 0], ['AE', 'Émirats arabes unis', 'Visa', 43, 55, 32, 40, 'Blanc uni', 0], ['QA', 'Qatar', 'Visa', 35, 45, 32, 36, 'Blanc uni', 0],
    ['AU', 'Australie', 'Passeport / visa', 35, 45, 32, 36, 'Blanc ou gris clair', 1], ['NZ', 'Nouvelle-Zélande', 'Passeport', 35, 45, 32, 36, 'Blanc uni', 0],
    /* Formats génériques */
    ['--', 'Format libre', 'Photo 35 × 45 mm (norme ICAO)', 35, 45, 32, 36, 'Blanc uni', 0], ['--', 'Format libre', 'Photo 4 × 4 cm', 40, 40, 26, 34, 'Blanc uni', 0], ['--', 'Format libre', 'Photo 3 × 4 cm', 30, 40, 24, 32, 'Blanc uni', 0],
    ['--', 'Format libre', 'Photo 2,5 × 3 cm', 25, 30, 20, 25, 'Blanc uni', 0], ['--', 'Format libre', 'Photo 4 × 6 cm', 40, 60, 32, 44, 'Blanc uni', 0], ['--', 'Format libre', 'Photo 2 × 2 pouces (51 × 51 mm)', 51, 51, 25, 35, 'Blanc uni', 0]
  ].map(function (r, i) { return { id: i, code: r[0], pays: r[1], doc: r[2], w: r[3], h: r[4], teteMin: r[5], teteMax: r[6], fond: r[7], verifie: !!r[8] }; });

  var FEUILLES = { '10x15': { nom: '10 × 15 cm (photo)', w: 100, h: 150 }, '13x18': { nom: '13 × 18 cm (photo)', w: 130, h: 180 }, 'a4': { nom: 'A4 (21 × 29,7 cm)', w: 210, h: 297 }, '15x20': { nom: '15 × 20 cm', w: 150, h: 200 } };

  /* Nombre maximal de photos sur une feuille (portrait ou paysage), marge et écart en mm */
  function grille(fw, fh, w, h, marge, ecart) {
    function essai(W, H, pw, ph) { var c = Math.floor((W - 2 * marge + ecart) / (pw + ecart)), r = Math.floor((H - 2 * marge + ecart) / (ph + ecart)); return { cols: Math.max(0, c), rows: Math.max(0, r), n: Math.max(0, c) * Math.max(0, r) }; }
    var a = essai(fw, fh, w, h), b = essai(fw, fh, h, w), c = essai(fh, fw, w, h);
    var best = { paysage: false, tourne: false, w: fw, h: fh, pw: w, ph: h }; Object.assign(best, a);
    if (b.n > best.n) { best = Object.assign({ paysage: false, tourne: true, w: fw, h: fh, pw: h, ph: w }, b); }
    if (c.n > best.n) { best = Object.assign({ paysage: true, tourne: false, w: fh, h: fw, pw: w, ph: h }, c); }
    return best;
  }
  var api = { FORMATS: T, FEUILLES: FEUILLES, grille: grille };
  if (typeof window !== 'undefined') window.PhotoFormats = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
