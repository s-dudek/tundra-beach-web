// 3D-Logos: gestapelte Scheiben ergeben eine dicke Plakette. Beim Start (und beim Wechsel des Logos) fliegen die
// Scheiben auseinander und setzen sich langsam zusammen, danach sanftes Schwingen, Neigung nach Zeiger oder
// Finger, Tippen = einmal langsam drehen.
(() => {
  'use strict';

  const SCHEIBEN = 16;
  const NS = 'http://www.w3.org/2000/svg';
  const INTRO_ERSTES = 7;      // Sekunden beim ersten Laden
  const INTRO_WECHSEL = 5;     // Sekunden beim Wechsel des Logos
  const DREH_DAUER = 2.8;      // Sekunden für eine ganze Drehung

  const dreh = document.getElementById('dreh');
  const schatten = document.getElementById('schatten');
  const koerper = [...document.querySelectorAll('.koerper')];
  const knoepfe = [...document.querySelectorAll('.wahl button')];
  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scheiben aus der Silhouette des jeweiligen Logos
  koerper.forEach((k) => {
    const halter = k.querySelector('.scheiben');
    for (let i = 0; i < SCHEIBEN; i += 1) {
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('class', 'scheibe');
      s.setAttribute('viewBox', k.dataset.vb);
      s.setAttribute('aria-hidden', 'true');
      const u = document.createElementNS(NS, 'use');
      u.setAttribute('href', `#${k.dataset.sil}`);
      s.append(u);
      s.style.setProperty('--i', String(i));
      halter.append(s);
    }
  });

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - (1 - t) ** 3;

  let aktiv = koerper[0];
  function waehlen(name) {
    const ziel = koerper.find((k) => k.dataset.v === name);
    if (!ziel) return false;
    koerper.forEach((k) => { k.hidden = k !== ziel; });
    knoepfe.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === name)));
    aktiv = ziel;
    return true;
  }

  function setzen(gier, nick, spreizung, sichtbar) {
    dreh.style.transform = `rotateX(${nick.toFixed(2)}deg) rotateY(${gier.toFixed(2)}deg)`;
    aktiv.style.setProperty('--sp', spreizung.toFixed(3));
    aktiv.style.opacity = String(sichtbar);
    // Schatten wird schmaler, wenn die Plakette sich zur Seite dreht
    const breite = 0.55 + 0.45 * Math.abs(Math.cos((gier * Math.PI) / 180));
    schatten.style.transform = `scaleX(${breite.toFixed(3)})`;
    schatten.style.opacity = String((0.9 * sichtbar).toFixed(3));
  }

  const start = (location.hash || '').slice(1);
  waehlen(start);

  if (reduziert) {
    // Ruhig: kein Intro, keine Bewegung, nur leicht gedreht, damit die Dicke zu sehen ist
    setzen(-16, 7, 1, 1);
    knoepfe.forEach((b) => b.addEventListener('click', () => { waehlen(b.dataset.v); setzen(-16, 7, 1, 1); }));
    return;
  }

  let zielX = 0;
  let zielY = 0;
  let x = 0;
  let y = 0;
  let t0 = performance.now();
  let introDauer = INTRO_ERSTES;
  let drehStart = -100;

  window.addEventListener('pointermove', (e) => {
    zielX = (e.clientX / window.innerWidth) * 2 - 1;
    zielY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.wahl, a')) return;
    drehStart = (performance.now() - t0) / 1000;
  });

  knoepfe.forEach((b) => b.addEventListener('click', () => {
    if (!waehlen(b.dataset.v)) return;
    history.replaceState(null, '', `#${b.dataset.v}`);
    t0 = performance.now();
    introDauer = INTRO_WECHSEL;
    drehStart = -100;
  }));

  function bild(jetzt) {
    const t = (jetzt - t0) / 1000;
    x += (zielX - x) * 0.04;
    y += (zielY - y) * 0.04;

    const intro = clamp(t / introDauer);
    const aus = 1 - easeOut(intro);                       // 1 → 0
    const spreizung = 1 + 9 * aus * aus;                  // Scheiben fliegen auseinander und kommen zusammen
    const sichtbar = clamp(t / 1.2);
    const drehung = 360 * ease(clamp((t - drehStart) / DREH_DAUER));

    const gier = -540 * aus + Math.sin(t * 0.28) * 20 + x * 26 + drehung;
    const nick = 14 * aus + Math.sin(t * 0.21) * 5 - y * 14;
    setzen(gier, nick, spreizung, sichtbar);
    requestAnimationFrame(bild);
  }
  requestAnimationFrame(bild);
})();
