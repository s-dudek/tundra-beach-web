// Malt die Inhalte der Tafeln im Wasser auf Canvas-Flächen (werden in WebGL als Textur auf die Tafeln gelegt).
// Eine Tafel ist 3 : 2, gezeichnet wird mit 1536 × 1024 Pixeln.
(function (global) {
  'use strict';

  const B = 1536; const H = 1024;
  const INK = '#2c2c2b'; const BLAU = '#41639c'; const GELB = '#fbba00'; const WASSER = '#4f9cc4';
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const MONO = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

  const TITEL = { wasserstand: 'Wasserstand', wetter: 'Wetter in Lienz', uhr: 'Uhr', kalender: 'Kalender' };
  const NUMMER = { wasserstand: '01', wetter: '02', uhr: '03', kalender: '04' };

  // roundRect gibt es erst in neueren Browsern, sonst ein einfaches Rechteck
  function abgerundet(c, x, y, b, h, r) { if (c.roundRect) c.roundRect(x, y, b, h, r); else c.rect(x, y, b, h); }

  function text(c, s, x, y, schrift, farbe, ausrichtung, deckkraft) {
    c.save();
    c.font = schrift; c.fillStyle = farbe || INK; c.textAlign = ausrichtung || 'left'; c.textBaseline = 'alphabetic';
    c.globalAlpha = deckkraft === undefined ? 1 : deckkraft;
    c.fillText(s, x, y);
    c.restore();
  }

  function grund(c, key) {
    c.clearRect(0, 0, B, H);
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, B, H);
    // zarter Wellenrand unten, passend zum Wasser
    c.fillStyle = 'rgba(79,156,196,0.10)'; c.fillRect(0, H - 22, B, 22);
    text(c, NUMMER[key], 96, 96, `500 34px ${MONO}`, INK, 'left', 0.5);
    text(c, TITEL[key].toUpperCase(), 156, 96, `500 34px ${MONO}`, INK, 'left', 0.5);
  }

  function wolke(c, cx, cy, s) {
    c.beginPath();
    c.arc(cx - 0.18 * s, cy + 0.04 * s, 0.16 * s, Math.PI * 0.5, Math.PI * 1.5);
    c.arc(cx - 0.02 * s, cy - 0.08 * s, 0.22 * s, Math.PI, Math.PI * 1.9);
    c.arc(cx + 0.2 * s, cy + 0.04 * s, 0.16 * s, Math.PI * 1.5, Math.PI * 2.5);
    c.closePath();
    c.stroke();
  }

  function symbol(c, art, cx, cy, s) {
    c.save();
    c.strokeStyle = INK; c.lineWidth = s * 0.045; c.lineCap = 'round'; c.lineJoin = 'round';
    if (art === 'sonne' || art === 'teils') {
      const sx = art === 'teils' ? cx - 0.2 * s : cx; const sy = art === 'teils' ? cy - 0.18 * s : cy; const r = (art === 'teils' ? 0.13 : 0.2) * s;
      c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        c.beginPath(); c.moveTo(sx + Math.cos(a) * r * 1.4, sy + Math.sin(a) * r * 1.4); c.lineTo(sx + Math.cos(a) * r * 1.85, sy + Math.sin(a) * r * 1.85); c.stroke();
      }
    }
    if (art === 'teils') wolke(c, cx + 0.08 * s, cy + 0.12 * s, s * 0.9);
    if (art === 'wolken') wolke(c, cx, cy, s);
    if (art === 'regen' || art === 'schnee' || art === 'gewitter') wolke(c, cx, cy - 0.12 * s, s);
    if (art === 'regen') {
      [-0.2, 0, 0.2].forEach((dx) => { c.beginPath(); c.moveTo(cx + dx * s, cy + 0.18 * s); c.lineTo(cx + (dx - 0.04) * s, cy + 0.34 * s); c.stroke(); });
    }
    if (art === 'schnee') {
      [-0.2, 0, 0.2].forEach((dx, i) => { c.beginPath(); c.arc(cx + dx * s, cy + (0.22 + (i % 2) * 0.1) * s, s * 0.025, 0, Math.PI * 2); c.stroke(); });
    }
    if (art === 'gewitter') {
      c.beginPath(); c.moveTo(cx + 0.04 * s, cy + 0.14 * s); c.lineTo(cx - 0.06 * s, cy + 0.28 * s); c.lineTo(cx + 0.06 * s, cy + 0.28 * s); c.lineTo(cx - 0.04 * s, cy + 0.42 * s); c.stroke();
    }
    if (art === 'nebel') {
      [-0.2, -0.07, 0.06, 0.19].forEach((dy, i) => { c.beginPath(); c.moveTo(cx - (0.3 - i * 0.02) * s, cy + dy * s); c.lineTo(cx + (0.3 - (i % 2) * 0.06) * s, cy + dy * s); c.stroke(); });
    }
    c.restore();
  }

  /* ---------- Wasserstand ---------- */
  function wasserstand(c, d) {
    grund(c, 'wasserstand');
    const p = d.pegel;
    // Pegellatte
    const x0 = 200; const breite = 130; const oben = 190; const unten = 930; const hoehe = unten - oben;
    const cm = p ? Math.max(0, Math.min(400, p.cm)) : 0;
    c.lineWidth = 10; c.strokeStyle = INK; c.fillStyle = '#ffffff';
    c.beginPath(); abgerundet(c, x0, oben, breite, hoehe, 16); c.fill();
    if (p) {
      const fuell = (cm / 400) * hoehe;
      c.save(); c.beginPath(); abgerundet(c, x0 + 5, oben + 5, breite - 10, hoehe - 10, 12); c.clip();
      const verlauf = c.createLinearGradient(0, unten - fuell, 0, unten);
      verlauf.addColorStop(0, '#79b8d9'); verlauf.addColorStop(1, '#3d83ad');
      c.fillStyle = verlauf; c.fillRect(x0, unten - fuell, breite, fuell);
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(x0, unten - fuell, breite, 8);
      c.restore();
    }
    c.beginPath(); abgerundet(c, x0, oben, breite, hoehe, 16); c.stroke();
    c.lineWidth = 4; c.strokeStyle = INK;
    for (let i = 0; i <= 40; i += 1) {
      const y = unten - (i / 40) * hoehe; const gross = i % 5 === 0;
      c.beginPath(); c.moveTo(x0 - (gross ? 34 : 18), y); c.lineTo(x0, y); c.stroke();
      if (gross) text(c, String(i * 10), x0 - 46, y + 10, `500 28px ${MONO}`, INK, 'right', 0.7);
    }
    if (p) {
      const y = unten - (cm / 400) * hoehe;
      c.fillStyle = INK; c.beginPath(); c.moveTo(x0 + breite + 14, y); c.lineTo(x0 + breite + 58, y - 22); c.lineTo(x0 + breite + 58, y + 22); c.closePath(); c.fill();
    }
    // Werte
    text(c, 'ISEL · LIENZ', 560, 250, `500 40px ${MONO}`, INK, 'left', 0.65);
    if (p) {
      text(c, p.wert, 560, 470, `700 230px ${SANS}`, INK);
      const w = c.measureText ? (() => { c.save(); c.font = `700 230px ${SANS}`; const m = c.measureText(p.wert).width; c.restore(); return m; })() : 600;
      text(c, 'cm', 560 + w + 24, 470, `600 84px ${SANS}`, INK, 'left', 0.6);
      text(c, `${p.tendenz === 'steigend' ? '▲' : p.tendenz === 'fallend' ? '▼' : '►'}  Wasserstand ${p.tendenz}`, 560, 570, `500 54px ${SANS}`, INK, 'left', 0.85);
      c.fillStyle = 'rgba(44,44,43,0.18)'; c.fillRect(560, 628, 880, 4);
      text(c, 'WASSERTEMPERATUR', 560, 706, `500 30px ${MONO}`, INK, 'left', 0.55);
      text(c, p.temperatur, 560, 790, `700 84px ${SANS}`, BLAU);
      text(c, p.stand, 560, 900, `500 29px ${MONO}`, INK, 'left', 0.75);
      text(c, 'Quelle: Land Tirol, Hydro Online', 560, 944, `500 26px ${MONO}`, INK, 'left', 0.5);
    } else {
      text(c, 'Keine Daten', 560, 470, `700 110px ${SANS}`, INK, 'left', 0.6);
    }
  }

  /* ---------- Wetter ---------- */
  function wetter(c, d) {
    grund(c, 'wetter');
    const w = d.wetter;
    if (!w) { text(c, 'Keine Daten', 96, 470, `700 110px ${SANS}`, INK, 'left', 0.6); return; }
    symbol(c, w.art, 330, 470, 420);
    text(c, w.temperatur, 660, 400, `700 200px ${SANS}`, INK);
    text(c, w.text, 664, 500, `500 66px ${SANS}`, INK, 'left', 0.8);
    c.fillStyle = 'rgba(44,44,43,0.18)'; c.fillRect(660, 548, 780, 4);
    const felder = [['GEFÜHLT', w.gefuehlt], ['WIND', w.wind], ['LUFTFEUCHTE', w.feuchte], ['NIEDERSCHLAG', w.regen]];
    felder.forEach(([k, v], i) => {
      const x = 660 + (i % 2) * 400; const y = 640 + Math.floor(i / 2) * 150;
      text(c, k, x, y, `500 28px ${MONO}`, INK, 'left', 0.55);
      text(c, v, x, y + 70, `700 62px ${SANS}`, INK);
    });
    text(c, w.stand, 96, 940, `500 29px ${MONO}`, INK, 'left', 0.75);
    text(c, 'Quelle: Open-Meteo.com', 96, 982, `500 26px ${MONO}`, INK, 'left', 0.5);
  }

  /* ---------- Uhr ---------- */
  function uhr(c, d) {
    grund(c, 'uhr');
    const u = d.uhr; const cx = 520; const cy = 560; const R = 360;
    c.fillStyle = '#ffffff'; c.strokeStyle = INK; c.lineWidth = 18;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill(); c.stroke();
    c.lineCap = 'round';
    for (let i = 0; i < 60; i += 1) {
      const a = (i * Math.PI) / 30 - Math.PI / 2; const gross = i % 5 === 0;
      c.lineWidth = gross ? 14 : 5; c.strokeStyle = INK; c.globalAlpha = gross ? 1 : 0.55;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - (gross ? 70 : 44)), cy + Math.sin(a) * (R - (gross ? 70 : 44)));
      c.lineTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22)); c.stroke();
    }
    c.globalAlpha = 1;
    const zeiger = (winkel, laenge, breite, farbe, schwanz) => {
      const a = winkel - Math.PI / 2; c.strokeStyle = farbe; c.lineWidth = breite;
      c.beginPath(); c.moveTo(cx - Math.cos(a) * (schwanz || 0), cy - Math.sin(a) * (schwanz || 0)); c.lineTo(cx + Math.cos(a) * laenge, cy + Math.sin(a) * laenge); c.stroke();
    };
    zeiger(((u.h % 12) + u.m / 60) * (Math.PI / 6), R * 0.5, 28, INK);
    zeiger((u.m + u.s / 60) * (Math.PI / 30), R * 0.78, 20, INK);
    zeiger(u.s * (Math.PI / 30), R * 0.86, 7, BLAU, 50);
    c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, 22, 0, Math.PI * 2); c.fill();
    c.fillStyle = BLAU; c.beginPath(); c.arc(cx, cy, 9, 0, Math.PI * 2); c.fill();
    text(c, u.zeit, 940, 480, `700 104px ${MONO}`, INK);
    const teile = (u.datum || '').split(', ');
    text(c, teile[0] || '', 944, 590, `600 56px ${SANS}`, INK, 'left', 0.9);
    text(c, teile.slice(1).join(', '), 944, 660, `500 46px ${SANS}`, INK, 'left', 0.7);
    c.fillStyle = 'rgba(44,44,43,0.18)'; c.fillRect(944, 720, 500, 4);
    text(c, 'LIENZ, OSTTIROL', 944, 790, `500 30px ${MONO}`, INK, 'left', 0.55);
  }

  /* ---------- Kalender ---------- */
  function kalender(c, d) {
    grund(c, 'kalender');
    const k = d.kalender;
    text(c, k.titel, 96, 200, `700 100px ${SANS}`, INK);
    const zellB = (B - 192) / 7; const x0 = 96; const yKopf = 290; const y0 = 320; const zellH = 100;
    k.wochentage.forEach((w, i) => text(c, w.toUpperCase(), x0 + zellB * i + zellB / 2, yKopf, `500 32px ${MONO}`, INK, 'center', i >= 5 ? 0.4 : 0.6));
    c.fillStyle = 'rgba(44,44,43,0.18)'; c.fillRect(96, 304, B - 192, 4);
    for (let tag = 1; tag <= k.tage; tag += 1) {
      const idx = k.versatz + tag - 1; const col = idx % 7; const row = Math.floor(idx / 7);
      const mx = x0 + zellB * col + zellB / 2; const my = y0 + zellH * row + zellH / 2;
      if (tag === k.heute) {
        c.fillStyle = INK; c.beginPath(); c.arc(mx, my, 44, 0, Math.PI * 2); c.fill();
        text(c, String(tag), mx, my + 20, `700 58px ${SANS}`, '#ffffff', 'center');
      } else {
        text(c, String(tag), mx, my + 20, `500 58px ${SANS}`, INK, 'center', col >= 5 ? 0.5 : 0.9);
      }
    }
  }

  const MALER = { wasserstand, wetter, uhr, kalender };

  global.TBTafel = {
    BREITE: B, HOEHE: H,
    SCHLUESSEL: ['wasserstand', 'wetter', 'uhr', 'kalender'],
    TITEL,
    malen(key, canvas, daten) {
      const c = canvas.getContext('2d');
      MALER[key](c, daten);
    },
  };
}(window));
