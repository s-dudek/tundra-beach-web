// Tundra Beach unter Wasser (WebGL2): Die Bildmarke schwebt als echter 3D-Körper im Wasser, zwischen Blasen,
// Meeresstaub und Plankton, mit Lichtstrahlen und Lichtmustern. Scrollen fährt die Kamera zu sinnvollen Zoom-Punkten
// (Schnorchel, Brille, Nase, Zahn), an jedem steht ein Textpunkt. Ein Klick darauf fliegt zu einer Tafel im Wasser
// (Wasserstand, Wetter, Uhr, Kalender). Alle Bewegungen laufen über gedämpfte Federn.
// Klappt WebGL nicht, bleibt die flache Bildmarke mit den Inhalten als Text stehen.
(() => {
  'use strict';

  const G = window.TB3D;
  const D = window.TBDaten;
  const T = window.TBTafel;
  const wurzel = document.documentElement;
  const tour = document.getElementById('tour');
  const canvas = document.getElementById('marke3d');
  const hinweis = document.getElementById('hinweis');
  const miniKnopf = document.getElementById('mini');
  const miniCanvas = document.getElementById('mini3d');
  const punkteHalter = document.getElementById('punkte');
  const zurueck = document.getElementById('zurueck');
  const menue = document.getElementById('menue');
  if (!G || !D || !T || !tour || !canvas) return;

  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const abfrage = new URLSearchParams(window.location.search);
  // ?p=0.5 zeigt direkt eine Stelle der Reise (Vorschau/Prüfung), ohne Intro und ohne Scrollen
  const festP = abfrage.has('p') ? Math.min(1, Math.max(0, parseFloat(abfrage.get('p')) || 0)) : null;

  /* ---------- Welche Pfade gehören zur Bildmarke, und wie hoch sind sie? ---------- */
  // Nummern = Reihenfolge der path/polygon-Elemente in gesamt-4c_web.svg (Malreihenfolge, hinten nach vorn).
  // hoehe/fase in Einheiten der Zeichnung (die Marke ist etwa 187 breit).
  const SCHICHTEN = [
    { nr: 26, platte: true, unten: -15, fase: 3.2, glanz: 0.8 },   // gelbes Schild
    { nr: 27, hoehe: 3.2, fase: 0.8, glanz: 0.9 },                  // dunkle Spange
    { nr: 28, hoehe: 3.2, fase: 0.8, glanz: 0.95 },                 // dunkle Linien und Rahmen
    { nr: 31, hoehe: 8, fase: 1.8, glanz: 0.9 },                    // Nase
    { nr: 32, hoehe: 5.6, fase: 1.0, glanz: 0.9 },                  // Zahn
    { nr: 34, hoehe: 5.4, fase: 1.6, glanz: 0.9 },                  // Gesicht
    { nr: 36, hoehe: 6.4, fase: 0.8, glanz: 1.0 },                  // Glanzpunkt im Auge
    { nr: 37, hoehe: 10, fase: 1.5, glanz: 0.95 },                  // Taucherbrille
    { nr: 38, hoehe: 13, fase: 1.6, glanz: 0.95 },                  // Schnorchel
  ];
  const SVG_QUELLE = 'gesamt-4c_web.svg';

  /* ---------- Reise beim Scrollen: sinnvolle Zoom-Punkte, an jedem ein Textpunkt ---------- */
  // Eine Zeile = ein Schlüsselbild bei Scroll-Fortschritt p. Zwei Zeilen mit gleichem Blick = Verweilen am Punkt.
  // gier/nick/roll in Grad, f = Blickpunkt (Marke ist 2 hoch), zoom 1 = ganze Marke im Bild.
  const K = (p, gier, nick, roll, f, zoom) => ({ p, gier, nick, roll, f, zoom });
  const SCHNORCHEL = [-0.7, 0.5, 0.12]; const BRILLE = [-0.24, 0.155, 0.1]; const NASE = [0.55, 0.2, 0.1]; const ZAHN = [-0.05, -0.12, 0.08];
  const BAHN = [
    K(0.00, -18, 6, 0, [0, 0, 0], 1.28),
    K(0.06, -18, 6, 0, [0, 0, 0], 1.28),                        // Überblick
    K(0.17, 24, -12, 4, SCHNORCHEL, 2.1),                      // Schnorchel: Wasserstand
    K(0.23, 24, -12, 4, SCHNORCHEL, 2.1),
    K(0.34, -12, 4, 0, BRILLE, 3.4),                           // Taucherbrille: Wetter
    K(0.40, -12, 4, 0, BRILLE, 3.4),
    K(0.51, 28, -4, -3, NASE, 2.0),                            // Nase: Uhr
    K(0.57, 28, -4, -3, NASE, 2.0),
    K(0.68, -8, 8, 0, ZAHN, 4.0),                              // Zahn: Kalender
    K(0.74, -8, 8, 0, ZAHN, 4.0),
    K(0.80, -196, 12, 0, [0, 0, 0], 1.15),                     // einmal um die Marke herum
    K(0.88, -378, 6, 0, [0, 0, 0], 1.28),                      // zurück in die Anfangsperspektive
    K(1.00, -378, 6, 0, [0, 0, 0], 1.28),
  ];
  // Textpunkte: Mitte im Scroll-Fortschritt, Ankerpunkt an der Marke, Lage des Textes (px zum Anker)
  const PUNKTE = [
    { ziel: 'wasserstand', titel: 'Wasserstand', unter: 'Isel · Lienz', p: 0.20, anker: SCHNORCHEL, dx: -190, dy: -80 },
    { ziel: 'wetter', titel: 'Wetter', unter: 'Lienz', p: 0.37, anker: BRILLE, dx: -210, dy: -130 },
    { ziel: 'uhr', titel: 'Uhr', unter: 'Die Nase vorn', p: 0.54, anker: NASE, dx: 70, dy: -150 },
    { ziel: 'kalender', titel: 'Kalender', unter: 'Der Zahn der Zeit', p: 0.71, anker: ZAHN, dx: 150, dy: 70 },
    { ziel: 'anfang', titel: 'Zum Anfang', unter: 'Noch einmal eintauchen', p: 0.94, anker: [0, -1.05, 0.1], dx: 0, dy: 60 },
  ];

  /* ---------- Tafeln im Wasser: Ring um die Marke, zur Marke gewandt ---------- */
  const R_TAFEL = 17;
  const TAFELN = {
    wasserstand: { winkel: 250, hoehe: -1.8 },
    wetter: { winkel: 292, hoehe: 1.4 },
    uhr: { winkel: 68, hoehe: -1.2 },
    kalender: { winkel: 112, hoehe: 1.8 },
  };
  const TAFEL_B = 3.0; const TAFEL_H = 2.0; const TAFEL_DICKE = 0.16;

  /* ---------- Zeiten ---------- */
  const INTRO = 7.5;          // Sekunden: Auftauchen
  const SCROLL_GLATT = 0.6;   // so weich folgt die Kamera dem Scrollen
  const ZIEH_GLATT = 0.12;    // so weich folgt die Marke dem Finger
  const AUSLAUF = 0.55;       // Schwung nach dem Loslassen
  const RUECK_GLATT = 1.6;    // so weich dreht sie nach Ruhe zurück
  const RUHE = 2.4;           // Sekunden ohne Berühren bis zum Zurückdrehen
  const FLUG = 2.8;           // Sekunden, in denen die Kamera zwischen Start und Tafel fliegt

  /* ---------- Hilfen ---------- */
  function glatt(aktuell, ziel, geschw, zeit, dt) {
    const omega = 2 / Math.max(0.0001, zeit);
    const x = omega * dt;
    const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const aenderung = aktuell - ziel;
    const temp = (geschw.v + omega * aenderung) * dt;
    geschw.v = (geschw.v - omega * temp) * e;
    return ziel + (aenderung + temp) * e;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut4 = (t) => 1 - (1 - t) ** 4;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const rad = (g) => (g * Math.PI) / 180;
  const umbruch = (g) => ((((g + 180) % 360) + 360) % 360) - 180;

  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t; const t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  function bahnWert(p) {
    const n = BAHN.length;
    let i = 0;
    while (i < n - 2 && p > BAHN[i + 1].p) i += 1;
    const a = BAHN[i]; const b = BAHN[i + 1];
    const t = clamp((p - a.p) / (b.p - a.p));
    const werte = (k) => [k.gier, k.nick, k.roll, k.f[0], k.f[1], k.f[2], Math.log(k.zoom)];
    const w0 = werte(BAHN[Math.max(0, i - 1)]); const w1 = werte(a); const w2 = werte(b); const w3 = werte(BAHN[Math.min(n - 1, i + 2)]);
    const r = w1.map((_, j) => catmull(w0[j], w1[j], w2[j], w3[j], t));
    return { gier: r[0], nick: r[1], roll: r[2], f: [r[3], r[4], r[5]], zoom: Math.exp(r[6]) };
  }

  /* ---------- Matrizen (spaltenweise, wie WebGL) ---------- */
  const mat = {
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      return o;
    },
    ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    persp(fov, asp, n, f) {
      const t = 1 / Math.tan(fov / 2);
      return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
    },
    ortho(l, r, b, t, n, f) {
      return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
    },
    blick(e, z, u) {
      const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
      const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const f = norm([z[0] - e[0], z[1] - e[1], z[2] - e[2]]);
      const s = norm(kreuz(f, u));
      const v = kreuz(s, f);
      return new Float32Array([s[0], v[0], -f[0], 0, s[1], v[1], -f[1], 0, s[2], v[2], -f[2], 0,
        -(s[0] * e[0] + s[1] * e[1] + s[2] * e[2]), -(v[0] * e[0] + v[1] * e[1] + v[2] * e[2]), f[0] * e[0] + f[1] * e[1] + f[2] * e[2], 1]);
    },
    verschieben(x, y, z) { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); },
    dreheX(a) { const c = Math.cos(a); const s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
    dreheY(a) { const c = Math.cos(a); const s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
    dreheZ(a) { const c = Math.cos(a); const s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  };

  const linear = (hex) => {
    const h = hex.replace('#', '');
    const voll = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => (parseInt(voll.slice(i, i + 2), 16) / 255) ** 2.2);
  };

  /* ---------- Körper bauen ---------- */
  function ausgeben(teile) {
    const pos = []; const nor = []; const farbe = []; const par = []; const idx = [];
    teile.forEach((t) => {
      const basis = pos.length / 3;
      for (let i = 0; i < t.k.pos.length / 3; i += 1) {
        pos.push(t.k.pos[i * 3], t.k.pos[i * 3 + 1], t.k.pos[i * 3 + 2]);
        nor.push(t.k.nor[i * 3], t.k.nor[i * 3 + 1], t.k.nor[i * 3 + 2]);
        farbe.push(t.rgb[0], t.rgb[1], t.rgb[2]);
        par.push(t.glanz, t.k.hoehe[i], t.rang);
      }
      t.k.idx.forEach((i) => idx.push(basis + i));
    });
    const daten = new Float32Array((pos.length / 3) * 12);
    for (let i = 0; i < pos.length / 3; i += 1) {
      daten.set(pos.slice(i * 3, i * 3 + 3), i * 12);
      daten.set(nor.slice(i * 3, i * 3 + 3), i * 12 + 3);
      daten.set(farbe.slice(i * 3, i * 3 + 3), i * 12 + 6);
      daten.set(par.slice(i * 3, i * 3 + 3), i * 12 + 9);
    }
    return { daten, indizes: new Uint32Array(idx) };
  }

  function koerperAusSvg(text) {
    // Farben aus dem style-Block lesen und den Block vor dem Parsen entfernen (die Seiten-CSP erlaubt keine Inline-Styles)
    const farben = {};
    text.replace(/\.(cls-\d+)\s*\{[^}]*?fill:\s*(#[0-9a-fA-F]{3,6})/g, (_, k, f) => { farben[k] = f; });
    const doc = new DOMParser().parseFromString(text.replace(/<style[\s\S]*?<\/style>/, ''), 'image/svg+xml');
    const alle = [...doc.querySelectorAll('path, polygon')];

    const platte = alle[SCHICHTEN[0].nr];
    const dPlatte = platte && platte.getAttribute('d');
    if (!dPlatte) throw new Error('Schild nicht gefunden');
    const kPlatte = G.pfadLesen(dPlatte, 0.8).flat();
    const xs = kPlatte.map((p) => p[0]); const ys = kPlatte.map((p) => p[1]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    if (maxX - minX < 150 || maxX - minX > 230 || maxY - minY < 150 || maxY - minY > 230) throw new Error('Maße der Marke unerwartet');
    const mx = (minX + maxX) / 2; const my = (minY + maxY) / 2;
    const s = 2 / (maxY - minY); // Marke ist 2 Einheiten hoch

    const teile = [];
    SCHICHTEN.forEach((sch, rang) => {
      const el = alle[sch.nr];
      const d = el && el.getAttribute('d');
      if (!d) return;
      const rgb = linear(farben[el.getAttribute('class')] || '#2c2c2b');
      const konturen = G.pfadLesen(d, 0.8).map((k) => k.map((p) => [(p[0] - mx) * s, -(p[1] - my) * s]));
      G.polygone(konturen).forEach((pg) => {
        const k = G.koerperBauen(pg, {
          unten: sch.platte ? sch.unten * s : 0, oben: sch.platte ? 0 : sch.hoehe * s,
          fasenOben: sch.fase * s, fasenUnten: sch.platte ? sch.fase * s : 0, unterseite: !!sch.platte, stufen: 5, abtastung: 0.5 * s,
        });
        teile.push({ k, rgb, glanz: sch.glanz, rang });
      });
    });
    return ausgeben(teile);
  }

  // Tafel: gelbe Emaille-Platte mit abgerundeten Ecken (wie das Schild der Marke), darauf die Textur
  function tafelKoerper() {
    const b = TAFEL_B / 2; const h = TAFEL_H / 2; const r = 0.24; const kontur = [];
    [[b - r, h - r, 0], [-b + r, h - r, 90], [-b + r, -h + r, 180], [b - r, -h + r, 270]].forEach(([cx, cy, w0]) => {
      for (let i = 0; i <= 10; i += 1) { const w = rad(w0 + (i / 10) * 90); kontur.push([cx + Math.cos(w) * r, cy + Math.sin(w) * r]); }
    });
    const teile = [];
    G.polygone([kontur]).forEach((pg) => {
      const k = G.koerperBauen(pg, { unten: -TAFEL_DICKE, oben: 0, fasenOben: 0.07, fasenUnten: 0.07, unterseite: true, stufen: 5, abtastung: 0.05 });
      teile.push({ k, rgb: linear('#fbba00'), glanz: 0.85, rang: 0 });
    });
    return ausgeben(teile);
  }

  /* ---------- Shader ---------- */
  const KAUSTIK = `
  float kaustik(vec2 p, float t){
    vec2 a = p * 1.6; float v = 0.0;
    for (int i = 0; i < 4; i++) {
      a += vec2(sin(a.y * 1.3 + t * 0.7), cos(a.x * 1.1 - t * 0.6)) * 0.6;
      v += 1.0 - abs(sin(a.x + a.y * 0.7 + float(i)));
    }
    return pow(clamp(v / 4.0, 0.0, 1.0), 6.0);
  }`;

  const VS = `#version 300 es
  layout(location=0) in vec3 a_pos; layout(location=1) in vec3 a_nor; layout(location=2) in vec3 a_col; layout(location=3) in vec3 a_par;
  uniform mat4 u_vp; uniform mat4 u_model; uniform mat4 u_lightVP;
  out vec3 v_wpos; out vec3 v_nor; out vec3 v_col; out vec3 v_par; out vec4 v_shadow; out vec2 v_xy;
  void main(){
    vec4 w = u_model * vec4(a_pos, 1.0);
    v_wpos = w.xyz; v_nor = mat3(u_model) * a_nor; v_col = a_col; v_par = a_par; v_xy = a_pos.xy;
    v_shadow = u_lightVP * (w + vec4(normalize(mat3(u_model) * a_nor) * 0.012, 0.0));
    gl_Position = u_vp * w;
  }`;

  const FS = `#version 300 es
  precision highp float; precision highp sampler2DShadow;
  in vec3 v_wpos; in vec3 v_nor; in vec3 v_col; in vec3 v_par; in vec4 v_shadow; in vec2 v_xy;
  uniform sampler2DShadow u_shadow; uniform vec3 u_cam; uniform vec3 u_light; uniform float u_texel; uniform float u_mitSchatten;
  uniform mat4 u_model; uniform float u_zeit; uniform vec3 u_wasser; uniform float u_dichte; uniform float u_kaustik;
  out vec4 outColor;
  ${KAUSTIK}
  vec3 env(vec3 d){
    d = normalize(d);
    float up = d.y * 0.5 + 0.5;
    vec3 c = mix(vec3(0.05, 0.22, 0.34), vec3(0.62, 0.90, 0.98), smoothstep(0.1, 0.95, up));   // oben die helle Oberfläche, unten tiefes Blau
    float b1 = smoothstep(0.80, 0.93, dot(d, normalize(vec3(-0.35, 0.9, 0.3))));              // Sonne durch die Oberfläche
    float b2 = smoothstep(0.86, 0.96, dot(d, normalize(vec3(0.85, 0.35, 0.4)))) * 0.5;
    return c * 0.85 + vec3(0.95, 1.0, 1.0) * b1 * 1.7 + vec3(0.6, 0.85, 1.0) * b2;
  }
  void main(){
    vec3 Nz = normalize(mat3(u_model) * vec3(0.0, 0.0, 1.0));
    vec3 N = normalize(v_nor);
    // Obere Flächen minimal wölben, damit Glanzlichter beim Drehen über sie wandern
    float kappe = smoothstep(0.85, 1.0, abs(dot(N, Nz)));
    N = normalize(N + mat3(u_model) * vec3(v_xy * 0.28, 0.0) * kappe * 0.6);
    vec3 V = normalize(u_cam - v_wpos);
    vec3 L = normalize(u_light);
    if (dot(N, V) < 0.0 && abs(dot(normalize(v_nor), Nz)) > 0.9) N = -N;
    float ndl = max(dot(N, L), 0.0);

    float sh = 1.0;
    if (u_mitSchatten > 0.5) {
      vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
      sh = 0.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
        sh += texture(u_shadow, vec3(sc.xy + vec2(float(x), float(y)) * u_texel * 1.6, sc.z - 0.0015));
      }
      sh /= 9.0;
    }

    float gloss = v_par.x;
    float ao = mix(0.52, 1.0, smoothstep(0.0, 0.85, v_par.y));
    float hemi = 0.5 + 0.5 * N.y;
    vec3 ambient = mix(vec3(0.32, 0.46, 0.54), vec3(0.74, 0.90, 0.98), hemi);       // Wasser färbt das Streulicht blau-grün

    // Lichtmuster der Wasseroberfläche (Kaustik) auf nach oben gewandten Flächen
    float kst = kaustik(v_wpos.xz * 0.9 + v_wpos.y * 0.35, u_zeit) * u_kaustik * smoothstep(-0.25, 0.7, N.y + 0.3);
    vec3 key = vec3(0.98, 1.0, 0.96) * 1.05;
    vec3 fill = vec3(0.55, 0.8, 1.0) * 0.24 * max(dot(N, normalize(vec3(0.85, -0.2, 0.5))), 0.0);
    vec3 col = v_col * (ambient * ao * 0.62 + key * ndl * (0.30 + 0.70 * sh) * 0.98 * (1.0 + 1.2 * kst) + fill);

    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 40.0 + 260.0 * gloss) * (0.25 + 0.9 * gloss) * sh;
    float ndv = max(dot(N, V), 0.0);
    float fres = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
    vec3 refl = env(reflect(-V, N));
    col += refl * (0.022 + 0.38 * fres) * (0.30 + 0.70 * gloss) * ao;
    col += vec3(1.0, 1.0, 0.97) * spec;

    // Wasser schluckt Licht: mit der Entfernung geht alles in die Wasserfarbe über
    float dist = length(u_cam - v_wpos);
    col = mix(col, u_wasser, 1.0 - exp(-dist * u_dichte));
    col = col / (1.0 + 0.06 * col);
    outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
  }`;

  const VS_TIEFE = `#version 300 es
  layout(location=0) in vec3 a_pos;
  uniform mat4 u_lightVP;
  void main(){ gl_Position = u_lightVP * vec4(a_pos, 1.0); }`;
  const FS_TIEFE = `#version 300 es
  precision mediump float; void main(){}`;

  // Tafel-Fläche mit Textur (Inhalt), beleuchtet wie der Rest
  const VS_FLAECHE = `#version 300 es
  layout(location=0) in vec3 a_pos; layout(location=1) in vec2 a_uv;
  uniform mat4 u_vp; uniform mat4 u_model;
  out vec3 v_wpos; out vec3 v_nor; out vec2 v_uv;
  void main(){ vec4 w = u_model * vec4(a_pos, 1.0); v_wpos = w.xyz; v_nor = mat3(u_model) * vec3(0.0, 0.0, 1.0); v_uv = a_uv; gl_Position = u_vp * w; }`;
  const FS_FLAECHE = `#version 300 es
  precision highp float;
  in vec3 v_wpos; in vec3 v_nor; in vec2 v_uv;
  uniform sampler2D u_tex; uniform vec3 u_cam; uniform vec3 u_light; uniform float u_zeit; uniform vec3 u_wasser; uniform float u_dichte; uniform float u_kaustik;
  out vec4 outColor;
  ${KAUSTIK}
  void main(){
    vec3 N = normalize(v_nor); vec3 V = normalize(u_cam - v_wpos); vec3 L = normalize(u_light);
    if (dot(N, V) < 0.0) N = -N;
    vec3 tex = pow(texture(u_tex, v_uv).rgb, vec3(2.2));
    float ndl = max(dot(N, L), 0.0);
    float kst = kaustik(v_wpos.xz * 0.9 + v_wpos.y * 0.35 + v_uv * 0.6, u_zeit) * u_kaustik * 0.5;
    vec3 col = tex * (0.68 + 0.5 * ndl * (1.0 + kst));
    vec3 H = normalize(L + V);
    col += vec3(0.85, 1.0, 1.0) * pow(max(dot(N, H), 0.0), 90.0) * 0.28;               // leichter Glanz der Emaille
    col = mix(col, u_wasser, 1.0 - exp(-length(u_cam - v_wpos) * u_dichte));
    outColor = vec4(pow(clamp(col / (1.0 + 0.04 * col), 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
  }`;

  // Hintergrund: Wasser mit Tiefenverlauf und Lichtstrahlen von der Oberfläche
  const VS_HINTER = `#version 300 es
  layout(location=0) in vec2 a; void main(){ gl_Position = vec4(a, 0.9999, 1.0); }`;
  const FS_HINTER = `#version 300 es
  precision highp float;
  uniform vec2 u_res; uniform float u_zeit; uniform float u_tiefe; uniform vec2 u_blick;
  out vec4 o;
  void main(){
    vec2 uv = gl_FragCoord.xy / u_res;
    float y = uv.y + u_blick.y * 0.12;
    vec3 oben = mix(vec3(0.20, 0.72, 0.82), vec3(0.05, 0.32, 0.46), u_tiefe);
    vec3 mitte = mix(vec3(0.07, 0.46, 0.64), vec3(0.02, 0.17, 0.31), u_tiefe);
    vec3 unten = mix(vec3(0.03, 0.22, 0.38), vec3(0.01, 0.07, 0.16), u_tiefe);
    vec3 c = mix(unten, mitte, smoothstep(0.0, 0.55, y));
    c = mix(c, oben, smoothstep(0.45, 1.0, y));
    float x = uv.x + u_blick.x * 0.10;
    float r = 0.0;
    for (int i = 0; i < 4; i++) {
      float f = float(i);
      float ph = x * (4.5 + f * 3.1) + y * (1.0 + f * 0.35) + u_zeit * (0.045 + 0.02 * f) + f * 1.7;
      r += pow(max(0.0, sin(ph + sin(ph * 0.7 + u_zeit * 0.1) * 1.3)), 5.0) * (0.55 - 0.1 * f);
    }
    r *= smoothstep(0.05, 1.0, y) * (1.0 - u_tiefe * 0.65);
    c += vec3(0.55, 0.92, 1.0) * r * 0.21;
    vec2 q = uv - 0.5; c *= 1.0 - dot(q, q) * 0.95;
    c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;   // gegen Streifen im Verlauf
    o = vec4(c, 1.0);
  }`;

  // Teilchen im Wasser: Meeresstaub, Plankton und aufsteigende Luftblasen. Fest in der Welt (Parallaxe),
  // um die Kamera herum gekachelt, Tiefenunschärfe nach Abstand zum Blickpunkt.
  const VS_TEILCHEN = `#version 300 es
  layout(location=0) in vec4 a_seed;
  uniform mat4 u_vp; uniform vec3 u_cam; uniform float u_drift; uniform float u_zeit; uniform float u_focal; uniform float u_fokus; uniform float u_maxPt; uniform float u_tiefe;
  out float v_typ; out float v_alpha; out float v_unsch; out float v_s;
  void main(){
    float s = a_seed.w; float tv = fract(s * 13.7);
    float typ = tv < 0.62 ? 0.0 : (tv < 0.83 ? 1.0 : 2.0);          // 0 Meeresstaub, 1 Plankton, 2 Blase
    vec3 p = a_seed.xyz * 16.0;
    if (typ < 0.5) { p.y -= u_drift * 0.05 * (0.5 + fract(s * 3.3)); p.x += u_drift * 0.04 + sin(u_zeit * 0.2 + s * 40.0) * 0.4; p.z += cos(u_zeit * 0.17 + s * 31.0) * 0.4; }
    else if (typ < 1.5) { p.x += sin(u_zeit * 0.12 + s * 20.0) * 0.9 + u_drift * 0.06; p.y += sin(u_zeit * 0.1 + s * 9.0) * 0.5 - u_drift * 0.02; p.z += cos(u_zeit * 0.09 + s * 14.0) * 0.9; }
    else { p.y += u_drift * (0.5 + 0.7 * fract(s * 7.1)); p.x += sin(u_zeit * 1.1 + p.y * 1.7 + s * 50.0) * 0.16; p.z += cos(u_zeit * 0.9 + p.y * 1.5 + s * 33.0) * 0.16; }
    vec3 rel = mod(p - u_cam + 8.0, 16.0) - 8.0;                       // endloses Wasser um die Kamera
    vec3 w = u_cam + rel;
    float rand = max(abs(rel.x), max(abs(rel.y), abs(rel.z)));
    float dist = length(rel);
    float radius = typ < 0.5 ? mix(0.008, 0.024, fract(s * 5.3)) : (typ < 1.5 ? mix(0.014, 0.04, fract(s * 5.3)) : mix(0.02, 0.1, pow(fract(s * 5.3), 2.2)));
    float unsch = clamp(abs(dist - u_fokus) / (u_fokus * 0.9), 0.0, 1.0);
    float px = 2.0 * radius * u_focal / max(dist, 0.05) * (1.0 + unsch * 1.4);
    gl_PointSize = clamp(px, 1.2, u_maxPt);
    gl_Position = u_vp * vec4(w, 1.0);
    float a = typ < 0.5 ? 1.0 : (typ < 1.5 ? 0.7 : 0.95);
    a *= 1.0 - 0.45 * unsch;
    a *= smoothstep(0.25, 1.1, dist) * exp(-dist * 0.05) * (1.0 - smoothstep(5.5, 8.0, rand));
    a *= clamp(px / 2.2, 0.0, 1.0) * (1.0 - 0.4 * u_tiefe);
    v_typ = typ; v_alpha = a; v_unsch = unsch; v_s = s;
  }`;
  const FS_TEILCHEN = `#version 300 es
  precision highp float;
  in float v_typ; in float v_alpha; in float v_unsch; in float v_s;
  uniform float u_zeit;
  out vec4 o;
  void main(){
    vec2 pc = gl_PointCoord * 2.0 - 1.0;
    float d = length(pc);
    if (d > 1.0) discard;
    float weich = mix(0.05, 0.4, v_unsch);
    vec3 rgb; float a;
    if (v_typ < 0.5) {                                              // Meeresstaub: helle Flöckchen im Licht, glitzern leicht
      float glitzer = 0.65 + 0.35 * sin(u_zeit * 1.7 + v_s * 80.0);
      a = (1.0 - d) * (1.0 - d) * 0.75 * glitzer; rgb = vec3(0.86, 0.97, 1.0);
    } else if (v_typ < 1.5) {                                       // Plankton: durchscheinende grünliche Flecken
      a = (1.0 - d * d) * 0.5; rgb = vec3(0.62, 0.95, 0.80) * (0.8 + 0.2 * d);
    } else {                                                        // Luftblase: heller Rand, Glanzbogen, fast durchsichtig
      float rim = smoothstep(0.62 - weich * 0.4, 0.94, d) * (1.0 - smoothstep(0.94, 1.0, d));
      float bogen = smoothstep(0.1, 0.0, abs(d - 0.6)) * smoothstep(0.15, 0.75, dot(normalize(pc + 0.0001), normalize(vec2(-0.7, -0.7))));
      float punkt = smoothstep(0.2, 0.0, length(pc - vec2(-0.42, -0.42)));
      float unten = smoothstep(0.35, 1.0, dot(pc, vec2(0.6, 0.8))) * 0.12;
      a = clamp(0.05 + 0.5 * rim + 0.6 * bogen + 0.7 * punkt + unten, 0.0, 1.0);
      rgb = mix(vec3(0.66, 0.88, 1.0), vec3(1.0), clamp(bogen + punkt, 0.0, 1.0));
    }
    a *= v_alpha;
    o = vec4(rgb * a, a);
  }`;

  function programm(gl, vs, fs) {
    const bau = (typ, quelle) => {
      const s = gl.createShader(typ);
      gl.shaderSource(s, quelle); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'Shader-Fehler');
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, bau(gl.VERTEX_SHADER, vs)); gl.attachShader(p, bau(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'Link-Fehler');
    return p;
  }

  /* ---------- Zeichnen ---------- */
  // mini = Home-Logo oben links: kein Hintergrund, keine Teilchen, keine Tafeln, kein Schatten
  function rendererBauen(zielCanvas, koerper, mini, tafelDaten) {
    const gl = zielCanvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, depth: true, stencil: false });
    if (!gl) throw new Error('WebGL2 fehlt');
    const pHaupt = programm(gl, VS, FS);
    const u = (pr, n) => gl.getUniformLocation(pr, n);

    const koerperVAO = (k) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, k.daten, gl.STATIC_DRAW);
      [[0, 3, 0], [1, 3, 3], [2, 3, 6], [3, 3, 9]].forEach(([i, n, o]) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, 48, o * 4); });
      const ebo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, k.indizes, gl.STATIC_DRAW);
      return { vao, anzahl: k.indizes.length };
    };
    const marke = koerperVAO(koerper);

    let pTiefe; let pHinter; let pTeil; let pFlaeche; let fbo; let tiefe; let vaoQ; let vaoT; let teilAnzahl = 0; let maxPunkt = 64;
    let platte; let flaecheVAO; const texturen = {};
    const SK = 1536;
    if (!mini) {
      pTiefe = programm(gl, VS_TIEFE, FS_TIEFE);
      pHinter = programm(gl, VS_HINTER, FS_HINTER);
      pTeil = programm(gl, VS_TEILCHEN, FS_TEILCHEN);
      pFlaeche = programm(gl, VS_FLAECHE, FS_FLAECHE);

      tiefe = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tiefe);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SK, SK);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tiefe, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Schattenkarte nicht möglich');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      vaoQ = gl.createVertexArray(); gl.bindVertexArray(vaoQ);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      teilAnzahl = window.innerWidth < 700 ? 480 : 1100;
      const samen = new Float32Array(teilAnzahl * 4);
      let zufall = 12345;
      const rnd = () => { zufall = (zufall * 1664525 + 1013904223) >>> 0; return zufall / 4294967296; };
      for (let i = 0; i < samen.length; i += 1) samen[i] = rnd();
      const tb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tb); gl.bufferData(gl.ARRAY_BUFFER, samen, gl.STATIC_DRAW);
      vaoT = gl.createVertexArray(); gl.bindVertexArray(vaoT);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      maxPunkt = Math.min(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1], 110);

      // Tafeln: Platte + Inhaltsfläche mit Textur
      platte = koerperVAO(tafelDaten);
      const fb = TAFEL_B * 0.46; const fh = TAFEL_H * 0.46; const z0 = 0.004;
      const fl = new Float32Array([-fb, fh, z0, 0, 0, fb, fh, z0, 1, 0, -fb, -fh, z0, 0, 1, fb, -fh, z0, 1, 1]);
      flaecheVAO = gl.createVertexArray(); gl.bindVertexArray(flaecheVAO);
      const fv = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fv); gl.bufferData(gl.ARRAY_BUFFER, fl, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      T.SCHLUESSEL.forEach((key) => {
        const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        const cv = document.createElement('canvas'); cv.width = T.BREITE; cv.height = T.HOEHE;
        texturen[key] = { tx, cv };
      });
    }

    function tafelAktualisieren(key) {
      if (mini || !texturen[key]) return;
      const t = texturen[key];
      T.malen(key, t.cv, D.zustand);
      gl.bindTexture(gl.TEXTURE_2D, t.tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.cv);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    if (!mini) T.SCHLUESSEL.forEach(tafelAktualisieren);

    const FOV = rad(20);
    const KEY = [-0.4, 0.75, 0.65]; // Licht, in Kamerarichtung gesehen
    let letztesVP = mat.ident(); let letzteBreite = 1; let letzteHoehe = 1; let letztesAspekt = 1;

    function groesse() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const b = Math.max(2, Math.round(zielCanvas.clientWidth * dpr));
      const h = Math.max(2, Math.round(zielCanvas.clientHeight * dpr));
      if (zielCanvas.width !== b || zielCanvas.height !== h) { zielCanvas.width = b; zielCanvas.height = h; }
      return b / h;
    }

    function tafelMatrix(key, zeit) {
      const t = TAFELN[key]; const w = rad(t.winkel);
      const pos = [R_TAFEL * Math.sin(w), t.hoehe + Math.sin(zeit * 0.5 + t.winkel) * 0.12, R_TAFEL * Math.cos(w)];
      const sw = Math.sin(zeit * 0.31 + t.winkel * 0.1) * 0.03;
      return mat.mul(mat.verschieben(pos[0], pos[1], pos[2]), mat.mul(mat.dreheY(rad(t.winkel + 180) + sw), mat.dreheZ(Math.sin(zeit * 0.4 + t.winkel) * 0.02)));
    }

    // z: { gier, nick, roll, f, zoom, hub, licht, drift, zeit, tiefe }
    function zeichnen(z) {
      const aspekt = groesse();
      const halbH = Math.max(2.2, 1.7 / aspekt);
      const basis = halbH / Math.tan(FOV / 2);
      const abst = basis / z.zoom;

      const f = [z.f[0], z.f[1] + z.hub, z.f[2]];
      const R = mat.mul(mat.dreheZ(rad(z.roll)), mat.mul(mat.dreheX(rad(z.nick)), mat.dreheY(rad(z.gier))));
      const ansicht = mat.mul(mat.verschieben(0, 0, -abst), mat.mul(R, mat.verschieben(-f[0], -f[1], -f[2])));
      const vp = mat.mul(mat.persp(FOV, aspekt, Math.max(0.05, abst - 3.2), abst + 60), ansicht);
      letztesVP = vp; letzteBreite = zielCanvas.clientWidth; letzteHoehe = zielCanvas.clientHeight; letztesAspekt = aspekt;
      const cam = [f[0] + abst * R[2], f[1] + abst * R[6], f[2] + abst * R[10]];
      const lw = rad(z.licht || 0);
      const kl = [KEY[0] * Math.cos(lw) + KEY[2] * Math.sin(lw), KEY[1], -KEY[0] * Math.sin(lw) + KEY[2] * Math.cos(lw)];
      const kn = Math.hypot(kl[0], kl[1], kl[2]);
      const licht = [0, 1, 2].map((i) => (R[i * 4] * kl[0] + R[i * 4 + 1] * kl[1] + R[i * 4 + 2] * kl[2]) / kn);
      const wasser = [0.0035, 0.115, 0.215].map((v, i) => lerp(v, [0.0004, 0.025, 0.07][i], z.tiefe));
      const dichte = 0.024;
      const ident = mat.ident();

      let lichtVP = new Float32Array(16);
      if (!mini) {
        // 1) Tiefe der Marke aus Sicht des Lichts (nur die Marke wirft Schatten)
        lichtVP = mat.mul(mat.ortho(-2.6, 2.6, -2.6, 2.6, 0.5, 11), mat.blick(licht.map((v) => v * 6), [0, 0, 0], [0, 1, 0]));
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, SK, SK);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
        gl.useProgram(pTiefe);
        gl.uniformMatrix4fv(u(pTiefe, 'u_lightVP'), false, lichtVP);
        gl.bindVertexArray(marke.vao);
        gl.drawElements(gl.TRIANGLES, marke.anzahl, gl.UNSIGNED_INT, 0);
      }

      // 2) Bild
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, zielCanvas.width, zielCanvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);

      if (!mini) {
        gl.depthMask(false);
        gl.useProgram(pHinter);
        gl.uniform2f(u(pHinter, 'u_res'), zielCanvas.width, zielCanvas.height);
        gl.uniform1f(u(pHinter, 'u_zeit'), z.zeit);
        gl.uniform1f(u(pHinter, 'u_tiefe'), z.tiefe);
        gl.uniform2f(u(pHinter, 'u_blick'), rad(z.gier) * 0.4, rad(z.nick) * 0.5);
        gl.bindVertexArray(vaoQ);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.depthMask(true);
      }

      const gemein = (pr, modell) => {
        gl.uniformMatrix4fv(u(pr, 'u_vp'), false, vp);
        gl.uniformMatrix4fv(u(pr, 'u_model'), false, modell);
        gl.uniform3fv(u(pr, 'u_cam'), cam);
        gl.uniform3fv(u(pr, 'u_light'), licht);
        gl.uniform1f(u(pr, 'u_zeit'), z.zeit);
        gl.uniform3fv(u(pr, 'u_wasser'), wasser);
        gl.uniform1f(u(pr, 'u_dichte'), mini ? 0.0 : dichte);
        gl.uniform1f(u(pr, 'u_kaustik'), mini ? 0.35 : 1.0 - z.tiefe * 0.5);
      };

      // Bildmarke
      gl.useProgram(pHaupt);
      gemein(pHaupt, ident);
      gl.uniformMatrix4fv(u(pHaupt, 'u_lightVP'), false, lichtVP);
      gl.uniform1f(u(pHaupt, 'u_texel'), 1 / SK);
      gl.uniform1f(u(pHaupt, 'u_mitSchatten'), mini ? 0 : 1);
      if (!mini) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tiefe); }
      gl.uniform1i(u(pHaupt, 'u_shadow'), 0);
      gl.bindVertexArray(marke.vao);
      gl.drawElements(gl.TRIANGLES, marke.anzahl, gl.UNSIGNED_INT, 0);

      if (!mini) {
        // Tafeln im Wasser
        T.SCHLUESSEL.forEach((key) => {
          const m = tafelMatrix(key, z.zeit);
          gl.useProgram(pHaupt);
          gemein(pHaupt, m);
          gl.uniform1f(u(pHaupt, 'u_mitSchatten'), 0);
          gl.bindVertexArray(platte.vao);
          gl.drawElements(gl.TRIANGLES, platte.anzahl, gl.UNSIGNED_INT, 0);
          gl.useProgram(pFlaeche);
          gemein(pFlaeche, m);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texturen[key].tx);
          gl.uniform1i(u(pFlaeche, 'u_tex'), 1);
          gl.bindVertexArray(flaecheVAO);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });
        gl.activeTexture(gl.TEXTURE0);

        // Teilchen: hinter und vor den Körpern (Tiefentest ohne Schreiben), weich überblendet
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.useProgram(pTeil);
        gl.uniformMatrix4fv(u(pTeil, 'u_vp'), false, vp);
        gl.uniform3fv(u(pTeil, 'u_cam'), cam);
        gl.uniform1f(u(pTeil, 'u_drift'), z.drift);
        gl.uniform1f(u(pTeil, 'u_zeit'), z.zeit);
        gl.uniform1f(u(pTeil, 'u_focal'), (zielCanvas.height / 2) / Math.tan(FOV / 2));
        gl.uniform1f(u(pTeil, 'u_fokus'), abst);
        gl.uniform1f(u(pTeil, 'u_maxPt'), maxPunkt);
        gl.uniform1f(u(pTeil, 'u_tiefe'), z.tiefe);
        gl.bindVertexArray(vaoT);
        gl.drawArrays(gl.POINTS, 0, teilAnzahl);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
    }

    // Weltpunkt → CSS-Pixel (für die Textpunkte); w < 0 = hinter der Kamera
    function projiziere(p) {
      const m = letztesVP;
      const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
      const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
      const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      return { x: (x / w * 0.5 + 0.5) * letzteBreite, y: (1 - (y / w * 0.5 + 0.5)) * letzteHoehe, w };
    }
    return { zeichnen, tafelAktualisieren, projiziere, aspekt: () => letztesAspekt };
  }

  /* ---------- Bewegung, Navigation, Textpunkte ---------- */
  function laufen(motor, mini) {
    const gueltig = (k) => Object.prototype.hasOwnProperty.call(TAFELN, k);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';   // Zurück soll oben landen, nicht an der alten Stelle

    // Ziehen (Zeiger): horizontal = Gieren, vertikal (nur Maus) = Nicken
    let zieht = false; let lastX = 0; let lastY = 0; let startT = 0; let bewegt = 0;
    let vGier = 0; let vNick = 0; let letzterZug = 0; let ruheSeit = 0;
    let offGier = 0; let offNick = 0;
    const zielG = { w: 0 }; const zielN = { w: 0 };
    let modus = 'start'; let aktiv = null; let flug = 0; let p = festP === null ? 0 : festP;
    let eigenerEintrag = false;
    const velG = { v: 0 }; const velN = { v: 0 }; const velP = { v: 0 };
    const grenze = () => (modus === 'tafel' ? 30 : 1e9);
    let neustart = () => {};

    // Textpunkte (DOM) anlegen
    const punktEl = PUNKTE.map((pt) => {
      const el = document.createElement('div'); el.className = 'punkt';
      const linie = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); linie.setAttribute('class', 'punkt-linie');
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); linie.append(l);
      const dot = document.createElement('i'); dot.className = 'punkt-dot';
      const knopf = document.createElement('button'); knopf.type = 'button'; knopf.className = 'punkt-text';
      const t1 = document.createElement('span'); t1.textContent = pt.titel;
      const t2 = document.createElement('small'); t2.textContent = pt.unter;
      knopf.append(t1, t2);
      el.append(linie, dot, knopf); punkteHalter.append(el);
      knopf.addEventListener('click', () => { if (pt.ziel === 'anfang') neustart(); else oeffnen(pt.ziel, true); });
      return { el, l, knopf, pt };
    });

    canvas.addEventListener('pointerdown', (e) => {
      zieht = true; lastX = e.clientX; lastY = e.clientY; startT = performance.now(); bewegt = 0; vGier = 0; vNick = 0;
      canvas.setPointerCapture(e.pointerId); canvas.classList.add('zieht'); hinweis.classList.add('weg');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!zieht) return;
      const dx = e.clientX - lastX; const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; bewegt += Math.abs(dx) + Math.abs(dy);
      const dg = dx * 0.45; const dn = e.pointerType === 'mouse' ? dy * 0.3 : 0;
      zielG.w = clamp(zielG.w + dg, -grenze(), grenze()); zielN.w = clamp(zielN.w + dn, -70, 70);
      const jetzt = performance.now(); const dtz = Math.max(8, jetzt - letzterZug) / 1000; letzterZug = jetzt;
      vGier = lerp(vGier, dg / dtz, 0.5); vNick = lerp(vNick, dn / dtz, 0.5);
    });
    const loslassen = () => {
      if (!zieht) return;
      zieht = false; canvas.classList.remove('zieht');
      const kurz = bewegt < 6 && performance.now() - startT < 350;
      if (kurz && modus === 'start') zielG.w += 360;                    // Antippen: einmal ganz herum
      else {
        const frisch = performance.now() - letzterZug < 90;
        zielG.w = clamp(zielG.w + clamp((frisch ? vGier : 0) * AUSLAUF, -540, 540), -grenze(), grenze());
        zielN.w = clamp(zielN.w + (frisch ? vNick : 0) * AUSLAUF, -70, 70);
      }
      ruheSeit = 0;
    };
    canvas.addEventListener('pointerup', loslassen);
    canvas.addEventListener('pointercancel', loslassen);

    // Home-Logo: bewegt sich nur ganz leicht mit dem Zeiger
    let zeigerX = window.innerWidth * 0.5; let zeigerY = window.innerHeight * 0.5;
    window.addEventListener('pointermove', (e) => { zeigerX = e.clientX; zeigerY = e.clientY; }, { passive: true });

    /* --- Untermenü öffnen und schließen --- */
    function oeffnen(key, mitFlug, ausHistorie) {
      if (!gueltig(key)) return;
      modus = 'tafel'; aktiv = key; if (mitFlug) flug = 1;
      zielG.w = 0; zielN.w = 0; ruheSeit = 0;
      wurzel.classList.add('untermenue'); hinweis.classList.add('weg');
      if (!ausHistorie) { history.pushState({ tafel: key }, '', `#${key}`); eigenerEintrag = true; }
      zurueck.hidden = false;
    }
    function schliessen(ausHistorie) {
      if (modus !== 'tafel') return;
      modus = 'start'; aktiv = null; flug = 1;
      wurzel.classList.remove('untermenue');
      window.scrollTo(0, 0); p = 0; velP.v = 0;
      if (!ausHistorie) {
        if (eigenerEintrag) { eigenerEintrag = false; history.back(); } else history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    zurueck.addEventListener('click', () => schliessen(false));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') schliessen(false); });
    window.addEventListener('popstate', () => {
      const k = window.location.hash.slice(1);
      if (gueltig(k)) oeffnen(k, true, true); else schliessen(true);
    });
    if (menue) menue.querySelectorAll('button[data-ziel]').forEach((b) => b.addEventListener('click', () => oeffnen(b.dataset.ziel, true)));

    // Inhalte der Tafeln: Uhr jede Sekunde, die anderen bei neuen Daten
    const ART = { uhr: 'uhr', wetter: 'wetter', pegel: 'wasserstand', kalender: 'kalender' };
    D.beiAenderung((art) => { if (ART[art]) motor.tafelAktualisieren(ART[art]); });

    // Pose der Kamera am Ziel
    function tafelPose(key, aspekt) {
      const t = TAFELN[key]; const w = rad(t.winkel);
      const halbH = Math.max(2.2, 1.7 / aspekt);
      const zoom = Math.min((2 * halbH * aspekt * 0.8) / TAFEL_B, (2 * halbH * 0.7) / TAFEL_H);
      return { gier: -(t.winkel + 180) + 7, nick: 3, roll: 0, f: [R_TAFEL * Math.sin(w), t.hoehe, R_TAFEL * Math.cos(w)], zoom };
    }

    if (reduziert) {
      // Ruhig: Standbild, Zugang zu den Tafeln über das Menü, kein Flug
      const standbild = () => {
        const z0 = modus === 'tafel' ? tafelPose(aktiv, motor.aspekt()) : bahnWert(0);
        motor.zeichnen({ gier: z0.gier + offGier, nick: clamp(z0.nick + offNick, -85, 85), roll: z0.roll, f: z0.f, zoom: z0.zoom, hub: 0, licht: 0, drift: 0, zeit: 0, tiefe: 0.1 });
        if (mini) mini.zeichnen({ gier: -20, nick: 6, roll: 0, f: [0, 0, 0], zoom: 2.05, hub: 0, licht: 0, drift: 0, zeit: 0, tiefe: 0 });
      };
      canvas.addEventListener('pointermove', () => { if (zieht) { offGier = zielG.w; offNick = zielN.w; standbild(); } });
      window.addEventListener('resize', standbild);
      D.beiAenderung(() => standbild());
      punktEl.forEach((pe) => { pe.el.hidden = true; });
      if (menue) menue.hidden = false;
      if (miniKnopf) miniKnopf.addEventListener('click', () => { schliessen(false); standbild(); });
      zurueck.addEventListener('click', standbild);
      menue.querySelectorAll('button[data-ziel]').forEach((b) => b.addEventListener('click', standbild));
      const hash0 = window.location.hash.slice(1); if (gueltig(hash0)) oeffnen(hash0, false, true);
      standbild();
      return;
    }

    /* --- Animationsschleife --- */
    const b0 = bahnWert(p);
    const P = { gier: b0.gier, nick: b0.nick, roll: 0, fx: b0.f[0], fy: b0.f[1], fz: b0.f[2], lz: Math.log(b0.zoom) };
    const V = { gier: { v: 0 }, nick: { v: 0 }, roll: { v: 0 }, fx: { v: 0 }, fy: { v: 0 }, fz: { v: 0 }, lz: { v: 0 } };
    const miniG = { v: 0 }; const miniN = { v: 0 }; const miniDrehV = { v: 0 };
    let t = 0; let introT = festP === null ? 0 : INTRO;
    let letzte = performance.now();
    let drift = 0; let miniGier = -20; let miniNick = 6; let miniDreh = 0; let miniDrehZiel = 0;

    neustart = () => {
      if (modus === 'tafel') schliessen(false);
      window.scrollTo(0, 0);
      p = 0; velP.v = 0; introT = 0; flug = 0;
      offGier = 0; offNick = 0; zielG.w = 0; zielN.w = 0; velG.v = 0; velN.v = 0; ruheSeit = 0;
      hinweis.classList.remove('weg');
      miniDrehZiel += 360;
    };
    if (miniKnopf) miniKnopf.addEventListener('click', neustart);

    // Direkter Einstieg über #wasserstand usw.
    const hash0 = window.location.hash.slice(1);
    if (gueltig(hash0)) {
      introT = INTRO; oeffnen(hash0, false, true);
      const z0 = tafelPose(hash0, motor.aspekt());
      P.gier = z0.gier; P.nick = z0.nick; P.fx = z0.f[0]; P.fy = z0.f[1]; P.fz = z0.f[2]; P.lz = Math.log(z0.zoom);
    }

    const bild = (jetzt) => {
      const dt = Math.min(0.05, Math.max(0.001, (jetzt - letzte) / 1000)); letzte = jetzt; t += dt; introT += dt;
      flug = Math.max(0, flug - dt / FLUG);

      // Scroll-Fortschritt, weich nachgezogen (im Untermenü eingefroren)
      if (modus === 'start') {
        const max = Math.max(1, tour.offsetHeight - window.innerHeight);
        const ziel = festP !== null ? festP : clamp(window.scrollY / max);
        p = glatt(p, ziel, velP, SCROLL_GLATT, dt);
        if (p > 0.02) hinweis.classList.add('weg');
      }

      // Ziel der Kamera: Bahn beim Scrollen, Tafel im Untermenü. Zwischen beiden fliegt sie weich.
      const asp = motor.aspekt();
      const zp = modus === 'tafel' ? tafelPose(aktiv, asp) : (() => { const k = bahnWert(p); return { gier: k.gier, nick: k.nick, roll: k.roll, f: k.f, zoom: k.zoom }; })();
      const zeit = 0.18 + 0.85 * flug * flug;                 // beim Flug langsam, sonst eng am Ziel
      P.gier = glatt(P.gier, P.gier + umbruch(zp.gier - P.gier), V.gier, zeit * 0.5, dt);   // die Kamera wendet sich schneller zum Ziel als sie hinfährt
      P.nick = glatt(P.nick, zp.nick, V.nick, zeit, dt);
      P.roll = glatt(P.roll, zp.roll, V.roll, zeit, dt);
      P.fx = glatt(P.fx, zp.f[0], V.fx, zeit, dt); P.fy = glatt(P.fy, zp.f[1], V.fy, zeit, dt); P.fz = glatt(P.fz, zp.f[2], V.fz, zeit, dt);
      P.lz = glatt(P.lz, Math.log(zp.zoom), V.lz, zeit, dt);

      // Ziehen: Marke folgt weich, nach Ruhe dreht sie sanft zurück in die Bahn
      if (!zieht) {
        ruheSeit += dt;
        if (ruheSeit > RUHE && (Math.abs(offGier) > 0.01 || Math.abs(offNick) > 0.01)) {
          const voll = 360 * Math.round(offGier / 360);      // ganze Umdrehungen sehen gleich aus: ohne Sprung abziehen
          offGier -= voll; zielG.w = 0; zielN.w = 0;
        }
      }
      const folg = zieht ? ZIEH_GLATT : (ruheSeit > RUHE ? RUECK_GLATT : AUSLAUF);
      offGier = glatt(offGier, zielG.w, velG, folg, dt);
      offNick = glatt(offNick, zielN.w, velN, folg, dt);

      // Intro "Auftauchen": aus der Tiefe nach oben, die Kamera fährt heran, die Marke dreht sich einmal herum,
      // Blasen rauschen vorbei, ein Lichtstrahl wandert über das Schild. Die Marke ist von Anfang an da.
      const e = easeOut4(clamp(introT / INTRO));
      const rest = 1 - e;
      const zoomEff = Math.exp(P.lz) * lerp(0.42, 1, e);
      const sanft = 1 / Math.sqrt(Math.exp(P.lz));
      const hub = (modus === 'start' ? Math.sin(t * 0.85) * 0.035 * sanft : 0) + 0.95 * rest * rest;
      drift += dt * (0.14 + 6.5 * rest * rest * rest);
      const tiefe = clamp(0.1 + 0.9 * rest * rest, 0, 1) * (modus === 'tafel' ? 0.5 : 1);
      motor.zeichnen({
        gier: P.gier - 342 * rest * rest + offGier + Math.sin(t * 0.5) * 1.6 * sanft,
        nick: clamp(P.nick - 12 * rest + offNick + Math.sin(t * 0.37) * 1.2 * sanft, -88, 88),
        roll: P.roll + Math.sin(t * 0.43) * 0.9 * sanft,
        f: [P.fx, P.fy, P.fz], zoom: zoomEff, hub, licht: -85 * rest, drift, zeit: t, tiefe,
      });

      // Textpunkte: nur der zum aktuellen Zoom gehörende, mit sanftem Ein- und Ausblenden
      punktEl.forEach(({ el, l, knopf, pt }) => {
        const sichtbar = modus === 'start' ? 1 - smooth(0.035, 0.07, Math.abs(p - pt.p)) : 0;
        const q = motor.projiziere(pt.anker);
        const ok = sichtbar > 0.02 && q.w > 0;
        el.style.opacity = ok ? String(sichtbar) : '0';
        el.style.pointerEvents = ok && sichtbar > 0.5 ? 'auto' : 'none';
        knopf.tabIndex = ok && sichtbar > 0.5 ? 0 : -1;
        if (ok) {
          el.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)`;
          const dx = clamp(pt.dx, -q.x + 80, window.innerWidth - q.x - 150);
          knopf.style.transform = `translate(${dx.toFixed(0)}px, ${pt.dy}px) translate(-50%, -50%)`;
          l.setAttribute('x2', dx.toFixed(0)); l.setAttribute('y2', String(pt.dy));
        }
      });

      // Home-Logo: bewegt sich nur ganz leicht mit dem Zeiger
      if (mini && miniKnopf) {
        const r = miniKnopf.getBoundingClientRect();
        const dx = zeigerX - (r.left + r.width / 2); const dy = zeigerY - (r.top + r.height / 2);
        miniGier = glatt(miniGier, -20 + 9 * Math.tanh(dx / 500), miniG, 0.35, dt);
        miniNick = glatt(miniNick, 6 + 6 * Math.tanh(dy / 400), miniN, 0.35, dt);
        miniDreh = glatt(miniDreh, miniDrehZiel, miniDrehV, 0.5, dt);
        mini.zeichnen({ gier: miniGier + miniDreh, nick: miniNick, roll: Math.sin(t * 0.6) * 1.2, f: [0, 0, 0], zoom: 2.05, hub: Math.sin(t * 1.1) * 0.025, licht: 0, drift: 0, zeit: t, tiefe: 0 });
      }
      requestAnimationFrame(bild);
    };
    requestAnimationFrame(bild);
  }

  /* ---------- Ablauf mit Sicherheitsnetz ---------- */
  D.start();
  fetch(SVG_QUELLE)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
    .then((text) => {
      const koerper = koerperAusSvg(text);
      const motor = rendererBauen(canvas, koerper, false, tafelKoerper());
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); wurzel.classList.remove('ist-3d'); });
      let mini = null;
      try {
        if (miniCanvas) {
          mini = rendererBauen(miniCanvas, koerper, true, null);
          miniCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (miniKnopf) miniKnopf.hidden = true; });
        }
      } catch (fehler) { if (miniKnopf) miniKnopf.hidden = true; }

      const intro = festP === null && !reduziert;
      const k0 = bahnWert(festP === null ? 0 : festP);
      motor.zeichnen({                                        // erstes Bild passt zum Anfang des Intros
        gier: k0.gier - (intro ? 342 : 0), nick: k0.nick - (intro ? 12 : 0), roll: k0.roll, f: k0.f, zoom: k0.zoom * (intro ? 0.42 : 1),
        hub: intro ? 0.95 : 0, licht: intro ? -85 : 0, drift: 0, zeit: 0, tiefe: intro ? 1 : 0.1,
      });
      wurzel.classList.add('ist-3d');
      if (reduziert) wurzel.classList.add('ruhig');
      laufen(motor, mini);
    })
    .catch((fehler) => {
      wurzel.classList.remove('ist-3d');
      if (window.console) console.warn('3D-Szene nicht verfügbar:', fehler.message);
    });
})();
