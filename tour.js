// Scroll-Szene: Hütte von außen → Tür öffnet sich → hinein, nach links schauen → Rundgang an der Rückwand
// (Uhr, Kalender, Pegel) → zum Fenster (Wetter) → zur Tür hinaus, umdrehen, Hütte wieder sehen.
// Die Hütte ist ein echter 3D-Körper (CSS), der Scroll-Fortschritt p (0..1) steuert nur die Kamera und die Tür.
// Nur aktiv, wenn vorab.js die Klasse "szene" gesetzt hat.
(() => {
  'use strict';

  const root = document.documentElement;
  if (!root.classList.contains('szene')) return;

  const el = (id) => document.getElementById(id);
  const tour = el('tour');
  const buehne = el('buehne');
  const welt = el('welt');
  const tuer = el('tuer');
  const hinweis = el('hinweis');
  const aussen = el('aussen');

  // Welt in Pixeln (siehe site.css): Mitte des Hüttenbodens = Ursprung, y nach unten, z zum Betrachter.
  const AUGE = -540;                 // Augenhöhe im Raum
  const AUSSEN = -430;               // Blickhöhe außen
  const FASSADE_Z = 300;             // Fassade (Langseite)
  const FASSADE_B = 1476;            // Breite der Fassadenzeichnung
  const FASSADE_H = 1046;
  const TUER_X = 371;                // Mitte der Tür
  const TUER_ANGEL = [228.4, -659, 300];
  const TUER_AUF_GRAD = 95;          // Tür öffnet nach außen
  const WAND_Z = -290;               // Vorderseite der Wandobjekte
  const INNEN_MAX_Z = 255;           // weiter vorn wäre die Kamera hinter der Vorderwand (z = 285)

  // Wandobjekte an der Rückwand: Mitte x, Größe, damit die Kamera den richtigen Abstand findet
  const OBJEKTE = {
    uhr: { x: 190, b: 280, h: 360 },
    kalender: { x: -125, b: 260, h: 330 },
    pegel: { x: -440, b: 300, h: 470 },
  };
  const FENSTER = { x: 40.6, b: 105.8, h: 121 };

  // Zeitplan im Scroll-Fortschritt
  const T = { tuerAuf: [0.09, 0.17], tuerZu: [0.955, 0.99] };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const seg = (p, [a, b]) => clamp((p - a) / (b - a));

  let persp = 800;
  let pfad = [];  // Kamera-Schlüsselbilder [p, x, y, z, yaw]; yaw > 0 = nach links drehen

  function messen() {
    const vw = buehne.clientWidth;
    const vh = buehne.clientHeight;
    persp = clamp(vw * 0.62, 480, 820);
    buehne.style.perspective = `${persp}px`;

    // Abstand, bei dem ein Objekt b × h gut ins Bild passt
    const abstand = (b, h, anteilB = 0.72, anteilH = 0.62) => Math.max((b / anteilB) * persp / vw, (h / anteilH) * persp / vh);
    const imRaum = (d, wandZ) => clamp(wandZ + d, -150, INNEN_MAX_Z);

    const zStart = FASSADE_Z + abstand(FASSADE_B * 1.12, FASSADE_H * 1.28, 1, 1);
    const zTuer = FASSADE_Z + abstand(286, 659, 0.45, 0.8);
    const zU = imRaum(abstand(OBJEKTE.uhr.b, OBJEKTE.uhr.h), WAND_Z);
    const zK = imRaum(abstand(OBJEKTE.kalender.b, OBJEKTE.kalender.h), WAND_Z);
    const zP = imRaum(abstand(OBJEKTE.pegel.b, OBJEKTE.pegel.h), WAND_Z);
    const zF = 285 - clamp(abstand(FENSTER.b, FENSTER.h, 0.55, 0.6), 130, 330);
    const x = (k) => OBJEKTE[k].x;

    pfad = [
      [0.00, 0, AUSSEN, zStart, 0],
      [0.04, 0, AUSSEN, zStart, 0],
      [0.14, TUER_X, AUSSEN, zTuer, 0],           // zur Tür gehen
      [0.17, TUER_X, AUSSEN, zTuer, 0],           // Tür geht auf
      [0.25, TUER_X, AUGE, 170, 0],               // hinein
      [0.29, TUER_X, AUGE, 170, 90],              // nach links schauen
      [0.31, TUER_X, AUGE, 170, 90],
      [0.37, x('uhr'), AUGE, zU, 0],              // Uhr
      [0.42, x('uhr'), AUGE, zU, 0],
      [0.46, (x('uhr') + x('kalender')) / 2, AUGE, 120, 35],
      [0.50, x('kalender'), AUGE, zK, 0],         // Kalender
      [0.55, x('kalender'), AUGE, zK, 0],
      [0.59, (x('kalender') + x('pegel')) / 2, AUGE, 140, 35],
      [0.63, x('pegel'), AUGE, zP, 0],            // Pegel
      [0.68, x('pegel'), AUGE, zP, 0],
      [0.72, x('pegel') + 150, AUGE, 90, 100],    // am Ende links herum
      [0.77, -210, AUGE, 20, 180],                // zur Vorderwand
      [0.82, FENSTER.x, AUGE, zF, 180],           // Fenster: Wetter
      [0.87, FENSTER.x, AUGE, zF, 180],
      [0.91, TUER_X, AUGE, 150, 180],             // zur Tür
      [0.935, TUER_X, AUGE, 560, 190],            // hinaus
      [0.99, 0, AUSSEN, zStart, 360],             // umdrehen, Hütte wieder im Blick
      [1.00, 0, AUSSEN, zStart, 360],
    ];
  }

  function kamera(p) {
    for (let i = 1; i < pfad.length; i += 1) {
      const a = pfad[i - 1];
      const b = pfad[i];
      if (p <= b[0]) {
        const t = b[0] === a[0] ? 1 : ease((p - a[0]) / (b[0] - a[0]));
        return [1, 2, 3, 4].map((k) => a[k] + (b[k] - a[k]) * t);
      }
    }
    return pfad[pfad.length - 1].slice(1);
  }

  function zeichnen(p) {
    const [cx, cy, cz, yaw] = kamera(p);
    // Die Kamera ist das Auge (persp vor dem Bildschirmpunkt); die Welt dreht um genau diesen Punkt.
    welt.style.transform = `translate3d(0, 0, ${persp}px) rotateY(${-yaw}deg) translate3d(${-cx}px, ${-cy}px, ${-cz}px)`;

    const auf = p < 0.5 ? ease(seg(p, T.tuerAuf)) : 1 - ease(seg(p, T.tuerZu));
    tuer.style.transform = `translate3d(${TUER_ANGEL[0]}px, ${TUER_ANGEL[1]}px, ${TUER_ANGEL[2]}px) rotateY(${-auf * TUER_AUF_GRAD}deg)`;

    hinweis.style.opacity = String(0.7 * (1 - seg(p, [0.005, 0.04])));
    // Drinnen braucht niemand den Boden draußen, das spart Rechenzeit
    aussen.style.visibility = p > 0.26 && p < 0.72 ? 'hidden' : 'visible';
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
  window.addEventListener('resize', () => { messen(); anstossen(); zeichnen(ist); });

  messen();
  lesen();
  ist = ziel;
  zeichnen(ist);
})();
