// Schrift als Umriss für 3D: Der Text wird mit der Systemschrift des Geräts in ein Canvas gemalt, die Kanten werden
// mit Marching Squares nachgezeichnet (Konturen mit Löchern, glatt durch lineare Zwischenwerte) und vereinfacht.
// Heraus kommen geschlossene Konturen, die geometrie.js zu 3D-Buchstaben aufzieht. Läuft nur im Browser.
(function (global) {
  'use strict';

  // Kanten der Zelle: T oben, R rechts, B unten, L links. Bits der Ecken: oben links 1, oben rechts 2, unten rechts 4, unten links 8.
  const FAELLE = {
    1: [['L', 'T']], 2: [['T', 'R']], 3: [['L', 'R']], 4: [['R', 'B']], 6: [['T', 'B']], 7: [['L', 'B']], 8: [['L', 'B']],
    9: [['T', 'B']], 11: [['R', 'B']], 12: [['L', 'R']], 13: [['T', 'R']], 14: [['L', 'T']],
  };

  function konturenAusFeld(f, B, H, schwelle) {
    const innen = (x, y) => f[y * B + x] >= schwelle;
    const kante = (art, x, y) => (art === 'T' ? 2 * (y * B + x) : art === 'B' ? 2 * ((y + 1) * B + x) : art === 'L' ? 2 * (y * B + x) + 1 : 2 * (y * B + x + 1) + 1);
    const nachbarn = new Map();
    const verbinden = (a, b) => {
      if (!nachbarn.has(a)) nachbarn.set(a, []);
      if (!nachbarn.has(b)) nachbarn.set(b, []);
      nachbarn.get(a).push(b); nachbarn.get(b).push(a);
    };
    for (let y = 0; y < H - 1; y += 1) {
      for (let x = 0; x < B - 1; x += 1) {
        const fall = (innen(x, y) ? 1 : 0) | (innen(x + 1, y) ? 2 : 0) | (innen(x + 1, y + 1) ? 4 : 0) | (innen(x, y + 1) ? 8 : 0);
        let teile = FAELLE[fall];
        if (fall === 5 || fall === 10) {                                    // Sattel: die Mitte entscheidet, ob die Ecken zusammenhängen
          const mitte = (f[y * B + x] + f[y * B + x + 1] + f[(y + 1) * B + x] + f[(y + 1) * B + x + 1]) / 4 >= schwelle;
          if (fall === 5) teile = mitte ? [['T', 'R'], ['L', 'B']] : [['L', 'T'], ['R', 'B']];
          else teile = mitte ? [['L', 'T'], ['R', 'B']] : [['T', 'R'], ['L', 'B']];
        }
        if (teile) teile.forEach(([a, b]) => verbinden(kante(a, x, y), kante(b, x, y)));
      }
    }
    // Punkt einer Kante: lineare Zwischenstelle zwischen den beiden Pixeln
    const punkt = (id) => {
      const waagrecht = id % 2 === 0; const z = id >> 1; const x = z % B; const y = Math.floor(z / B);
      const x1 = waagrecht ? x + 1 : x; const y1 = waagrecht ? y : y + 1;
      const v0 = f[y * B + x]; const v1 = f[y1 * B + x1];
      const t = v1 === v0 ? 0.5 : Math.min(1, Math.max(0, (schwelle - v0) / (v1 - v0)));
      return [x + (x1 - x) * t, y + (y1 - y) * t];
    };
    const benutzt = new Set(); const schleifen = [];
    nachbarn.forEach((_, start) => {
      if (benutzt.has(start)) return;
      const ids = []; let davor = -1; let jetzt = start;
      while (!benutzt.has(jetzt)) {
        benutzt.add(jetzt); ids.push(jetzt);
        const n = nachbarn.get(jetzt); const weiter = n[0] !== davor && !benutzt.has(n[0]) ? n[0] : n[1];
        if (weiter === undefined || benutzt.has(weiter)) break;
        davor = jetzt; jetzt = weiter;
      }
      if (ids.length > 8) schleifen.push(ids.map(punkt));
    });
    return schleifen;
  }

  // Douglas-Peucker für geschlossene Linienzüge
  function vereinfachen(k, eps) {
    const abstand = (p, a, b) => {
      const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = dx * dx + dy * dy;
      if (l === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l));
      return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    };
    const rec = (a, b, aus) => {
      let m = 0; let mi = -1;
      for (let i = a + 1; i < b; i += 1) { const d = abstand(k[i], k[a], k[b]); if (d > m) { m = d; mi = i; } }
      if (m > eps) { rec(a, mi, aus); aus.push(mi); rec(mi, b, aus); }
    };
    const halb = Math.floor(k.length / 2); const aus = [0];
    rec(0, halb, aus); aus.push(halb); rec(halb, k.length - 1, aus); aus.push(k.length - 1);
    const r = aus.map((i) => k[i]);
    return r.length > 3 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
  }

  // text: Zeichenkette, schrift: CSS-Schriftangabe mit Pixelgröße. Rückgabe in Pixeln, y nach oben, Ursprung in der Mitte der Textbox;
  // kapitale = Höhe eines Großbuchstabens in Pixeln (zum Umrechnen in Weltmaße).
  function konturen(text, schrift) {
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = schrift;
    const m = probe.measureText(text);
    const kap = probe.measureText('H');
    const rand = 16;
    const asc = Math.ceil(Math.max(m.actualBoundingBoxAscent || 0, kap.actualBoundingBoxAscent || 0));
    const desc = Math.ceil(Math.max(m.actualBoundingBoxDescent || 0, 0));
    const B = Math.ceil(m.width) + rand * 2; const H = asc + desc + rand * 2;
    if (!(B > 40 && H > 20) || B > 6000) throw new Error('Schrift nicht messbar');
    const cv = document.createElement('canvas'); cv.width = B; cv.height = H;
    const c = cv.getContext('2d');
    c.font = schrift; c.fillStyle = '#fff'; c.textBaseline = 'alphabetic'; c.fillText(text, rand, rand + asc);
    const px = c.getImageData(0, 0, B, H).data;
    const f = new Float32Array(B * H);
    for (let i = 0; i < f.length; i += 1) f[i] = px[i * 4 + 3] / 255;
    const roh = konturenAusFeld(f, B, H, 0.5);
    const mx = B / 2; const my = rand + asc / 2;                       // Mitte der Großbuchstaben
    const k = roh.map((s) => vereinfachen(s, 0.45).map((p) => [p[0] - mx, -(p[1] - my)]));
    return { konturen: k.filter((s) => s.length > 5), breite: m.width, kapitale: kap.actualBoundingBoxAscent || asc * 0.72, mitteX: (rand + m.width / 2) - mx };
  }

  global.TBSchrift = { konturen };
}(window));
