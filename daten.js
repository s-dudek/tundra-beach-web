// Inhalte der Unterseiten: Uhr (Lienzer Zeit), Kalender, Wetter und Wasserstand. Eine Quelle für alles:
// die 3D-Tafeln im Wasser lesen diesen Zustand, der Text darunter (für Screenreader und ohne WebGL) auch.
// Texte nur per textContent. Daten kommen aus data/live.json (von einer GitHub Action gepflegt).
(function (global) {
  'use strict';

  const ZONE = 'Europe/Vienna';
  const teile = new Intl.DateTimeFormat('de-AT', { timeZone: ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
  const datumFormat = new Intl.DateTimeFormat('de-AT', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const standFormat = new Intl.DateTimeFormat('de-AT', { timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const monatFormat = new Intl.DateTimeFormat('de-AT', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const zahl = (stellen) => new Intl.NumberFormat('de-AT', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  const eine = zahl(1); const keine = zahl(0);
  const zwei = (n) => String(n).padStart(2, '0');
  const gueltig = (v) => typeof v === 'number' && Number.isFinite(v);
  const VERALTET_NACH_MS = 6 * 60 * 60 * 1000;

  const WETTER = [
    [[0], 'sonne', 'Klar'], [[1], 'sonne', 'Überwiegend klar'], [[2], 'teils', 'Teils bewölkt'], [[3], 'wolken', 'Bedeckt'],
    [[45, 48], 'nebel', 'Nebel'], [[51, 53, 55], 'regen', 'Nieselregen'], [[56, 57], 'regen', 'Gefrierender Nieselregen'],
    [[61], 'regen', 'Leichter Regen'], [[63], 'regen', 'Regen'], [[65], 'regen', 'Starker Regen'], [[66, 67], 'regen', 'Gefrierender Regen'],
    [[71], 'schnee', 'Leichter Schneefall'], [[73], 'schnee', 'Schneefall'], [[75, 77], 'schnee', 'Starker Schneefall'],
    [[80, 81, 82], 'regen', 'Regenschauer'], [[85, 86], 'schnee', 'Schneeschauer'], [[95, 96, 99], 'gewitter', 'Gewitter'],
  ];
  const RICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const zustand = {
    uhr: { h: 0, m: 0, s: 0, zeit: '--:--:--', datum: '' },
    kalender: { titel: '', versatz: 0, tage: 30, heute: 1, wochentage: WOCHENTAGE },
    wetter: null,
    pegel: null,
    geladen: false,
  };
  const lauscher = [];
  const melden = (art) => lauscher.forEach((f) => f(art, zustand));

  function jetzt() {
    const t = {};
    teile.formatToParts(new Date()).forEach((p) => { if (p.type !== 'literal') t[p.type] = Number(p.value); });
    return t;
  }

  function uhrAktualisieren() {
    const t = jetzt();
    const u = zustand.uhr;
    u.h = t.hour; u.m = t.minute; u.s = t.second;
    u.zeit = `${zwei(t.hour)}:${zwei(t.minute)}:${zwei(t.second)}`;
    const datum = datumFormat.format(new Date());
    const tagWechsel = u.datum !== datum;
    u.datum = datum;
    if (tagWechsel) {
      const erster = new Date(Date.UTC(t.year, t.month - 1, 1));
      const k = zustand.kalender;
      k.titel = monatFormat.format(erster);
      k.versatz = (erster.getUTCDay() + 6) % 7;
      k.tage = new Date(Date.UTC(t.year, t.month, 0)).getUTCDate();
      k.heute = t.day;
      melden('kalender');
    }
    melden('uhr');
  }

  function wetterAufbereiten(w) {
    if (!w || !gueltig(w.temperatur)) return null;
    const eintrag = WETTER.find(([codes]) => codes.includes(w.code)) || [[], 'wolken', 'Wetter'];
    const alt = Date.now() - new Date(w.stand).getTime() > VERALTET_NACH_MS;
    return {
      art: eintrag[1], text: eintrag[2],
      temperatur: `${eine.format(w.temperatur)} °C`,
      gefuehlt: gueltig(w.gefuehlt) ? `${eine.format(w.gefuehlt)} °C` : '–',
      wind: gueltig(w.wind) ? `${keine.format(w.wind)} km/h${gueltig(w.windrichtung) ? ` ${RICHTUNGEN[Math.round(w.windrichtung / 45) % 8]}` : ''}` : '–',
      feuchte: gueltig(w.feuchte) ? `${keine.format(w.feuchte)} %` : '–',
      regen: gueltig(w.niederschlag) ? `${eine.format(w.niederschlag)} mm` : '–',
      stand: `${alt ? 'Letzter bekannter Stand' : 'Stand'}: ${standFormat.format(new Date(w.stand))} Uhr`,
    };
  }

  function pegelAufbereiten(p) {
    if (!p || !gueltig(p.wasserstand_cm)) return null;
    const alt = Date.now() - new Date(p.stand).getTime() > VERALTET_NACH_MS;
    return {
      cm: p.wasserstand_cm,
      wert: eine.format(p.wasserstand_cm),
      tendenz: p.tendenz === 1 ? 'steigend' : p.tendenz === -1 ? 'fallend' : 'gleichbleibend',
      temperatur: gueltig(p.wassertemperatur) ? `${eine.format(p.wassertemperatur)} °C` : '–',
      stand: `${alt ? 'Letzter bekannter Stand' : 'Stand'}: ${standFormat.format(new Date(p.stand))} Uhr`,
      ort: 'Isel in Lienz, kurz vor der Mündung in die Drau',
    };
  }

  async function laden() {
    try {
      const antwort = await fetch('data/live.json', { cache: 'no-cache' });
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      const d = await antwort.json();
      zustand.wetter = wetterAufbereiten(d.wetter);
      zustand.pegel = pegelAufbereiten(d.pegel);
      zustand.geladen = true;
    } catch (e) {
      zustand.geladen = true;
    }
    melden('wetter'); melden('pegel');
  }

  // Textfassung für Screenreader und für den Fall ohne WebGL
  function zeilen(key) {
    const z = zustand;
    if (key === 'uhr') return [`${z.uhr.zeit} Uhr`, z.uhr.datum, 'Lienz, Osttirol'];
    if (key === 'kalender') return [z.kalender.titel, `Heute ist der ${z.kalender.heute}.`];
    if (key === 'wetter') return z.wetter
      ? [`${z.wetter.temperatur}, ${z.wetter.text}`, `Gefühlt ${z.wetter.gefuehlt}`, `Wind ${z.wetter.wind}`, `Luftfeuchte ${z.wetter.feuchte}`, `Niederschlag ${z.wetter.regen}`, z.wetter.stand, 'Quelle: Open-Meteo.com']
      : ['Keine Daten'];
    if (key === 'wasserstand') return z.pegel
      ? [`${z.pegel.wert} cm, ${z.pegel.tendenz}`, `Wassertemperatur ${z.pegel.temperatur}`, z.pegel.ort, z.pegel.stand, 'Quelle: Land Tirol, Hydro Online']
      : ['Keine Daten'];
    return [];
  }

  function textFuellen() {
    ['wasserstand', 'wetter', 'uhr', 'kalender'].forEach((key) => {
      const ziel = document.getElementById(`d-${key}`);
      if (!ziel) return;
      const liste = ziel.querySelector('.zeilen');
      if (!liste) return;
      liste.replaceChildren(...zeilen(key).map((t) => { const p = document.createElement('p'); p.textContent = t; return p; }));
    });
  }

  global.TBDaten = {
    zustand,
    zeilen,
    beiAenderung(f) { lauscher.push(f); },
    start() {
      uhrAktualisieren();
      setInterval(uhrAktualisieren, 1000);
      laden();
      setInterval(laden, 10 * 60 * 1000);
      lauscher.push(() => textFuellen());
      textFuellen();
    },
  };
}(window));
