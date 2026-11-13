// Scroll-Szene: Hütte → Tür öffnet sich → Zoom hinein → Gang mit vier Tafeln → umdrehen, hinausgehen, Tür schließt sich.
// Reines JS, der Scroll-Fortschritt p (0..1) steuert alles. Nur aktiv, wenn vorab.js die Klasse "szene" gesetzt hat.
(() => {
  'use strict';

  const root = document.documentElement;
  if (!root.classList.contains('szene')) return;

  const el = (id) => document.getElementById(id);
  const tour = el('tour');
  const buehne = el('buehne');
  const welt = el('welt');
  const huette = el('huette');
  const rahmen = el('huette-rahmen');
  const tuer = el('tuer');
  const portal = el('portal');
  const weiss = el('weiss');
  const hinweis = el('hinweis');

  // Türfläche der Hütte in Zeichnungs-Koordinaten (viewBox 221,97 × 157,3); Angel links.
  const VB = { b: 221.97, h: 157.3 };
  const TUER = { x: 143.7, y: 46.9, b: 43, h: 99 };
  const TUER_MAX_GRAD = 84;

  // Raum in echten Koordinaten (Kamera = Auge, schaut nach -z). Muss zu --z0 und --l in site.css passen.
  const Z_PORTAL = 1110;     // Eingangswand des Gangs (Hütten-Tür von innen)
  const Z_ENDWAND = -4500;   // Rückwand des Gangs
  const DWELL = 1060;        // Abstand Kamera–Tafel beim Stehenbleiben (Maßstab = Perspektive / DWELL)
  const ENDE_DIST = 1460;    // Abstand zur Rückwand beim Stehenbleiben
  const Z_START = 810;       // Standpunkt vor dem ersten Schritt
  const Z_AUSGANG = Z_PORTAL - 140;

  // Tafeln im Gang: z = Tiefe (negativ = weiter hinten), seite = links/rechts versetzt.
  const STATIONEN = [
    { id: 'uhr', z: -500, seite: -1 },
    { id: 'kalender', z: -1500, seite: 1 },
    { id: 'wetter', z: -2500, seite: -1 },
    { id: 'pegel', z: -3500, seite: 1 },
  ];

  // Zeitplan im Scroll-Fortschritt
  const T = {
    tuerAuf: [0.04, 0.14],
    zoomRein: [0.14, 0.30],
    tour: [0.30, 0.84],
    dreh: [0.84, 0.89],
    zurueck: [0.89, 0.94],
    weiss: [0.925, 0.94],
    zoomRaus: [0.94, 0.975],
    tuerZu: [0.975, 1],
  };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const seg = (p, [a, b]) => clamp((p - a) / (b - a));

  const tafeln = STATIONEN.map((s) => ({ ...s, el: el(s.id) }));
  let g = {};     // Maße, bei jedem Resize neu
  let persp = 900; // CSS-Perspektive der Bühne
  let pfad = [];  // Kamera-Schlüsselbilder [p, x, z, yaw]

  function messen() {
    persp = parseFloat(getComputedStyle(buehne).perspective) || 900;
    const vw = buehne.clientWidth;
    const vh = buehne.clientHeight;
    const b = rahmen.offsetWidth;
    const h = rahmen.offsetHeight;
    const ox = ((TUER.x + TUER.b / 2) / VB.b) * b;
    const oy = ((TUER.y + TUER.h / 2) / VB.h) * h;
    const lochB = (TUER.b / VB.b) * b;
    const lochH = (TUER.h / VB.h) * h;
    g = {
      tx: b / 2 - ox,
      ty: h / 2 - oy,
      s: Math.max(vw / lochB, vh / lochH) * 1.3, // Tür füllt am Ende den ganzen Schirm
      xOff: Math.min(300, vw * 0.34),
    };
    rahmen.style.transformOrigin = `${ox}px ${oy}px`;

    tafeln.forEach((t) => {
      t.el.style.setProperty('--x', `${t.seite * g.xOff}px`);
      t.el.style.setProperty('--z', `${t.z}px`);
    });

    // Kamerapfad: stehen bleiben an jeder Tafel, dann Endwand, umdrehen, zurück zur Tür.
    const n = STATIONEN.length + 1;
    const span = (T.tour[1] - T.tour[0]) / n;
    pfad = [[0, 0, Z_START, 0], [T.tour[0], 0, Z_START, 0]];
    STATIONEN.forEach((s, i) => {
      const an = T.tour[0] + i * span + span * 0.42;
      const ab = T.tour[0] + (i + 1) * span;
      const x = s.seite * g.xOff * 0.9;
      const z = s.z + DWELL;
      pfad.push([an, x, z, 0], [ab, x, z, 0]);
    });
    const zEnde = Z_ENDWAND + ENDE_DIST;
    pfad.push([T.tour[0] + STATIONEN.length * span + span * 0.42, 0, zEnde, 0], [T.dreh[0], 0, zEnde, 0]);
    pfad.push([T.dreh[1], 0, zEnde, 180], [T.zurueck[1], 0, Z_AUSGANG, 180], [1, 0, Z_AUSGANG, 180]);
  }

  function kamera(p) {
    for (let i = 1; i < pfad.length; i += 1) {
      const a = pfad[i - 1];
      const b = pfad[i];
      if (p <= b[0]) {
        const t = b[0] === a[0] ? 1 : ease((p - a[0]) / (b[0] - a[0]));
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
      }
    }
    const l = pfad[pfad.length - 1];
    return [l[1], l[2], l[3]];
  }

  function zeichnen(p) {
    const rein = p < 0.5;

    // Außen: Tür und Zoom
    const auf = rein ? ease(seg(p, T.tuerAuf)) : 1 - ease(seg(p, T.tuerZu));
    const zoom = rein ? ease(seg(p, T.zoomRein)) : 1 - ease(seg(p, T.zoomRaus));
    const s = Math.exp(Math.log(g.s) * zoom);
    rahmen.style.transform = `translate(${g.tx * zoom}px, ${g.ty * zoom}px) scale(${s})`;
    tuer.style.transform = `perspective(1200px) rotateY(${auf * TUER_MAX_GRAD}deg)`;
    tuer.style.opacity = String(1 - seg(zoom, [0.6, 0.95]));
    huette.style.visibility = p > T.zoomRein[1] && p < T.zoomRaus[0] ? 'hidden' : 'visible';

    // Innen: Kamera durch den Gang
    const [cx, cz, yaw] = kamera(p);
    // Drehpunkt ist das Auge (persp vor dem Bildschirm), nicht der Ursprung.
    welt.style.transform = `translate3d(0, 0, ${persp}px) rotateY(${yaw}deg) translate3d(${-cx}px, 0, ${-(cz + persp)}px)`;
    tafeln.forEach((t) => {
      const d = cz - t.z; // Abstand vor der Kamera
      const o = yaw > 80 ? 0 : clamp((2800 - d) / 900) * clamp((d - 880) / 160);
      t.el.style.opacity = o.toFixed(3);
    });
    portal.style.visibility = p >= T.dreh[0] ? 'visible' : 'hidden';
    portal.style.opacity = '1';

    const w = rein ? 0 : ease(seg(p, T.weiss));
    weiss.style.opacity = String(w);
    welt.style.visibility = w >= 1 ? 'hidden' : 'visible';

    hinweis.style.opacity = String(0.7 * (1 - seg(p, [0.005, 0.04])));
    root.classList.toggle('innen', p > 0.295 && p < 0.94);
  }

  // Sanftes Nachziehen des Scroll-Fortschritts
  let ziel = 0;
  let ist = 0;
  let letzte = 0;
  let raf = 0;

  function lesen() {
    const max = tour.offsetHeight - buehne.offsetHeight;
    ziel = max > 0 ? clamp(-tour.getBoundingClientRect().top / max) : 0;
  }

  function schritt(zeit) {
    const dt = Math.min(0.05, (zeit - letzte) / 1000);
    letzte = zeit;
    ist += (ziel - ist) * (1 - Math.exp(-dt * 7));
    if (Math.abs(ziel - ist) < 0.00008) ist = ziel;
    zeichnen(ist);
    raf = ist === ziel ? 0 : requestAnimationFrame(schritt);
  }

  function anstossen() {
    lesen();
    if (!raf) {
      letzte = performance.now();
      raf = requestAnimationFrame(schritt);
    }
  }

  window.addEventListener('scroll', anstossen, { passive: true });
  window.addEventListener('resize', () => { messen(); anstossen(); });

  messen();
  lesen();
  ist = ziel;
  zeichnen(ist);
})();
