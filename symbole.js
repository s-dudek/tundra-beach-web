// Malt die Symbole der Blasen (Wasserstand, Wetter, Kalender, Kontakt) auf eine Canvas-Fläche.
// Sie liegen in WebGL als Textur in der Mitte der jeweiligen Blase. Weiße Linien, weicher Schatten.
(function (global) {
  'use strict';

  const S = 512; const M = S / 2;
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // roundRect gibt es erst in neueren Browsern, sonst ein einfaches Rechteck
  function abgerundet(c, x, y, b, h, r) { if (c.roundRect) c.roundRect(x, y, b, h, r); else c.rect(x, y, b, h); }

  // Wasserstand: eine Blase mit Wasser darin, Glanzbogen und zwei kleinen Blasen
  function wasserstand(c) {
    const welle = (x) => 292 + Math.sin(x / 36) * 13;
    c.beginPath(); c.arc(M, M, 178, 0, Math.PI * 2); c.stroke();
    c.save();
    c.beginPath(); c.arc(M, M, 166, 0, Math.PI * 2); c.clip();
    c.beginPath(); c.moveTo(60, welle(60));
    for (let x = 60; x <= 452; x += 8) c.lineTo(x, welle(x));
    c.lineTo(452, 460); c.lineTo(60, 460); c.closePath();
    c.fillStyle = 'rgba(255,255,255,0.34)'; c.shadowColor = 'transparent'; c.fill();
    c.restore();
    c.beginPath(); c.moveTo(96, welle(96));
    for (let x = 96; x <= 416; x += 8) c.lineTo(x, welle(x));
    c.stroke();
    c.save(); c.lineWidth = 16;
    c.beginPath(); c.arc(M, M, 134, Math.PI * 1.08, Math.PI * 1.4); c.stroke();
    c.lineWidth = 11;
    c.beginPath(); c.arc(318, 226, 17, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(262, 170, 10, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  // Wetter: Sonne, die halb hinter einer Wolke steht
  function wetter(c) {
    c.beginPath(); c.arc(330, 188, 60, 0, Math.PI * 2); c.stroke();
    c.save(); c.lineWidth = 18;
    for (let i = 0; i < 8; i += 1) {
      const w = (i / 8) * Math.PI * 2;
      c.beginPath(); c.moveTo(330 + Math.cos(w) * 92, 188 + Math.sin(w) * 92); c.lineTo(330 + Math.cos(w) * 118, 188 + Math.sin(w) * 118); c.stroke();
    }
    c.restore();
    const wolke = () => {
      c.beginPath(); c.moveTo(150, 402);
      c.bezierCurveTo(84, 402, 76, 316, 140, 312);
      c.bezierCurveTo(138, 246, 232, 226, 264, 292);
      c.bezierCurveTo(304, 252, 384, 292, 362, 348);
      c.bezierCurveTo(426, 350, 426, 402, 372, 402);
      c.closePath();
    };
    c.save(); c.globalCompositeOperation = 'destination-out'; c.shadowColor = 'transparent'; wolke(); c.lineWidth = 40; c.stroke(); c.fill(); c.restore();
    wolke(); c.save(); c.fillStyle = 'rgba(255,255,255,0.22)'; c.shadowColor = 'transparent'; c.fill(); c.restore(); c.stroke();
  }

  // Kalender: Blatt mit zwei Ringen und dem heutigen Tag
  function kalender(c, daten) {
    c.beginPath(); abgerundet(c, 96, 112, 320, 304, 44); c.stroke();
    c.save(); c.fillStyle = 'rgba(255,255,255,0.32)'; c.shadowColor = 'transparent';
    c.beginPath(); abgerundet(c, 107, 123, 298, 74, 34); c.fill(); c.fillRect(107, 160, 298, 37); c.restore();
    c.beginPath(); c.moveTo(106, 198); c.lineTo(406, 198); c.stroke();
    c.save(); c.lineWidth = 26;
    c.beginPath(); c.moveTo(184, 78); c.lineTo(184, 140); c.moveTo(328, 78); c.lineTo(328, 140); c.stroke();
    c.restore();
    const tag = String((daten && daten.kalender && daten.kalender.heute) || '');
    c.save(); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.font = `700 ${tag.length > 1 ? 136 : 150}px ${SANS}`; c.fillText(tag, M, 372); c.restore();
  }

  // Kontakt: Briefumschlag
  function kontakt(c) {
    c.beginPath(); abgerundet(c, 76, 134, 360, 250, 30); c.stroke();
    c.beginPath(); c.moveTo(90, 156); c.lineTo(M, 276); c.lineTo(422, 156); c.stroke();
    c.save(); c.lineWidth = 16;
    c.beginPath(); c.moveTo(94, 366); c.lineTo(206, 256); c.moveTo(418, 366); c.lineTo(306, 256); c.stroke();
    c.restore();
  }

  const MALER = { wasserstand, wetter, kalender, kontakt };

  global.TBSymbole = {
    GROESSE: S,
    SCHLUESSEL: Object.keys(MALER),
    malen(key, canvas, daten) {
      const c = canvas.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
      if (!MALER[key]) return;
      c.save();
      c.lineWidth = 22; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#ffffff';
      c.shadowColor = 'rgba(0, 45, 75, 0.45)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
      MALER[key](c, daten);
      c.restore();
    },
  };
}(window));
