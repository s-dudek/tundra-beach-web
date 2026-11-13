// Die Bildmarke als echter 3D-Körper (WebGL2), frei schwebend zwischen Blasen und Staub im Raum.
// Ziehen dreht sie und lässt sie weich auslaufen, Scrollen fährt die Kamera durch verschiedene Perspektiven
// (Bahn aus Schlüsselbildern, weich verbunden). Alle Bewegungen laufen über gedämpfte Federn.
// Oben links schaut eine Mini-Marke dem Zeiger hinterher, ein Klick startet die Animation von vorn.
// Klappt WebGL nicht, bleibt die flache gelbe Bildmarke stehen.
(() => {
  'use strict';

  const G = window.TB3D;
  const wurzel = document.documentElement;
  const tour = document.getElementById('tour');
  const canvas = document.getElementById('marke3d');
  const hinweis = document.getElementById('hinweis');
  const miniKnopf = document.getElementById('mini');
  const miniCanvas = document.getElementById('mini3d');
  if (!G || !tour || !canvas) return;

  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const abfrage = new URLSearchParams(window.location.search);
  // ?p=0.5 zeigt direkt eine Perspektive (Vorschau/Prüfung), ohne Intro und ohne Scrollen
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

  /* ---------- Kamerabahn: die Perspektiven beim Scrollen ----------
     Eine Zeile = ein Schlüsselbild bei Scroll-Fortschritt p (0 bis 1).
     gier/nick/roll in Grad, f = Blickpunkt in Welteinheiten (Marke ist 2 hoch), zoom 1 = ganze Marke im Bild,
     zerleg = Schichten auseinanderziehen. Dazwischen wird mit einer Spline weich übergeblendet. */
  const BAHN = [
    { p: 0.00, gier: -18, nick: 6, roll: 0, f: [0, 0, 0], zoom: 1.28, zerleg: 0 },        // Start: schwebt vor dir
    { p: 0.12, gier: -60, nick: 9, roll: -3, f: [0, 0, 0], zoom: 1.38, zerleg: 0 },       // dreht sich: Tiefe wird sichtbar
    { p: 0.25, gier: -96, nick: 5, roll: 0, f: [0, 0, 0], zoom: 1.55, zerleg: 0 },        // von der Seite: die Dicke
    { p: 0.38, gier: -34, nick: 52, roll: 5, f: [0, 0, 0], zoom: 1.3, zerleg: 0 },        // von oben: Nase und Relief
    { p: 0.52, gier: -12, nick: 4, roll: 0, f: [-0.24, 0.155, 0.1], zoom: 3.4, zerleg: 0 }, // ganz nah: das Auge
    { p: 0.64, gier: 28, nick: -4, roll: -3, f: [0.55, 0.2, 0.1], zoom: 2.0, zerleg: 0 }, // Nase
    { p: 0.76, gier: 22, nick: -16, roll: 4, f: [-0.7, 0.48, 0.12], zoom: 2.1, zerleg: 0 }, // Schnorchel
    { p: 0.88, gier: -148, nick: 12, roll: 0, f: [0, 0, 0], zoom: 1.3, zerleg: 0 },       // schräg von hinten
    { p: 1.00, gier: -336, nick: 10, roll: 0, f: [0, 0, 0], zoom: 1.1, zerleg: 0.26 },    // Schichten auseinander
  ];


  /* ---------- Zeiten ---------- */
  const INTRO = 7.5;          // Sekunden: Auftauchen (Kamera fährt heran, Blasen rauschen vorbei, Licht wandert)
  const SCROLL_GLATT = 0.62;  // Sekunden: so weich folgt die Kamera dem Scrollen
  const ZIEH_GLATT = 0.12;    // so weich folgt die Marke dem Finger
  const AUSLAUF = 0.55;       // Sekunden, die die Marke nach dem Loslassen noch mitgleitet
  const RUECK_GLATT = 1.6;    // so weich dreht sie nach Ruhe wieder in die Bahn zurück
  const RUHE = 2.4;           // Sekunden ohne Berühren, bis sie zurückdreht

  /* ---------- Gedämpfte Feder (SmoothDamp): sanfter Start, sanftes Auslaufen, kein Überschwingen ---------- */
  function glatt(aktuell, ziel, geschw, zeit, dt) {
    const omega = 2 / Math.max(0.0001, zeit);
    const x = omega * dt;
    const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const aenderung = aktuell - ziel;
    const temp = (geschw.v + omega * aenderung) * dt;
    geschw.v = (geschw.v - omega * temp) * e;
    return ziel + (aenderung + temp) * e;
  }

  /* ---------- Spline durch die Schlüsselbilder (Catmull-Rom, Geschwindigkeit bleibt stetig) ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut4 = (t) => 1 - (1 - t) ** 4;
  const rad = (g) => (g * Math.PI) / 180;

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
    const k0 = BAHN[Math.max(0, i - 1)]; const k3 = BAHN[Math.min(n - 1, i + 2)];
    const werte = (k) => [k.gier, k.nick, k.roll, k.f[0], k.f[1], k.f[2], Math.log(k.zoom), k.zerleg];
    const w0 = werte(k0); const w1 = werte(a); const w2 = werte(b); const w3 = werte(k3);
    const r = w1.map((_, j) => catmull(w0[j], w1[j], w2[j], w3[j], t));
    return { gier: r[0], nick: r[1], roll: r[2], f: [r[3], r[4], r[5]], zoom: Math.exp(r[6]), zerleg: Math.max(0, r[7]) };
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

  /* ---------- Farben ---------- */
  const linear = (hex) => {
    const h = hex.replace('#', '');
    const voll = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => (parseInt(voll.slice(i, i + 2), 16) / 255) ** 2.2);
  };

  /* ---------- Körper aus der SVG bauen ---------- */
  function koerperAusSvg(text) {
    // Farben aus dem style-Block lesen und den Block vor dem Parsen entfernen (die Seiten-CSP erlaubt keine Inline-Styles)
    const farben = {};
    text.replace(/\.(cls-\d+)\s*\{[^}]*?fill:\s*(#[0-9a-fA-F]{3,6})/g, (_, k, f) => { farben[k] = f; });
    const doc = new DOMParser().parseFromString(text.replace(/<style[\s\S]*?<\/style>/, ''), 'image/svg+xml');
    const alle = [...doc.querySelectorAll('path, polygon')];

    // Mitte und Größe der Marke aus dem gelben Schild
    const platte = alle[SCHICHTEN[0].nr];
    const dPlatte = platte && platte.getAttribute('d');
    if (!dPlatte) throw new Error('Schild nicht gefunden');
    const kPlatte = G.pfadLesen(dPlatte, 0.8).flat();
    const xs = kPlatte.map((p) => p[0]); const ys = kPlatte.map((p) => p[1]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    if (maxX - minX < 150 || maxX - minX > 230 || maxY - minY < 150 || maxY - minY > 230) throw new Error('Maße der Marke unerwartet');
    const mx = (minX + maxX) / 2; const my = (minY + maxY) / 2;
    const s = 2 / (maxY - minY); // Marke ist 2 Einheiten hoch

    const pos = []; const nor = []; const farbe = []; const par = []; const idx = [];
    SCHICHTEN.forEach((sch, rang) => {
      const el = alle[sch.nr];
      const d = el && el.getAttribute('d');
      if (!d) return;
      const rgb = linear(farben[el.getAttribute('class')] || '#2c2c2b');
      const konturen = G.pfadLesen(d, 0.8).map((k) => k.map((p) => [(p[0] - mx) * s, -(p[1] - my) * s]));
      G.polygone(konturen).forEach((pg) => {
        const k = G.koerperBauen(pg, {
          unten: sch.platte ? sch.unten * s : 0,
          oben: sch.platte ? 0 : sch.hoehe * s,
          fasenOben: sch.fase * s,
          fasenUnten: sch.platte ? sch.fase * s : 0,
          unterseite: !!sch.platte,
          stufen: 5,
          abtastung: 0.5 * s,
        });
        const basis = pos.length / 3;
        for (let i = 0; i < k.pos.length / 3; i += 1) {
          pos.push(k.pos[i * 3], k.pos[i * 3 + 1], k.pos[i * 3 + 2]);
          nor.push(k.nor[i * 3], k.nor[i * 3 + 1], k.nor[i * 3 + 2]);
          farbe.push(rgb[0], rgb[1], rgb[2]);
          par.push(sch.glanz, k.hoehe[i], rang);
        }
        k.idx.forEach((i) => idx.push(basis + i));
      });
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

  /* ---------- Shader ---------- */
  const VS = `#version 300 es
  layout(location=0) in vec3 a_pos; layout(location=1) in vec3 a_nor; layout(location=2) in vec3 a_col; layout(location=3) in vec3 a_par;
  uniform mat4 u_vp; uniform mat4 u_lightVP; uniform float u_explode;
  out vec3 v_wpos; out vec3 v_nor; out vec3 v_col; out vec3 v_par; out vec4 v_shadow; out vec2 v_xy;
  void main(){
    vec3 p = a_pos; p.z += a_par.z * u_explode;
    v_wpos = p; v_nor = a_nor; v_col = a_col; v_par = a_par; v_xy = a_pos.xy;
    v_shadow = u_lightVP * vec4(p + a_nor * 0.012, 1.0);
    gl_Position = u_vp * vec4(p, 1.0);
  }`;

  const FS = `#version 300 es
  precision highp float; precision highp sampler2DShadow;
  in vec3 v_wpos; in vec3 v_nor; in vec3 v_col; in vec3 v_par; in vec4 v_shadow; in vec2 v_xy;
  uniform sampler2DShadow u_shadow; uniform vec3 u_cam; uniform vec3 u_light; uniform float u_texel; uniform float u_mitSchatten;
  out vec4 outColor;
  vec3 env(vec3 d){
    d = normalize(d);
    float up = d.y * 0.5 + 0.5;
    vec3 c = mix(vec3(0.50, 0.52, 0.56), vec3(0.98), smoothstep(0.15, 0.9, up));
    float b1 = smoothstep(0.80, 0.93, dot(d, normalize(vec3(-0.55, 0.75, 0.55))));
    float b2 = smoothstep(0.86, 0.96, dot(d, normalize(vec3(0.85, 0.15, 0.45))));
    float b3 = smoothstep(0.80, 0.97, dot(d, normalize(vec3(0.1, -0.3, 0.9)))) * 0.5;
    float b4 = smoothstep(0.82, 0.95, dot(d, normalize(vec3(0.0, 0.6, -0.8)))) * 0.9;
    float rim = smoothstep(0.55, 1.0, dot(d, vec3(0.0, 0.2, -1.0))) * 0.7;
    return c * 0.85 + vec3(1.0) * b1 * 1.9 + vec3(0.92, 0.96, 1.0) * b2 * 1.1 + vec3(1.0) * (b3 + b4) + vec3(0.85) * rim;
  }
  void main(){
    vec3 N = normalize(v_nor);
    // Obere Flächen minimal wölben, damit Glanzlichter beim Drehen über sie wandern
    float kappe = smoothstep(0.85, 1.0, abs(N.z));
    N = normalize(N + vec3(v_xy * 0.28, 0.0) * kappe * 0.6);
    vec3 V = normalize(u_cam - v_wpos);
    vec3 L = normalize(u_light);
    // Rückseiten (Blick von hinten): Normale zum Betrachter drehen, damit sie nicht schwarz werden
    if (dot(N, V) < 0.0 && abs(v_nor.z) > 0.9) N = -N;
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
    vec3 ambient = mix(vec3(0.50, 0.50, 0.52), vec3(0.78, 0.80, 0.84), hemi);

    vec3 key = vec3(1.0, 0.98, 0.94) * 1.05;
    vec3 fill = vec3(0.80, 0.86, 1.0) * 0.26 * max(dot(N, normalize(vec3(0.85, -0.2, 0.5))), 0.0);
    vec3 col = v_col * (ambient * ao * 0.62 + key * ndl * (0.30 + 0.70 * sh) * 0.98 + fill);

    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 40.0 + 260.0 * gloss) * (0.25 + 0.9 * gloss) * sh;
    float ndv = max(dot(N, V), 0.0);
    float fres = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
    vec3 refl = env(reflect(-V, N));
    col += refl * (0.022 + 0.38 * fres) * (0.30 + 0.70 * gloss) * ao;
    col += vec3(1.0, 0.99, 0.96) * spec;

    col = col / (1.0 + 0.06 * col);
    outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
  }`;

  const VS_TIEFE = `#version 300 es
  layout(location=0) in vec3 a_pos; layout(location=3) in vec3 a_par;
  uniform mat4 u_lightVP; uniform float u_explode;
  void main(){ vec3 p = a_pos; p.z += a_par.z * u_explode; gl_Position = u_lightVP * vec4(p, 1.0); }`;
  const FS_TIEFE = `#version 300 es
  precision mediump float; void main(){}`;

  // Weicher Schatten auf einem unsichtbaren Boden unter der schwebenden Marke (in der Welt, perspektivisch richtig)
  const VS_BODEN = `#version 300 es
  layout(location=0) in vec2 a; uniform mat4 u_vp; uniform vec3 u_mitte; uniform float u_gr; out vec2 v;
  void main(){ v = a; gl_Position = u_vp * vec4(u_mitte.x + a.x * u_gr, u_mitte.y, u_mitte.z + a.y * u_gr * 0.6, 1.0); }`;
  const FS_BODEN = `#version 300 es
  precision mediump float; in vec2 v; uniform float u_st; out vec4 o;
  void main(){ float r = dot(v, v); float a = smoothstep(1.0, 0.0, r) * u_st; o = vec4(vec3(0.17) * a, a); }`;

  // Teilchen im Raum: Luftblasen, Staub und kleine Farbpunkte, fest in der Welt (Parallaxe beim Kamerafahren)
  const VS_TEILCHEN = `#version 300 es
  layout(location=0) in vec4 a_seed;
  uniform mat4 u_vp; uniform vec3 u_cam; uniform float u_drift; uniform float u_zeit; uniform float u_focal; uniform float u_fokus; uniform float u_maxPt;
  out float v_typ; out float v_alpha; out float v_unsch; out vec3 v_farbe;
  void main(){
    float s = a_seed.w;
    vec3 p = (a_seed.xyz - 0.5) * vec3(15.0, 10.0, 15.0);
    p.y = mod(p.y + u_drift * (0.55 + 0.9 * fract(s * 7.31)) + 5.0, 10.0) - 5.0;
    p.x += sin(u_zeit * 0.35 + s * 40.0) * 0.35;
    p.z += cos(u_zeit * 0.28 + s * 31.0) * 0.35;
    float r = length(p);
    if (r < 1.9) p = p / max(r, 0.001) * (1.9 + (1.9 - r) * 0.2);      // Raum um die Marke bleibt frei
    float dist = length(p - u_cam);
    float tv = fract(s * 13.7);
    float typ = tv < 0.55 ? 0.0 : (tv < 0.86 ? 1.0 : 2.0);
    float radius = mix(0.02, 0.095, pow(fract(s * 5.3), 1.7)) * (typ > 0.5 ? 0.6 : 1.0);
    float unsch = clamp(abs(dist - u_fokus) / (u_fokus * 0.9), 0.0, 1.0);
    float px = 2.0 * radius * u_focal / max(dist, 0.05) * (1.0 + unsch * 1.5);
    gl_PointSize = clamp(px, 1.5, u_maxPt);
    gl_Position = u_vp * vec4(p, 1.0);
    float a = typ < 0.5 ? 0.95 : (typ < 1.5 ? 0.6 : 0.9);
    a *= 1.0 - 0.5 * unsch;
    a *= smoothstep(0.25, 1.1, dist) * (1.0 - smoothstep(11.0, 17.0, dist));
    a *= clamp(px / 3.0, 0.0, 1.0);
    v_typ = typ; v_alpha = a; v_unsch = unsch;
    float f = fract(s * 3.1);
    v_farbe = f < 0.45 ? vec3(0.984, 0.729, 0.0) : (f < 0.8 ? vec3(0.255, 0.388, 0.612) : vec3(0.6, 0.325, 0.424));
  }`;
  const FS_TEILCHEN = `#version 300 es
  precision mediump float;
  in float v_typ; in float v_alpha; in float v_unsch; in vec3 v_farbe;
  out vec4 o;
  void main(){
    vec2 pc = gl_PointCoord * 2.0 - 1.0;
    float d = length(pc);
    if (d > 1.0) discard;
    float weich = mix(0.05, 0.4, v_unsch);
    vec3 rgb; float a;
    if (v_typ < 0.5) {                                            // Luftblase
      float rim = smoothstep(0.66 - weich * 0.4, 0.94, d) * (1.0 - smoothstep(0.94, 1.0, d));
      float bogen = smoothstep(0.1, 0.0, abs(d - 0.62)) * smoothstep(0.15, 0.75, dot(normalize(pc + 0.0001), normalize(vec2(-0.7, -0.7))));
      float unten = smoothstep(0.35, 1.0, dot(pc, vec2(0.6, 0.8))) * 0.16;
      vec3 rand = vec3(0.34, 0.46, 0.64);
      a = clamp(0.07 + 0.62 * rim + 0.45 * bogen + unten, 0.0, 1.0);
      rgb = mix(rand, vec3(0.55, 0.68, 0.86), bogen) ;
    } else if (v_typ < 1.5) {                                     // Staub
      a = (1.0 - d) * (1.0 - d) * 0.6; rgb = vec3(0.42, 0.45, 0.5);
    } else {                                                      // kleine Farbkugel
      vec3 n = vec3(pc.x, -pc.y, sqrt(max(0.0, 1.0 - d * d)));
      float diff = 0.5 + 0.5 * dot(n, normalize(vec3(-0.5, 0.6, 0.65)));
      float spec = pow(max(dot(reflect(vec3(0.0, 0.0, -1.0), n), normalize(vec3(-0.5, 0.6, 0.65))), 0.0), 18.0) * 0.5;
      rgb = v_farbe * diff + vec3(spec);
      a = smoothstep(1.0, 0.8 - weich, d);
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
  // mini = kleine Marke oben links: kein Schatten, keine Teilchen, kleine Auflösung
  function rendererBauen(zielCanvas, koerper, mini) {
    const gl = zielCanvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, depth: true, stencil: false });
    if (!gl) throw new Error('WebGL2 fehlt');

    const pHaupt = programm(gl, VS, FS);
    const u = (pr, n) => gl.getUniformLocation(pr, n);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, koerper.daten, gl.STATIC_DRAW);
    [[0, 3, 0], [1, 3, 3], [2, 3, 6], [3, 3, 9]].forEach(([i, n, o]) => {
      gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, 48, o * 4);
    });
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, koerper.indizes, gl.STATIC_DRAW);
    const anzahl = koerper.indizes.length;

    let pTiefe; let pBoden; let pTeil; let fbo; let tiefe; let vaoQ; let vaoT; let teilAnzahl = 0; let maxPunkt = 64;
    const SK = 1536;
    if (!mini) {
      pTiefe = programm(gl, VS_TIEFE, FS_TIEFE);
      pBoden = programm(gl, VS_BODEN, FS_BODEN);
      pTeil = programm(gl, VS_TEILCHEN, FS_TEILCHEN);

      // Schattenkarte
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

      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      vaoQ = gl.createVertexArray();
      gl.bindVertexArray(vaoQ);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      // Teilchen: feste Zufallswerte (immer gleiche Verteilung)
      teilAnzahl = window.innerWidth < 700 ? 150 : 300;
      const samen = new Float32Array(teilAnzahl * 4);
      let zufall = 12345;
      const rnd = () => { zufall = (zufall * 1664525 + 1013904223) >>> 0; return zufall / 4294967296; };
      for (let i = 0; i < samen.length; i += 1) samen[i] = rnd();
      const tb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, tb); gl.bufferData(gl.ARRAY_BUFFER, samen, gl.STATIC_DRAW);
      vaoT = gl.createVertexArray();
      gl.bindVertexArray(vaoT);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      maxPunkt = Math.min(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1], 110);
    }

    const FOV = rad(20);
    const KEY = [-0.4, 0.75, 0.65]; // Licht, in Kamerarichtung gesehen

    function groesse() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const b = Math.max(2, Math.round(zielCanvas.clientWidth * dpr));
      const h = Math.max(2, Math.round(zielCanvas.clientHeight * dpr));
      if (zielCanvas.width !== b || zielCanvas.height !== h) { zielCanvas.width = b; zielCanvas.height = h; }
      return b / h;
    }

    // z: { gier, nick, roll (Grad), f (Blickpunkt), zoom, zerleg, hub (Schweben), schatten, licht (Grad), drift, zeit }
    function zeichnen(z) {
      const aspekt = groesse();
      const basis = Math.max(2.2, 1.7 / aspekt) / Math.tan(FOV / 2);
      const abst = basis / z.zoom;

      const f = [z.f[0], z.f[1] + z.hub, z.f[2]];
      const R = mat.mul(mat.dreheZ(rad(z.roll)), mat.mul(mat.dreheX(rad(z.nick)), mat.dreheY(rad(z.gier))));
      const ansicht = mat.mul(mat.verschieben(0, 0, -abst), mat.mul(R, mat.verschieben(-f[0], -f[1], -f[2])));
      const vp = mat.mul(mat.persp(FOV, aspekt, Math.max(0.05, abst - 3.2), abst + 22), ansicht);
      // Kameraposition und Licht in Weltkoordinaten (R^T); das Licht schwenkt beim Intro um die senkrechte Achse
      const cam = [f[0] + abst * R[2], f[1] + abst * R[6], f[2] + abst * R[10]];
      const lw = rad(z.licht || 0);
      const kl = [KEY[0] * Math.cos(lw) + KEY[2] * Math.sin(lw), KEY[1], -KEY[0] * Math.sin(lw) + KEY[2] * Math.cos(lw)];
      const kn = Math.hypot(kl[0], kl[1], kl[2]);
      const licht = [0, 1, 2].map((i) => (R[i * 4] * kl[0] + R[i * 4 + 1] * kl[1] + R[i * 4 + 2] * kl[2]) / kn);

      let lichtVP = new Float32Array(16);
      if (!mini) {
        // 1) Tiefe aus Sicht des Lichts
        lichtVP = mat.mul(mat.ortho(-2.6, 2.6, -2.6, 2.6, 0.5, 11), mat.blick(licht.map((v) => v * 6), [0, 0, 0], [0, 1, 0]));
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, SK, SK);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
        gl.useProgram(pTiefe);
        gl.uniformMatrix4fv(u(pTiefe, 'u_lightVP'), false, lichtVP);
        gl.uniform1f(u(pTiefe, 'u_explode'), z.zerleg);
        gl.bindVertexArray(vao);
        gl.drawElements(gl.TRIANGLES, anzahl, gl.UNSIGNED_INT, 0);
      }

      // 2) Bild
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, zielCanvas.width, zielCanvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);

      if (!mini) {
        // weicher Schatten auf dem Boden unter der Marke
        gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(pBoden);
        gl.uniformMatrix4fv(u(pBoden, 'u_vp'), false, vp);
        gl.uniform3f(u(pBoden, 'u_mitte'), 0, -1.4 - z.hub * 0.4, 0);
        gl.uniform1f(u(pBoden, 'u_gr'), 1.0);
        gl.uniform1f(u(pBoden, 'u_st'), 0.17 * z.schatten * Math.max(0, 1 - z.zerleg * 2.5));
        gl.bindVertexArray(vaoQ);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
      }

      gl.useProgram(pHaupt);
      gl.uniformMatrix4fv(u(pHaupt, 'u_vp'), false, vp);
      gl.uniformMatrix4fv(u(pHaupt, 'u_lightVP'), false, lichtVP);
      gl.uniform3fv(u(pHaupt, 'u_cam'), cam);
      gl.uniform3fv(u(pHaupt, 'u_light'), licht);
      gl.uniform1f(u(pHaupt, 'u_explode'), z.zerleg);
      gl.uniform1f(u(pHaupt, 'u_texel'), 1 / SK);
      gl.uniform1f(u(pHaupt, 'u_mitSchatten'), mini ? 0 : 1);
      if (!mini) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tiefe); }
      gl.uniform1i(u(pHaupt, 'u_shadow'), 0);
      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, anzahl, gl.UNSIGNED_INT, 0);

      if (!mini) {
        // Teilchen hinter und vor der Marke (Tiefentest ohne Schreiben), weich überblendet
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.useProgram(pTeil);
        gl.uniformMatrix4fv(u(pTeil, 'u_vp'), false, vp);
        gl.uniform3fv(u(pTeil, 'u_cam'), cam);
        gl.uniform1f(u(pTeil, 'u_drift'), z.drift);
        gl.uniform1f(u(pTeil, 'u_zeit'), z.zeit);
        gl.uniform1f(u(pTeil, 'u_focal'), (zielCanvas.height / 2) / Math.tan(FOV / 2));
        gl.uniform1f(u(pTeil, 'u_fokus'), abst);
        gl.uniform1f(u(pTeil, 'u_maxPt'), maxPunkt);
        gl.bindVertexArray(vaoT);
        gl.drawArrays(gl.POINTS, 0, teilAnzahl);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
    }
    return { zeichnen };
  }

  /* ---------- Bewegung: Intro, Scrollen, Ziehen, Mini-Marke ---------- */
  function laufen(motor, mini) {
    let offGier = 0; let offNick = 0;
    const standbild = () => {
      const k = bahnWert(festP === null ? 0 : festP);
      motor.zeichnen({ gier: k.gier + offGier, nick: clamp(k.nick + offNick, -85, 85), roll: k.roll, f: k.f, zoom: k.zoom, zerleg: k.zerleg, hub: 0, schatten: 1, licht: 0, drift: 0, zeit: 0 });
      if (mini) mini.zeichnen({ gier: -20, nick: 6, roll: 0, f: [0, 0, 0], zoom: 2.05, zerleg: 0, hub: 0, schatten: 0, licht: 0, drift: 0, zeit: 0 });
    };

    // Ziehen (Zeiger): horizontal = Gieren, vertikal (nur Maus) = Nicken
    let zieht = false; let lastX = 0; let lastY = 0; let startT = 0; let bewegt = 0;
    let vGier = 0; let vNick = 0; let letzterZug = 0;
    const zielG = { w: 0 }; const zielN = { w: 0 };
    let ruheSeit = 0;

    canvas.addEventListener('pointerdown', (e) => {
      zieht = true; lastX = e.clientX; lastY = e.clientY; startT = performance.now(); bewegt = 0; vGier = 0; vNick = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('zieht');
      hinweis.classList.add('weg');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!zieht) return;
      const dx = e.clientX - lastX; const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; bewegt += Math.abs(dx) + Math.abs(dy);
      const dg = dx * 0.45; const dn = e.pointerType === 'mouse' ? dy * 0.3 : 0;
      zielG.w += dg; zielN.w = clamp(zielN.w + dn, -70, 70);
      const jetzt = performance.now(); const dtz = Math.max(8, jetzt - letzterZug) / 1000; letzterZug = jetzt;
      vGier = lerp(vGier, dg / dtz, 0.5); vNick = lerp(vNick, dn / dtz, 0.5);
    });
    const loslassen = () => {
      if (!zieht) return;
      zieht = false; canvas.classList.remove('zieht');
      const kurz = bewegt < 6 && performance.now() - startT < 350;
      if (kurz) zielG.w += 360;                              // Antippen: einmal ganz herum
      else {
        const frisch = performance.now() - letzterZug < 90;  // Schwung nur, wenn der Finger noch in Bewegung war
        zielG.w += clamp((frisch ? vGier : 0) * AUSLAUF, -540, 540);
        zielN.w = clamp(zielN.w + (frisch ? vNick : 0) * AUSLAUF, -70, 70);
      }
      ruheSeit = 0;
    };
    canvas.addEventListener('pointerup', loslassen);
    canvas.addEventListener('pointercancel', loslassen);

    // Zeiger für die Mini-Marke (auch Berührung)
    let zeigerX = window.innerWidth * 0.5; let zeigerY = window.innerHeight * 0.5;
    window.addEventListener('pointermove', (e) => { zeigerX = e.clientX; zeigerY = e.clientY; }, { passive: true });

    if (reduziert) {
      canvas.addEventListener('pointermove', () => { if (zieht) { offGier = zielG.w; offNick = zielN.w; standbild(); } });
      window.addEventListener('resize', standbild);
      if (miniKnopf) miniKnopf.addEventListener('click', () => { window.scrollTo(0, 0); });
      standbild();
      return;
    }

    const velG = { v: 0 }; const velN = { v: 0 }; const velP = { v: 0 };
    const miniG = { v: 0 }; const miniN = { v: 0 };
    let p = festP === null ? 0 : festP;
    let t = 0; let introT = festP === null ? 0 : INTRO;
    let letzte = performance.now();
    let drift = 0; let miniGier = -20; let miniNick = 6; let miniDreh = 0; let miniDrehZiel = 0; const miniDrehV = { v: 0 };

    // Neustart: alles zurück auf Anfang, Intro läuft erneut
    const neustart = () => {
      window.scrollTo(0, 0);
      p = 0; velP.v = 0; introT = 0;
      offGier = 0; offNick = 0; zielG.w = 0; zielN.w = 0; velG.v = 0; velN.v = 0; ruheSeit = 0;
      hinweis.classList.remove('weg');
      miniDrehZiel += 360;                                    // die Mini-Marke dreht sich dabei einmal herum
    };
    if (miniKnopf) miniKnopf.addEventListener('click', neustart);

    const bild = (jetzt) => {
      const dt = Math.min(0.05, Math.max(0.001, (jetzt - letzte) / 1000)); letzte = jetzt; t += dt; introT += dt;

      // Scroll-Fortschritt, weich nachgezogen
      let ziel = 0;
      if (festP !== null) ziel = festP;
      else {
        const max = Math.max(1, tour.offsetHeight - window.innerHeight);
        ziel = clamp(window.scrollY / max);
      }
      p = glatt(p, ziel, velP, SCROLL_GLATT, dt);
      if (p > 0.02) hinweis.classList.add('weg');

      // Ziehen: Marke folgt weich, nach Ruhe dreht sie sanft zurück in die Bahn
      if (!zieht) {
        ruheSeit += dt;
        if (ruheSeit > RUHE && (Math.abs(offGier) > 0.01 || Math.abs(offNick) > 0.01)) {
          const voll = 360 * Math.round(offGier / 360);      // ganze Umdrehungen sehen gleich aus: ohne Sprung abziehen
          offGier -= voll;
          zielG.w = 0; zielN.w = 0;
        }
      }
      const folg = zieht ? ZIEH_GLATT : (ruheSeit > RUHE ? RUECK_GLATT : AUSLAUF);
      offGier = glatt(offGier, zielG.w, velG, folg, dt);
      offNick = glatt(offNick, zielN.w, velN, folg, dt);

      // Intro "Auftauchen": Kamera fährt aus der Tiefe heran, Blasen rauschen vorbei, die Marke taucht auf und dreht sich ein,
      // ein Lichtstrahl wandert über das Schild. Die Marke ist von Anfang an da.
      const e = easeOut4(clamp(introT / INTRO));
      const rest = 1 - e;
      const k = bahnWert(p);
      const sanft = 1 / Math.sqrt(k.zoom);                   // beim Heranzoomen schwebt sie weniger
      const hub = Math.sin(t * 0.85) * 0.035 * sanft + 0.95 * rest * rest;
      const schwank = Math.sin(t * 0.5) * 1.6 * sanft;
      drift += dt * (0.14 + 6.5 * rest * rest * rest);       // anfangs rasen die Blasen nach oben, dann treiben sie ruhig
      motor.zeichnen({
        gier: k.gier - 342 * rest * rest + offGier + schwank,
        nick: clamp(k.nick - 12 * rest + offNick + Math.sin(t * 0.37) * 1.2 * sanft, -88, 88),
        roll: k.roll + Math.sin(t * 0.43) * 0.9 * sanft,
        f: k.f, zoom: k.zoom * lerp(0.42, 1, e), zerleg: k.zerleg, hub, schatten: clamp(1 - rest * 1.4, 0, 1),
        licht: -85 * rest, drift, zeit: t,
      });

      // Mini-Marke: schaut dem Zeiger hinterher
      if (mini && miniKnopf) {
        const r = miniKnopf.getBoundingClientRect();
        const dx = zeigerX - (r.left + r.width / 2); const dy = zeigerY - (r.top + r.height / 2);
        miniGier = glatt(miniGier, -20 + 50 * Math.tanh(dx / 320), miniG, 0.22, dt);
        miniNick = glatt(miniNick, 6 + 32 * Math.tanh(dy / 260), miniN, 0.22, dt);
        miniDreh = glatt(miniDreh, miniDrehZiel, miniDrehV, 0.5, dt);
        mini.zeichnen({
          gier: miniGier + miniDreh, nick: miniNick, roll: Math.sin(t * 0.6) * 1.5, f: [0, 0, 0], zoom: 2.05,
          zerleg: 0, hub: Math.sin(t * 1.1) * 0.03, schatten: 0, licht: 0, drift: 0, zeit: t,
        });
      }
      requestAnimationFrame(bild);
    };
    requestAnimationFrame(bild);
  }

  /* ---------- Ablauf mit Sicherheitsnetz ---------- */
  fetch(SVG_QUELLE)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
    .then((text) => {
      const koerper = koerperAusSvg(text);
      const motor = rendererBauen(canvas, koerper, false);
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); wurzel.classList.remove('ist-3d'); });
      let mini = null;
      try {
        if (miniCanvas) {
          mini = rendererBauen(miniCanvas, koerper, true);
          miniCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (miniKnopf) miniKnopf.hidden = true; });
        }
      } catch (fehler) { if (miniKnopf) miniKnopf.hidden = true; }

      const intro = festP === null && !reduziert;
      const k0 = bahnWert(festP === null ? 0 : festP);
      motor.zeichnen({                                        // erstes Bild passt zum Anfang des Intros
        gier: k0.gier - (intro ? 342 : 0), nick: k0.nick - (intro ? 12 : 0), roll: k0.roll, f: k0.f, zoom: k0.zoom * (intro ? 0.42 : 1),
        zerleg: k0.zerleg, hub: intro ? 0.95 : 0, schatten: intro ? 0 : 1, licht: intro ? -85 : 0, drift: 0, zeit: 0,
      });
      wurzel.classList.add('ist-3d');
      if (reduziert) wurzel.classList.add('ruhig');
      laufen(motor, mini);
    })
    .catch((fehler) => {
      wurzel.classList.remove('ist-3d');
      if (window.console) console.warn('3D-Bildmarke nicht verfügbar:', fehler.message);
    });
})();
