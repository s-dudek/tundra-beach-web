// Tundra Beach unter Wasser (WebGL2): Die Bildmarke schwebt als echter 3D-Körper im Wasser, zwischen Blasen,
// Meeresstaub und Plankton, mit Lichtstrahlen und Lichtmustern. Die Bereiche (Wasserstand, Wetter, Kalender, Kontakt)
// sind Seifenblasen mit Symbol, die um die Marke schweben. Scrollen zoomt hinein und hinaus, Blase für Blase, ein Klick fliegt hin,
// dort erscheinen die Inhalte als Text in der Blase. Wo der Zeiger entlangfährt, steigen kleine Blasen auf.
// Alle Bewegungen laufen über gedämpfte Federn. Klappt WebGL nicht, bleibt die flache Bildmarke mit den Inhalten als Text.
(() => {
  'use strict';

  const G = window.TB3D;
  const D = window.TBDaten;
  const T = window.TBSymbole;
  const wurzel = document.documentElement;
  const tour = document.getElementById('tour');
  const canvas = document.getElementById('marke3d');
  const hinweis = document.getElementById('hinweis');
  const miniKnopf = document.getElementById('mini');
  const miniCanvas = document.getElementById('mini3d');
  const blasenHalter = document.getElementById('blasen');
  const zurueck = document.getElementById('zurueck');
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

  /* ---------- Bereiche als Blasen im Wasser ---------- */
  // Lage in der Startansicht: [rechts, hoch, Tiefe] im Blickfeld, für Querformat (quer) und Hochformat (hoch);
  // unten = der Name steht oberhalb der Blase (zur Marke hin), damit er nicht am Bildrand klebt.
  // Die Kamera behält beim Besuch ihre Blickrichtung: Scrollen und Klicken zoomen nur hinein und wieder hinaus.
  const S_GIER = -18; const S_NICK = 6; const S_ZOOM = 1.28;       // Anfangsperspektive: ganze Marke im Bild
  const BLASE_R = 0.42;                                             // Radius einer Blase (die Marke ist 2 hoch)
  const BLASEN = {
    wasserstand: { titel: 'Wasserstand', unter: 'Isel · Lienz', quer: [-2.15, 0.9, 0.5], hoch: [-0.75, 1.95, 0.3] },
    wetter: { titel: 'Wetter', unter: 'Lienz', quer: [2.05, 1.1, -0.7], hoch: [0.75, 2.1, -0.4] },
    kalender: { titel: 'Kalender', unter: 'Der Zahn der Zeit', quer: [-1.9, -0.95, -0.6], hoch: [-0.75, -1.75, -0.4], unten: true },
    kontakt: { titel: 'Kontakt', unter: 'Die Nase vorn', quer: [2.2, -0.8, 0.5], hoch: [0.75, -1.8, 0.2], unten: true },
  };
  const SCHLUESSEL = Object.keys(BLASEN);
  const ALIAS = { uhr: 'kalender' };                                // alte Adresse #uhr führt zum Kalender (dort steht auch die Uhr)
  // Reise beim Scrollen = Zoomen: hinein zur Blase, verweilen, hinaus zur Übersicht, hinein zur nächsten.
  // [Blase, von, bis] = Verweilen (Scroll-Fortschritt 0 bis 1)
  const STOPPS = [['wasserstand', 0.17, 0.25], ['wetter', 0.36, 0.44], ['kalender', 0.55, 0.63], ['kontakt', 0.74, 0.82]];
  const K = (p, gier, nick, roll, f, zoom) => ({ p, gier, nick, roll, f, zoom });
  const MAX_KLEIN = 90;                                             // Blasen, die der Zeiger hinterlässt, höchstens gleichzeitig

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

  // Zwischen zwei Schlüsselbildern weich (sanfter Start und sanftes Ende), beim Verweilen steht die Kamera still
  const sanfter = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function bahnWert(p, BAHN) {
    const n = BAHN.length;
    let i = 0;
    while (i < n - 2 && p > BAHN[i + 1].p) i += 1;
    const a = BAHN[i]; const b = BAHN[i + 1];
    const t = sanfter(clamp((p - a.p) / (b.p - a.p)));
    const mix = (x, y) => x + (y - x) * t;
    return {
      gier: mix(a.gier, b.gier), nick: mix(a.nick, b.nick), roll: mix(a.roll, b.roll),
      f: [mix(a.f[0], b.f[0]), mix(a.f[1], b.f[1]), mix(a.f[2], b.f[2])], zoom: Math.exp(mix(Math.log(a.zoom), Math.log(b.zoom))),
    };
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

  // Lage der Blasen: in Koordinaten der Anfangsansicht festgelegt, hier in Weltkoordinaten umgerechnet (leichtes Schweben)
  const R0 = mat.mul(mat.dreheX(rad(S_NICK)), mat.dreheY(rad(S_GIER)));
  function blasenPos(key, zeit, asp) {
    const b = BLASEN[key]; const q = smooth(0.6, 1.2, asp);
    const l = [0, 1, 2].map((i) => lerp(b.hoch[i], b.quer[i], q));
    l[0] += Math.sin(zeit * 0.5 + b.quer[0] * 3) * 0.05; l[1] += Math.sin(zeit * 0.43 + b.quer[1] * 5) * 0.09; l[2] += Math.sin(zeit * 0.37 + b.quer[2] * 4) * 0.05;
    return [0, 1, 2].map((r) => R0[r * 4] * l[0] + R0[r * 4 + 1] * l[1] + R0[r * 4 + 2] * l[2]);
  }
  // Kamera bei einer Blase: Blickpunkt in der Mitte, sie füllt etwa drei Viertel der Höhe (oder 90 % der Breite)
  function blasePose(key, zeit, asp) {
    const b = BLASEN[key]; const halbH = Math.max(2.2, 1.7 / asp);
    return { gier: S_GIER, nick: S_NICK, roll: 0, f: blasenPos(key, zeit, asp), zoom: (halbH * Math.min(0.74, 0.9 * asp)) / BLASE_R };
  }

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

  // Kugel der Blasen: nur Punkte (die Normale ist der Punkt selbst), Radius 1
  function kugel(laengen, breiten) {
    const pos = []; const idx = [];
    for (let j = 0; j <= breiten; j += 1) {
      const th = (j / breiten) * Math.PI;
      for (let i = 0; i <= laengen; i += 1) {
        const ph = (i / laengen) * Math.PI * 2;
        pos.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      }
    }
    for (let j = 0; j < breiten; j += 1) for (let i = 0; i < laengen; i += 1) {
      const a = j * (laengen + 1) + i; const b = a + laengen + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
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

  const ENV = `
  vec3 env(vec3 d){
    d = normalize(d);
    float up = d.y * 0.5 + 0.5;
    vec3 c = mix(vec3(0.05, 0.22, 0.34), vec3(0.62, 0.90, 0.98), smoothstep(0.1, 0.95, up));   // oben die helle Oberfläche, unten tiefes Blau
    float b1 = smoothstep(0.80, 0.93, dot(d, normalize(vec3(-0.35, 0.9, 0.3))));              // Sonne durch die Oberfläche
    float b2 = smoothstep(0.86, 0.96, dot(d, normalize(vec3(0.85, 0.35, 0.4)))) * 0.5;
    return c * 0.85 + vec3(0.95, 1.0, 1.0) * b1 * 1.7 + vec3(0.6, 0.85, 1.0) * b2;
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
  ${ENV}
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

  // Blase eines Bereichs: durchsichtige Kugel mit Spiegelung, Regenbogenhaut und Glanzlicht
  const VS_BLASE = `#version 300 es
  layout(location=0) in vec3 a_pos;
  uniform mat4 u_vp; uniform vec3 u_mitte; uniform float u_radius; uniform float u_zeit; uniform float u_samen;
  out vec3 v_wpos; out vec3 v_nor;
  void main(){
    float w = 1.0 + 0.016 * sin(u_zeit * 1.3 + a_pos.y * 3.0 + u_samen) + 0.012 * sin(u_zeit * 1.9 + a_pos.x * 4.0 + u_samen * 2.0);
    vec3 p = u_mitte + a_pos * u_radius * w;
    v_wpos = p; v_nor = a_pos; gl_Position = u_vp * vec4(p, 1.0);
  }`;
  const FS_BLASE = `#version 300 es
  precision highp float;
  in vec3 v_wpos; in vec3 v_nor;
  uniform vec3 u_cam; uniform vec3 u_light; uniform float u_zeit; uniform vec3 u_wasser; uniform float u_dichte;
  uniform float u_hinten; uniform float u_fokus; uniform float u_hover;
  out vec4 o;
  ${ENV}
  void main(){
    vec3 N = normalize(v_nor); if (u_hinten > 0.5) N = -N;
    vec3 V = normalize(u_cam - v_wpos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.6);
    float film = ndv * 2.3 + 0.35 * sin(v_nor.y * 5.0 + u_zeit * 0.45) + 0.25 * sin(v_nor.x * 7.0 - u_zeit * 0.35);
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (film + vec3(0.0, 0.33, 0.67)));
    vec3 refl = pow(env(reflect(-V, N)), vec3(0.8));
    vec3 H = normalize(normalize(u_light) + V);
    float rand = smoothstep(0.12, 0.5, 1.0 - ndv);                       // Glanz sitzt am Rand, in der Mitte bleibt die Blase klar
    float spec = pow(max(dot(N, H), 0.0), 140.0) * rand;
    float fenster = smoothstep(0.95, 0.985, dot(reflect(-V, N), normalize(vec3(-0.35, 0.9, 0.3)))) * rand;   // helle Spiegelung der Oberfläche
    vec3 haut = mix(vec3(0.55, 0.88, 1.0), irid, 0.5) * 0.9 + refl * 0.45;
    float aHaut = (0.05 + 0.66 * fres) * (1.0 + 0.45 * u_hover);
    float aInnen = (1.0 - fres) * u_fokus * 0.24;                          // dunkler Grund hinter der Schrift
    vec3 rgb = haut * aHaut + vec3(1.0) * (spec * 1.2 + fenster * 0.55) + vec3(0.01, 0.1, 0.18) * aInnen;
    float a = clamp(aHaut + spec + fenster * 0.5 + aInnen, 0.0, 1.0);
    float s = u_hinten > 0.5 ? 0.5 : 1.0;
    rgb *= s; a *= s;
    float nebel = 1.0 - exp(-length(u_cam - v_wpos) * u_dichte);
    rgb = mix(rgb, u_wasser * a, nebel * 0.7);
    o = vec4(clamp(rgb, 0.0, 1.0), a);
  }`;

  // Symbol in der Mitte der Blase: ein Rechteck, das zur Kamera schaut
  const VS_SYMBOL = `#version 300 es
  layout(location=0) in vec2 a;
  uniform mat4 u_vp; uniform vec3 u_mitte; uniform vec3 u_rechts; uniform vec3 u_hoch;
  out vec2 v_uv; out vec3 v_wpos;
  void main(){ vec3 p = u_mitte + u_rechts * a.x + u_hoch * a.y; v_wpos = p; v_uv = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5); gl_Position = u_vp * vec4(p, 1.0); }`;
  const FS_SYMBOL = `#version 300 es
  precision highp float;
  in vec2 v_uv; in vec3 v_wpos;
  uniform sampler2D u_tex; uniform vec3 u_cam; uniform vec3 u_wasser; uniform float u_dichte;
  out vec4 o;
  void main(){
    vec4 t = texture(u_tex, v_uv);
    float nebel = 1.0 - exp(-length(u_cam - v_wpos) * u_dichte);
    o = vec4(mix(t.rgb, u_wasser * t.a, nebel * 0.5), t.a);
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
  // Aussehen einer Luftblase im Punktsprite: heller Rand, Glanzbogen, Glanzpunkt, sonst fast durchsichtig
  const BLASE_GLSL = `
  vec4 blase(vec2 pc, float d, float weich){
    float rim = smoothstep(0.62 - weich * 0.4, 0.94, d) * (1.0 - smoothstep(0.94, 1.0, d));
    float bogen = smoothstep(0.1, 0.0, abs(d - 0.6)) * smoothstep(0.15, 0.75, dot(normalize(pc + 0.0001), normalize(vec2(-0.7, -0.7))));
    float punkt = smoothstep(0.2, 0.0, length(pc - vec2(-0.42, -0.42)));
    float unten = smoothstep(0.35, 1.0, dot(pc, vec2(0.6, 0.8))) * 0.12;
    float a = clamp(0.05 + 0.5 * rim + 0.6 * bogen + 0.7 * punkt + unten, 0.0, 1.0);
    return vec4(mix(vec3(0.66, 0.88, 1.0), vec3(1.0), clamp(bogen + punkt, 0.0, 1.0)), a);
  }`;
  const FS_TEILCHEN = `#version 300 es
  precision highp float;
  in float v_typ; in float v_alpha; in float v_unsch; in float v_s;
  uniform float u_zeit;
  out vec4 o;
  ${BLASE_GLSL}
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
    } else {                                                        // Luftblase
      vec4 b = blase(pc, d, weich); rgb = b.rgb; a = b.a;
    }
    a *= v_alpha;
    o = vec4(rgb * a, a);
  }`;

  // Blasen, die der Zeiger hinterlässt: Ort + Radius, Deckkraft; gleiche Optik wie die Luftblasen
  const VS_KLEIN = `#version 300 es
  layout(location=0) in vec4 a_b; layout(location=1) in float a_a;
  uniform mat4 u_vp; uniform vec3 u_cam; uniform float u_focal; uniform float u_maxPt; uniform float u_fokus;
  out float v_alpha; out float v_unsch;
  void main(){
    float dist = length(a_b.xyz - u_cam);
    gl_PointSize = clamp(2.0 * a_b.w * u_focal / max(dist, 0.05), 2.0, u_maxPt);
    gl_Position = u_vp * vec4(a_b.xyz, 1.0);
    v_unsch = clamp(abs(dist - u_fokus) / (u_fokus * 1.2), 0.0, 1.0) * 0.6; v_alpha = a_a;
  }`;
  const FS_KLEIN = `#version 300 es
  precision highp float;
  in float v_alpha; in float v_unsch;
  out vec4 o;
  ${BLASE_GLSL}
  void main(){
    vec2 pc = gl_PointCoord * 2.0 - 1.0; float d = length(pc);
    if (d > 1.0) discard;
    vec4 b = blase(pc, d, v_unsch);
    float a = clamp(b.a * 1.3, 0.0, 1.0) * v_alpha;
    o = vec4(b.rgb * a, a);
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
  // mini = Home-Logo oben links: kein Hintergrund, keine Teilchen, keine Blasen, kein Schatten
  function rendererBauen(zielCanvas, koerper, mini) {
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

    let pTiefe; let pHinter; let pTeil; let pBlase; let pSymbol; let pKlein; let fbo; let tiefe; let vaoQ; let vaoT; let teilAnzahl = 0; let maxPunkt = 64;
    let kugelVAO; let kugelAnzahl = 0; let symbolVAO; let klVAO; let klBuf; let kam = null;
    const klDaten = new Float32Array(MAX_KLEIN * 5); const kl = []; const symbole = {}; const blasenAnsicht = {};
    const SK = 1536;
    if (!mini) {
      pTiefe = programm(gl, VS_TIEFE, FS_TIEFE);
      pHinter = programm(gl, VS_HINTER, FS_HINTER);
      pTeil = programm(gl, VS_TEILCHEN, FS_TEILCHEN);
      pBlase = programm(gl, VS_BLASE, FS_BLASE);
      pSymbol = programm(gl, VS_SYMBOL, FS_SYMBOL);
      pKlein = programm(gl, VS_KLEIN, FS_KLEIN);

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

      // Blasen der Bereiche: Kugel, Symbol-Fläche und je eine Textur pro Symbol
      const kg = kugel(40, 28);
      kugelVAO = gl.createVertexArray(); gl.bindVertexArray(kugelVAO);
      const kvb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, kvb); gl.bufferData(gl.ARRAY_BUFFER, kg.pos, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      const keb = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, keb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, kg.idx, gl.STATIC_DRAW);
      kugelAnzahl = kg.idx.length;
      symbolVAO = gl.createVertexArray(); gl.bindVertexArray(symbolVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);                       // das Rechteck von oben (-1 bis 1)
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      klVAO = gl.createVertexArray(); gl.bindVertexArray(klVAO);  // Blasen am Zeiger: Ort + Radius, Deckkraft
      klBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, klBuf); gl.bufferData(gl.ARRAY_BUFFER, klDaten.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 16);
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      SCHLUESSEL.forEach((key) => {
        const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        const cv = document.createElement('canvas'); cv.width = T.GROESSE; cv.height = T.GROESSE;
        symbole[key] = { tx, cv };
      });
    }

    function symbolAktualisieren(key) {
      if (mini || !symbole[key]) return;
      const s = symbole[key];
      T.malen(key, s.cv, D.zustand);
      gl.bindTexture(gl.TEXTURE_2D, s.tx);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s.cv);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    if (!mini) SCHLUESSEL.forEach(symbolAktualisieren);

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
      const rechts = [R[0], R[4], R[8]]; const hoch = [R[1], R[5], R[9]];
      kam = { pos: cam, rechts, hoch, vor: [-R[2], -R[6], -R[10]], tan: Math.tan(FOV / 2), asp: aspekt, abst };
      const lw = rad(z.licht || 0);
      const kLicht = [KEY[0] * Math.cos(lw) + KEY[2] * Math.sin(lw), KEY[1], -KEY[0] * Math.sin(lw) + KEY[2] * Math.cos(lw)];
      const kn = Math.hypot(kLicht[0], kLicht[1], kLicht[2]);
      const licht = [0, 1, 2].map((i) => (R[i * 4] * kLicht[0] + R[i * 4 + 1] * kLicht[1] + R[i * 4 + 2] * kLicht[2]) / kn);
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
        // Blasen der Bereiche, von hinten nach vorn: Rückseite, Symbol, Vorderseite
        const ordnung = SCHLUESSEL.map((k) => { const pos = blasenPos(k, z.zeit, aspekt); return { k, pos, d: Math.hypot(pos[0] - cam[0], pos[1] - cam[1], pos[2] - cam[2]) }; }).sort((a, b) => b.d - a.d);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.enable(gl.CULL_FACE);
        ordnung.forEach(({ k, pos }) => {
          const fok = (z.fokus && z.fokus[k]) || 0; const hv = (z.hover && z.hover[k]) || 0;
          const r = BLASE_R * (1 + 0.05 * hv);
          const huelle = (hinten) => {
            gl.useProgram(pBlase);
            gl.uniformMatrix4fv(u(pBlase, 'u_vp'), false, vp);
            gl.uniform3fv(u(pBlase, 'u_mitte'), pos); gl.uniform1f(u(pBlase, 'u_radius'), r);
            gl.uniform1f(u(pBlase, 'u_zeit'), z.zeit); gl.uniform1f(u(pBlase, 'u_samen'), SCHLUESSEL.indexOf(k) * 1.7);
            gl.uniform3fv(u(pBlase, 'u_cam'), cam); gl.uniform3fv(u(pBlase, 'u_light'), licht);
            gl.uniform3fv(u(pBlase, 'u_wasser'), wasser); gl.uniform1f(u(pBlase, 'u_dichte'), dichte);
            gl.uniform1f(u(pBlase, 'u_hinten'), hinten ? 1 : 0); gl.uniform1f(u(pBlase, 'u_fokus'), fok); gl.uniform1f(u(pBlase, 'u_hover'), hv);
            gl.cullFace(hinten ? gl.FRONT : gl.BACK);
            gl.bindVertexArray(kugelVAO); gl.drawElements(gl.TRIANGLES, kugelAnzahl, gl.UNSIGNED_SHORT, 0);
          };
          huelle(true);
          // Symbol in der Mitte; beim Besuch rückt es nach oben und wird kleiner, darunter steht der Text
          const halb = r * lerp(0.56, 0.27, fok); const hub = r * lerp(0, 0.52, fok);
          gl.disable(gl.CULL_FACE);
          gl.useProgram(pSymbol);
          gl.uniformMatrix4fv(u(pSymbol, 'u_vp'), false, vp);
          gl.uniform3f(u(pSymbol, 'u_mitte'), pos[0] + hoch[0] * hub, pos[1] + hoch[1] * hub, pos[2] + hoch[2] * hub);
          gl.uniform3f(u(pSymbol, 'u_rechts'), rechts[0] * halb, rechts[1] * halb, rechts[2] * halb);
          gl.uniform3f(u(pSymbol, 'u_hoch'), hoch[0] * halb, hoch[1] * halb, hoch[2] * halb);
          gl.uniform3fv(u(pSymbol, 'u_cam'), cam); gl.uniform3fv(u(pSymbol, 'u_wasser'), wasser); gl.uniform1f(u(pSymbol, 'u_dichte'), dichte);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, symbole[k].tx); gl.uniform1i(u(pSymbol, 'u_tex'), 1);
          gl.bindVertexArray(symbolVAO); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.enable(gl.CULL_FACE);
          huelle(false);
        });
        gl.disable(gl.CULL_FACE); gl.activeTexture(gl.TEXTURE0);
        ordnung.forEach(({ k, pos }) => {                       // wo auf dem Bildschirm sitzt welche Blase (für Beschriftung und Antippen)
          const a = projiziere(pos); const e = projiziere([pos[0] + rechts[0] * BLASE_R, pos[1] + rechts[1] * BLASE_R, pos[2] + rechts[2] * BLASE_R]);
          blasenAnsicht[k] = { x: a.x, y: a.y, r: Math.hypot(e.x - a.x, e.y - a.y), w: a.w };
        });

        // Teilchen: hinter und vor den Körpern (Tiefentest ohne Schreiben), weich überblendet
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

        // Blasen, die der Zeiger hinterlässt
        if (kl.length) {
          kl.forEach((b, i) => {
            const a = smooth(0, 0.18, b.t) * (1 - smooth(b.leben - 0.6, b.leben, b.t));
            const wachs = (0.75 + 0.25 * smooth(0, 0.8, b.t)) * (1 + 0.3 * smooth(b.leben - 0.15, b.leben, b.t));
            klDaten.set([b.p[0], b.p[1], b.p[2], b.r * wachs, a], i * 5);
          });
          gl.useProgram(pKlein);
          gl.uniformMatrix4fv(u(pKlein, 'u_vp'), false, vp);
          gl.uniform3fv(u(pKlein, 'u_cam'), cam);
          gl.uniform1f(u(pKlein, 'u_focal'), (zielCanvas.height / 2) / Math.tan(FOV / 2));
          gl.uniform1f(u(pKlein, 'u_maxPt'), maxPunkt);
          gl.uniform1f(u(pKlein, 'u_fokus'), abst);
          gl.bindVertexArray(klVAO); gl.bindBuffer(gl.ARRAY_BUFFER, klBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, klDaten, 0, kl.length * 5);
          gl.drawArrays(gl.POINTS, 0, kl.length);
        }
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
    }

    // Weltpunkt → CSS-Pixel (für die Beschriftung); w < 0 = hinter der Kamera
    function projiziere(p) {
      const m = letztesVP;
      const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
      const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
      const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      return { x: (x / w * 0.5 + 0.5) * letzteBreite, y: (1 - (y / w * 0.5 + 0.5)) * letzteHoehe, w };
    }
    const aspektJetzt = () => (zielCanvas.clientWidth > 2 && zielCanvas.clientHeight > 2 ? zielCanvas.clientWidth / zielCanvas.clientHeight : window.innerWidth / Math.max(1, window.innerHeight));

    // Blasen am Zeiger: entstehen auf der Blickgeraden des Zeigers, steigen schwankend auf und platzen
    function blasenStreuen(px, py, anzahl) {
      if (mini || !kam) return;
      for (let i = 0; i < anzahl; i += 1) {
        if (kl.length >= MAX_KLEIN) kl.shift();
        const ndx = ((px + (Math.random() - 0.5) * 16) / letzteBreite) * 2 - 1;
        const ndy = 1 - ((py + (Math.random() - 0.5) * 10) / letzteHoehe) * 2;
        const d = kam.abst * (0.65 + 0.45 * Math.random());
        const proPx = (2 * d * kam.tan) / letzteHoehe;
        const ort = [0, 1, 2].map((j) => kam.pos[j] + (kam.vor[j] + kam.rechts[j] * ndx * kam.tan * kam.asp + kam.hoch[j] * ndy * kam.tan) * d);
        kl.push({ p: ort, r: (3 + 11 * Math.random() ** 2.2) * proPx, steig: (50 + 90 * Math.random()) * proPx, ph: Math.random() * 6.283, t: 0, leben: 2.2 + 2.2 * Math.random(), rechts: kam.rechts });
      }
    }
    function blasenSchritt(dt) {
      for (let i = kl.length - 1; i >= 0; i -= 1) {
        const b = kl[i]; b.t += dt;
        if (b.t >= b.leben) { kl.splice(i, 1); continue; }
        const quer = Math.cos(b.t * 2.6 + b.ph) * b.r * 3 * dt;
        b.p[0] += b.rechts[0] * quer; b.p[1] += b.steig * dt * (0.6 + 0.4 * smooth(0, 1.2, b.t)); b.p[2] += b.rechts[2] * quer;
      }
    }
    return { zeichnen, symbolAktualisieren, projiziere, aspekt: aspektJetzt, blasen: blasenAnsicht, streuen: blasenStreuen, schritt: blasenSchritt };
  }


  /* ---------- Bewegung, Navigation, Blasen ---------- */
  function laufen(motor, mini) {
    const gueltig = (k) => SCHLUESSEL.includes(k);
    const wahl = (k) => ALIAS[k] || k;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';   // Zurück soll oben landen, nicht an der alten Stelle

    // Ziehen (Zeiger): horizontal = Gieren, vertikal (nur Maus) = Nicken
    let zieht = false; let lastX = 0; let lastY = 0; let startT = 0; let bewegt = 0;
    let vGier = 0; let vNick = 0; let letzterZug = 0; let ruheSeit = 0;
    let offGier = 0; let offNick = 0;
    const zielG = { w: 0 }; const zielN = { w: 0 };
    let modus = 'start'; let aktiv = null; let flug = 0; let p = festP === null ? 0 : festP;
    let eigenerEintrag = false;
    let t = 0; let introT = festP === null && !reduziert ? 0 : INTRO;
    const velG = { v: 0 }; const velN = { v: 0 }; const velP = { v: 0 };
    const grenze = () => (modus === 'tafel' ? 30 : 1e9);
    let neustart = () => {};
    let zeigerX = window.innerWidth * 0.5; let zeigerY = window.innerHeight * 0.5;

    // Zustand jeder Blase: fk = wie sehr die Kamera gerade bei ihr ist (0 bis 1), hover = Zeiger darüber
    const fk = {}; const fkV = {}; const hover = {}; const hoverV = {}; let zielHover = null;
    SCHLUESSEL.forEach((k) => { fk[k] = 0; fkV[k] = { v: 0 }; hover[k] = 0; hoverV[k] = { v: 0 }; });

    // Beschriftung der Blasen (DOM): Name unter der Blase, beim Besuch innen mit den Inhalten
    const blasenEl = {};
    SCHLUESSEL.forEach((key) => {
      const b = BLASEN[key];
      const el = document.createElement('div'); el.className = b.unten ? 'blase unten' : 'blase';   // untere Blasen tragen den Namen oben, zur Marke hin
      const knopf = document.createElement('button'); knopf.type = 'button'; knopf.className = 'blase-name';
      const t1 = document.createElement('span'); t1.textContent = b.titel;
      const t2 = document.createElement('small'); t2.textContent = b.unter;
      knopf.append(t1, t2);
      const info = document.createElement('div'); info.className = 'blase-info';
      el.append(knopf, info); blasenHalter.append(el);
      knopf.addEventListener('click', () => oeffnen(key, true));
      blasenEl[key] = { el, knopf, info };
      D.einbauen(info, key);
    });
    const ART = { uhr: 'kalender', kalender: 'kalender', wetter: 'wetter', pegel: 'wasserstand' };
    D.beiAenderung((art) => {
      const key = ART[art]; if (!key) return;
      D.einbauen(blasenEl[key].info, key);
      if (art === 'kalender') motor.symbolAktualisieren('kalender');
    });

    function beschriften(fokus, zoom, sichtbar) {
      const fremd = 1 - smooth(1.7, 2.6, zoom);
      SCHLUESSEL.forEach((key) => {
        const { el, knopf } = blasenEl[key]; const a = motor.blasen[key]; const f = fokus[key] || 0;
        const op = a && a.w > 0 ? lerp(fremd, 1, f) * sichtbar : 0;
        el.style.opacity = op > 0.01 ? op.toFixed(3) : '0';
        if (op > 0.01) {
          el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
          el.style.setProperty('--r', `${a.r.toFixed(1)}px`); el.style.setProperty('--f', f.toFixed(3));
        }
        el.classList.toggle('offen', f > 0.55);
        const nutzbar = op > 0.35;
        el.classList.toggle('nutzbar', nutzbar); knopf.tabIndex = nutzbar ? 0 : -1;
      });
    }

    // Welche Blase liegt unter dem Zeiger?
    const treffer = (x, y) => {
      if (introT < INTRO * 0.7) return null;
      let best = null; let bd = 1e9;
      SCHLUESSEL.forEach((k) => {
        const a = motor.blasen[k]; if (!a || a.w <= 0) return;
        const d = Math.hypot(x - a.x, y - a.y);
        if (d < a.r * 1.04 && d < bd) { best = k; bd = d; }
      });
      return best;
    };

    canvas.addEventListener('pointerdown', (e) => {
      zieht = true; lastX = e.clientX; lastY = e.clientY; startT = performance.now(); bewegt = 0; vGier = 0; vNick = 0;
      canvas.setPointerCapture(e.pointerId); canvas.classList.add('zieht'); hinweis.classList.add('weg');
      if (!reduziert) motor.streuen(e.clientX, e.clientY, 5);
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
    const loslassen = (e) => {
      if (!zieht) return;
      zieht = false; canvas.classList.remove('zieht');
      const kurz = bewegt < 6 && performance.now() - startT < 350;
      const k = kurz && e.type === 'pointerup' ? treffer(e.clientX, e.clientY) : null;
      if (k) { if (k !== aktiv && fk[k] < 0.5) oeffnen(k, true); }        // Antippen einer Blase: hinfliegen
      else if (kurz && modus === 'start') zielG.w += 360;                  // Antippen sonst: einmal ganz herum
      else {
        const frisch = performance.now() - letzterZug < 90;
        zielG.w = clamp(zielG.w + clamp((frisch ? vGier : 0) * AUSLAUF, -540, 540), -grenze(), grenze());
        zielN.w = clamp(zielN.w + (frisch ? vNick : 0) * AUSLAUF, -70, 70);
      }
      ruheSeit = 0;
    };
    canvas.addEventListener('pointerup', loslassen);
    canvas.addEventListener('pointercancel', loslassen);

    // Zeiger: Home-Logo, Hover auf Blasen, und wo der Zeiger entlangfährt, steigen Blasen auf
    let spur = 0; let spurX = null; let spurY = 0;
    window.addEventListener('pointermove', (e) => {
      zeigerX = e.clientX; zeigerY = e.clientY;
      if (spurX !== null) spur += Math.hypot(e.clientX - spurX, e.clientY - spurY);
      spurX = e.clientX; spurY = e.clientY;
      if (!reduziert) for (let n = 0; spur > 26 && n < 4; n += 1) { spur -= 26; motor.streuen(e.clientX, e.clientY, Math.random() < 0.3 ? 2 : 1); }
      if (spur > 26) spur = 0;
      zielHover = treffer(e.clientX, e.clientY);
      canvas.classList.toggle('ueber-blase', !!zielHover && modus !== 'tafel');
    }, { passive: true });

    /* --- Untermenü öffnen und schließen --- */
    function oeffnen(key0, mitFlug, ausHistorie) {
      const key = wahl(key0);
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
      const k = wahl(window.location.hash.slice(1));
      if (gueltig(k)) oeffnen(k, true, true); else schliessen(true);
    });

    // Das Home-Logo gibt es nur, solange man nicht auf der Startseite ist
    const miniZeigen = () => {
      if (!miniKnopf) return;
      const daheim = modus === 'start' && p < 0.04;
      miniKnopf.classList.toggle('versteckt', daheim); miniKnopf.tabIndex = daheim ? -1 : 0;
    };

    // Kamera am Ziel: bei der Blase, oder ganz am Anfang die Übersicht
    const start = (pp) => K(pp, S_GIER, S_NICK, 0, [0, 0, 0], S_ZOOM);
    function bahnBauen(asp, zeit) {
      // Hineinzoomen zur Blase, verweilen, wieder hinaus zur Übersicht, hinein zur nächsten ...
      const bahn = [start(0), start(0.06)];
      STOPPS.forEach(([k, a, b], i) => {
        const q = blasePose(k, zeit, asp);
        bahn.push(K(a, q.gier, q.nick, 0, q.f, q.zoom), K(b, q.gier, q.nick, 0, q.f, q.zoom));
        if (i < STOPPS.length - 1) bahn.push(start((b + STOPPS[i + 1][1]) / 2));
      });
      bahn.push(start(0.91), start(1));
      return bahn;
    }

    if (reduziert) {
      // Ruhig: Standbild, die Blasen sind zugleich das Menü, kein Flug
      const standbild = () => {
        const asp = motor.aspekt();
        const z0 = modus === 'tafel' ? blasePose(aktiv, 0, asp) : { gier: S_GIER, nick: S_NICK, roll: 0, f: [0, 0, 0], zoom: S_ZOOM };
        const fokus = {}; SCHLUESSEL.forEach((k) => { fokus[k] = modus === 'tafel' && k === aktiv ? 1 : 0; });
        motor.zeichnen({ gier: z0.gier + offGier, nick: clamp(z0.nick + offNick, -85, 85), roll: z0.roll, f: z0.f, zoom: z0.zoom, hub: 0, licht: 0, drift: 0, zeit: 0, tiefe: 0.1, fokus });
        beschriften(fokus, z0.zoom, 1);
        miniZeigen();
        if (mini) mini.zeichnen({ gier: -20, nick: 6, roll: 0, f: [0, 0, 0], zoom: 2.05, hub: 0, licht: 0, drift: 0, zeit: 0, tiefe: 0 });
      };
      canvas.addEventListener('pointermove', () => { if (zieht) { offGier = zielG.w; offNick = zielN.w; standbild(); } });
      canvas.addEventListener('pointerup', standbild);
      window.addEventListener('resize', standbild);
      window.addEventListener('popstate', standbild);
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') standbild(); });
      D.beiAenderung(() => standbild());
      zurueck.addEventListener('click', standbild);
      SCHLUESSEL.forEach((k) => blasenEl[k].knopf.addEventListener('click', standbild));
      if (miniKnopf) miniKnopf.addEventListener('click', () => { schliessen(false); standbild(); });
      const hash0 = wahl(window.location.hash.slice(1)); if (gueltig(hash0)) oeffnen(hash0, false, true);
      standbild();
      return;
    }

    /* --- Animationsschleife --- */
    const hashStart = wahl(window.location.hash.slice(1));
    const b0 = gueltig(hashStart) ? null : bahnWert(p, bahnBauen(motor.aspekt(), 0));
    const q0 = gueltig(hashStart) ? blasePose(hashStart, 0, motor.aspekt()) : null;
    const s0 = b0 || { gier: q0.gier, nick: q0.nick, roll: 0, f: q0.f, zoom: q0.zoom };
    const P = { gier: s0.gier, nick: s0.nick, roll: s0.roll, fx: s0.f[0], fy: s0.f[1], fz: s0.f[2], lz: Math.log(s0.zoom) };
    const V = { gier: { v: 0 }, nick: { v: 0 }, roll: { v: 0 }, fx: { v: 0 }, fy: { v: 0 }, fz: { v: 0 }, lz: { v: 0 } };
    const miniG = { v: 0 }; const miniN = { v: 0 }; const miniDrehV = { v: 0 };
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
    if (gueltig(hashStart)) { introT = INTRO; oeffnen(hashStart, false, true); fk[hashStart] = 1; }

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

      // Welche Blase ist gerade "dran"? Beim Scrollen die der Reise, im Untermenü die gewählte.
      SCHLUESSEL.forEach((k) => {
        let ziel = 0;
        if (modus === 'tafel') ziel = k === aktiv && flug < 0.5 ? 1 : 0;
        else { const s = STOPPS.find((x) => x[0] === k); ziel = 1 - smooth(0.012, 0.05, Math.max(0, s[1] - p, p - s[2])); }
        fk[k] = glatt(fk[k], ziel, fkV[k], 0.5, dt);
        hover[k] = glatt(hover[k], zielHover === k && modus === 'start' && fk[k] < 0.5 ? 1 : 0, hoverV[k], 0.25, dt);
      });

      // Ziel der Kamera: Reise beim Scrollen, Blase im Untermenü. Zwischen beiden fliegt sie weich.
      const asp = motor.aspekt();
      const zp = modus === 'tafel' ? blasePose(aktiv, t, asp) : bahnWert(p, bahnBauen(asp, t));
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
      motor.schritt(dt);
      motor.zeichnen({
        gier: P.gier - 342 * rest * rest + offGier + Math.sin(t * 0.5) * 1.6 * sanft,
        nick: clamp(P.nick - 12 * rest + offNick + Math.sin(t * 0.37) * 1.2 * sanft, -88, 88),
        roll: P.roll + Math.sin(t * 0.43) * 0.9 * sanft,
        f: [P.fx, P.fy, P.fz], zoom: zoomEff, hub, licht: -85 * rest, drift, zeit: t, tiefe, fokus: fk, hover,
      });

      // Namen und Inhalte an den Blasen; erst wenn das Intro fast vorbei ist
      beschriften(fk, Math.exp(P.lz), smooth(INTRO * 0.6, INTRO * 0.95, introT));
      miniZeigen();

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
      motor.zeichnen({                                        // erstes Bild passt zum Anfang des Intros
        gier: S_GIER - (intro ? 342 : 0), nick: S_NICK - (intro ? 12 : 0), roll: 0, f: [0, 0, 0], zoom: S_ZOOM * (intro ? 0.42 : 1),
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