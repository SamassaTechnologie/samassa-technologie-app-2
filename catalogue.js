/* Catalogue en ligne sans serveur : les données sont encodées dans le lien (#c=...). Le lien se partage sur WhatsApp. */
'use strict';
(function (root) {
  function b64u(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function deb64u(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  async function flux(bytes, Ctor, fmt) { var cs = new Ctor(fmt), w = cs.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
  /* data = {s:{n,t,a}, i:[[nom,prix,categorie],...]} → 'g…' (gzip) ou 'p…' (brut) */
  async function encoder(data) {
    var bytes = new TextEncoder().encode(JSON.stringify(data));
    try { if (typeof CompressionStream !== 'undefined') { var z = await flux(bytes, CompressionStream, 'gzip'); return 'g' + b64u(z); } } catch (e) {}
    return 'p' + b64u(bytes);
  }
  async function decoder(txt) {
    var m = txt.charAt(0), b = deb64u(txt.slice(1));
    if (m === 'g') b = await flux(b, DecompressionStream, 'gzip');
    var d = JSON.parse(new TextDecoder().decode(b)); if (!d || !Array.isArray(d.i)) throw new Error('catalogue invalide'); return d;
  }
  function numWa(t) { var n = String(t || '').replace(/\D/g, ''); if (n.length > 8 && n.indexOf('223') !== 0) n = n.slice(0, 8); return n.length === 8 ? '223' + n : n; }
  function lienCommande(tel, boutique, article, prix) { return 'https://wa.me/' + numWa(tel) + '?text=' + encodeURIComponent('Bonjour ' + (boutique || '') + ', je souhaite commander : ' + article + (Number(prix) > 0 ? ' (' + Number(prix).toLocaleString('fr-FR') + ' FCFA)' : '') + '. Pouvez-vous me donner le prix et la disponibilité ?'); }
  /* Construit les articles : stock (pv > 0, qty > 0, non exclus) + services personnalisés */
  function articles(stock, cfg) {
    var ex = {}; (cfg.exclus || []).forEach(function (id) { ex[id] = 1; });
    var l = (stock || []).filter(function (s) { return Number(s.pv) > 0 && Number(s.qty) > 0 && !ex[s.id]; }).map(function (s) { return [String(s.name), Math.round(Number(s.pv)), String(s.cat || 'Matériel')]; });
    (cfg.services || []).forEach(function (s) { if (s.n && Number(s.p) >= 0) l.push([String(s.n), Math.round(Number(s.p)), String(s.c || 'Services')]); });
    return l;
  }
  root.Catalogue = { encoder: encoder, decoder: decoder, lienCommande: lienCommande, articles: articles, numWa: numWa };
})(typeof window !== 'undefined' ? window : globalThis);
