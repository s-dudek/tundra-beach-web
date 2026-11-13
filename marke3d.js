// Die Bildmarke aus dem Gesamtlogo als echter 3D-Körper (WebGL2): Pfade der SVG werden zu Körpern mit
// abgerundeten Kanten aufgezogen, glänzend beleuchtet, mit Spiegelungen und weichen Schatten gezeichnet.
// Die Schrift daneben bleibt flach. Klappt WebGL nicht, bleibt das flache Gesamtlogo stehen.
(() => {
  'use strict';

  const G = window.TB3D;
  const logo = document.querySelector('.logo');
  const canvas = document.getElementById('marke3d');
  if (!G || !logo || !canvas) return;

  /* ---------- Welche Pfade der SVG gehören zur Bildmarke, und wie hoch sind sie? ---------- */
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

  /* ---------- Zeiten (langsam, mit Absicht) ---------- */
  const INTRO = 8;           // Sekunden, bis die Schichten zusammengesetzt sind
  const DREHUNG = 3.6;       // Sekunden für eine ganze Drehung beim Tippen
  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Kleine Matrixhelfer (spaltenweise, wie WebGL) ---------- */
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
    drehung(gier, nick) {
      const cy = Math.cos(gier); const sy = Math.sin(gier); const cx = Math.cos(nick); const sx = Math.sin(nick);
      // erst um x (Nicken), dann um y (Gieren): M = Ry * Rx
      return new Float32Array([cy, sy * sx, -sy * cx, 0, 0, cx, sx, 0, sy, -cy * sx, cy * cx, 0, 0, 0, 0, 1]);
    },
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

    // Mitte und Größe der Marke aus dem gelben Schild (Schicht 26)
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
      const fill = farben[el.getAttribute('class')] || '#2c2c2b';
      const rgb = linear(fill);
      const konturen = G.pfadLesen(d, 0.8).map((k) => k.map((p) => [(p[0] - mx) * s, -(p[1] - my) * s]));
      G.polygone(konturen).forEach((pg) => {
        const k = G.koerperBauen(pg, {
          unten: sch.platte ? sch.unten * s : 0,
          oben: sch.platte ? 0 : sch.hoehe * s,
          fasenOben: sch.fase * s,
          fasenUnten: sch.platte ? sch.fase * s : 0,
          unterseite: !!sch.platte,
          stufen: 5,
          abtastung: 0.7 * s,
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
    return { daten, indizes: new Uint32Array(idx), schichten: SCHICHTEN.length };
  }

  /* ---------- Shader ---------- */
  const VS = `#version 300 es
  layout(location=0) in vec3 a_pos; layout(location=1) in vec3 a_nor; layout(location=2) in vec3 a_col; layout(location=3) in vec3 a_par;
  uniform mat4 u_vp; uniform mat4 u_model; uniform mat4 u_lightVP; uniform float u_explode;
  out vec3 v_wpos; out vec3 v_nor; out vec3 v_col; out vec3 v_par; out vec4 v_shadow; out vec2 v_xy;
  void main(){
    vec3 p = a_pos; p.z += a_par.z * u_explode;
    vec4 w = u_model * vec4(p, 1.0);
    v_wpos = w.xyz; v_nor = mat3(u_model) * a_nor; v_col = a_col; v_par = a_par; v_xy = a_pos.xy;
    v_shadow = u_lightVP * (w + vec4(normalize(mat3(u_model) * a_nor) * 0.012, 0.0));
    gl_Position = u_vp * w;
  }`;

  const FS = `#version 300 es
  precision highp float; precision highp sampler2DShadow;
  in vec3 v_wpos; in vec3 v_nor; in vec3 v_col; in vec3 v_par; in vec4 v_shadow; in vec2 v_xy;
  uniform sampler2DShadow u_shadow; uniform vec3 u_cam; uniform vec3 u_light; uniform mat4 u_model; uniform float u_texel;
  out vec4 outColor;
  vec3 env(vec3 d){
    d = normalize(d);
    float up = d.y * 0.5 + 0.5;
    vec3 c = mix(vec3(0.50, 0.52, 0.56), vec3(0.98), smoothstep(0.15, 0.9, up));
    float b1 = smoothstep(0.80, 0.93, dot(d, normalize(vec3(-0.55, 0.75, 0.55))));
    float b2 = smoothstep(0.86, 0.96, dot(d, normalize(vec3(0.85, 0.15, 0.45))));
    float b3 = smoothstep(0.80, 0.97, dot(d, normalize(vec3(0.1, -0.3, 0.9)))) * 0.5;
    float rim = smoothstep(0.55, 1.0, dot(d, vec3(0.0, 0.2, -1.0))) * 0.7;
    return c * 0.85 + vec3(1.0) * b1 * 1.9 + vec3(0.92, 0.96, 1.0) * b2 * 1.1 + vec3(1.0) * b3 + vec3(0.85) * rim;
  }
  void main(){
    vec3 N = normalize(v_nor);
    // Obere Flächen minimal wölben, damit Glanzlichter beim Drehen über sie wandern
    float kappe = smoothstep(0.85, 1.0, abs(normalize(v_nor).z));
    vec3 bulge = mat3(u_model) * vec3(v_xy * 0.28, 0.0);
    N = normalize(N + bulge * kappe * 0.6);
    vec3 V = normalize(u_cam - v_wpos);
    vec3 L = normalize(u_light);
    float ndl = max(dot(N, L), 0.0);

    vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
    float sh = 0.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
      sh += texture(u_shadow, vec3(sc.xy + vec2(float(x), float(y)) * u_texel * 1.6, sc.z - 0.0015));
    }
    sh /= 9.0;

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

    col = col / (1.0 + 0.06 * col);                  // weiche Spitzen
    outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
  }`;

  const VS_TIEFE = `#version 300 es
  layout(location=0) in vec3 a_pos; layout(location=3) in vec3 a_par;
  uniform mat4 u_lightVP; uniform mat4 u_model; uniform float u_explode;
  void main(){ vec3 p = a_pos; p.z += a_par.z * u_explode; gl_Position = u_lightVP * (u_model * vec4(p, 1.0)); }`;
  const FS_TIEFE = `#version 300 es
  precision mediump float; void main(){}`;

  const VS_SCHATTEN = `#version 300 es
  in vec2 a; uniform vec4 u_box; out vec2 v;
  void main(){ v = a; gl_Position = vec4(u_box.xy + a * u_box.zw, 0.0, 1.0); }`;
  const FS_SCHATTEN = `#version 300 es
  precision mediump float; in vec2 v; uniform float u_st; out vec4 o;
  void main(){ float r = dot(v, v); float a = smoothstep(1.0, 0.0, r) * u_st; o = vec4(vec3(0.17, 0.17, 0.17) * a, a); }`;

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

  /* ---------- Start ---------- */
  function starten(koerper) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, depth: true, stencil: false });
    if (!gl) throw new Error('WebGL2 fehlt');

    const pHaupt = programm(gl, VS, FS);
    const pTiefe = programm(gl, VS_TIEFE, FS_TIEFE);
    const pSchatten = programm(gl, VS_SCHATTEN, FS_SCHATTEN);
    const u = (p, n) => gl.getUniformLocation(p, n);

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

    // Schattenkarte
    const SK = 1536;
    const tiefe = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tiefe);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SK, SK);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tiefe, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Schattenkarte nicht möglich');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Weicher Schatten unter der Marke (Viereck im Bildschirm)
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const vaoQ = gl.createVertexArray();
    gl.bindVertexArray(vaoQ);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Kamera und Licht (fest im Raum, die Marke dreht sich darin)
    const FOV = (18 * Math.PI) / 180;
    const ABST = 2.2 / Math.tan(FOV / 2);          // Bildhöhe = 2,2 × Markenhöhe
    const cam = [0, 0, ABST];
    const vp = mat.mul(mat.persp(FOV, 1, ABST - 3, ABST + 3), mat.blick(cam, [0, 0, 0], [0, 1, 0]));
    const licht = (() => { const l = [-0.45, 0.8, 0.75]; const n = Math.hypot(...l); return l.map((v) => v / n); })();
    const lichtVP = mat.mul(mat.ortho(-1.9, 1.9, -1.9, 1.9, 0.5, 9), mat.blick(licht.map((v) => v * 5), [0, 0, 0], [0, 1, 0]));

    function groesse() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const b = Math.max(2, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== b || canvas.height !== h) { canvas.width = b; canvas.height = h; }
    }

    function zeichnen(gier, nick, explode, hub) {
      groesse();
      const modell = mat.mul(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, hub, 0, 1]), mat.drehung(gier, nick));

      // 1) Tiefe aus Sicht des Lichts
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, SK, SK);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.useProgram(pTiefe);
      gl.uniformMatrix4fv(u(pTiefe, 'u_lightVP'), false, lichtVP);
      gl.uniformMatrix4fv(u(pTiefe, 'u_model'), false, modell);
      gl.uniform1f(u(pTiefe, 'u_explode'), explode);
      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, anzahl, gl.UNSIGNED_INT, 0);

      // 2) Bild
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // weicher Schatten darunter (schmaler, wenn die Marke sich zur Seite dreht)
      const quer = 0.45 + 0.55 * Math.abs(Math.cos(gier));
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pSchatten);
      gl.uniform4f(u(pSchatten, 'u_box'), 0, -0.56 - hub * 0.1, 0.36 * quer, 0.07);
      gl.uniform1f(u(pSchatten, 'u_st'), 0.2 * Math.max(0, 1 - explode * 2));
      gl.bindVertexArray(vaoQ);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
      gl.useProgram(pHaupt);
      gl.uniformMatrix4fv(u(pHaupt, 'u_vp'), false, vp);
      gl.uniformMatrix4fv(u(pHaupt, 'u_model'), false, modell);
      gl.uniformMatrix4fv(u(pHaupt, 'u_lightVP'), false, lichtVP);
      gl.uniform3fv(u(pHaupt, 'u_cam'), cam);
      gl.uniform3fv(u(pHaupt, 'u_light'), licht);
      gl.uniform1f(u(pHaupt, 'u_explode'), explode);
      gl.uniform1f(u(pHaupt, 'u_texel'), 1 / SK);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tiefe);
      gl.uniform1i(u(pHaupt, 'u_shadow'), 0);
      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, anzahl, gl.UNSIGNED_INT, 0);
    }

    return { zeichnen, gl };
  }

  /* ---------- Bewegung ---------- */
  const ease = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const rad = (g) => (g * Math.PI) / 180;

  function laufen(motor) {
    if (reduziert) {
      motor.zeichnen(rad(-20), rad(7), 0, 0);
      window.addEventListener('resize', () => motor.zeichnen(rad(-20), rad(7), 0, 0));
      return;
    }
    let zielX = 0; let zielY = 0; let x = 0; let y = 0;
    let drehStart = -100;
    const t0 = performance.now();
    window.addEventListener('pointermove', (e) => {
      zielX = (e.clientX / window.innerWidth) * 2 - 1;
      zielY = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    window.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a')) return;
      drehStart = (performance.now() - t0) / 1000;
    });
    const bild = (jetzt) => {
      const t = (jetzt - t0) / 1000;
      x += (zielX - x) * 0.035;
      y += (zielY - y) * 0.035;
      const intro = clamp(t / INTRO);
      const aus = 1 - easeOut(intro);                       // 1 → 0
      const drehung = 360 * ease(clamp((t - drehStart) / DREHUNG));
      const gier = rad(-400 * aus * aus + Math.sin(t * 0.26) * 17 + x * 24 + drehung);
      const nick = rad(10 * aus + Math.sin(t * 0.19) * 4.5 - y * 12);
      const explode = 0.34 * aus * aus;                      // Schichten fliegen auseinander und finden zusammen
      const hub = Math.sin(t * 0.33) * 0.025;                // sanftes Schweben
      motor.zeichnen(gier, nick, explode, hub);
      requestAnimationFrame(bild);
    };
    requestAnimationFrame(bild);
  }

  /* ---------- Ablauf mit Sicherheitsnetz ---------- */
  fetch(SVG_QUELLE)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
    .then((text) => {
      const motor = starten(koerperAusSvg(text));
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); logo.classList.remove('ist-3d'); });
      motor.zeichnen(rad(-20), rad(7), reduziert ? 0 : 0.34, 0); // erstes Bild, dann umschalten
      logo.classList.add('ist-3d');
      laufen(motor);
    })
    .catch((fehler) => {
      // Das flache Gesamtlogo bleibt einfach stehen
      logo.classList.remove('ist-3d');
      if (window.console) console.warn('3D-Bildmarke nicht verfügbar:', fehler.message);
    });
})();
