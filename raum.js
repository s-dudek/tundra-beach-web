// Inhalt der Tafeln: Uhr, Kalender, Wetter, Pegel. Alle Texte per textContent, kein innerHTML.
(() => {
  'use strict';

  const ZONE = 'Europe/Vienna';
  const $ = (id) => document.getElementById(id);
  const text = (id, wert) => { const el = $(id); if (el) el.textContent = wert; };

  const teileFormat = new Intl.DateTimeFormat('de-AT', {
    timeZone: ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  });
  const datumFormat = new Intl.DateTimeFormat('de-AT', {
    timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const standFormat = new Intl.DateTimeFormat('de-AT', {
    timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const monatFormat = new Intl.DateTimeFormat('de-AT', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const zahlFormat = (stellen) => new Intl.NumberFormat('de-AT', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  const eine = zahlFormat(1);
  const keine = zahlFormat(0);
  const zwei = (n) => String(n).padStart(2, '0');

  function jetzt() {
    const t = {};
    for (const p of teileFormat.formatToParts(new Date())) if (p.type !== 'literal') t[p.type] = Number(p.value);
    return t;
  }

  /* ---------- Uhr ---------- */
  const zeigerH = $('uhr-h');
  const zeigerM = $('uhr-m');
  const zeigerS = $('uhr-s');

  function uhrTick() {
    const t = jetzt();
    zeigerH.setAttribute('transform', `rotate(${(t.hour % 12) * 30 + t.minute * 0.5})`);
    zeigerM.setAttribute('transform', `rotate(${t.minute * 6 + t.second * 0.1})`);
    zeigerS.setAttribute('transform', `rotate(${t.second * 6})`);
    text('uhr-zeit', `${zwei(t.hour)}:${zwei(t.minute)}:${zwei(t.second)}`);
    return t;
  }

  /* ---------- Kalender ---------- */
  const raster = $('kal-raster');
  const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  let kalenderTag = '';

  function kalenderBauen(t) {
    const schluessel = `${t.year}-${t.month}-${t.day}`;
    if (schluessel === kalenderTag) return;
    kalenderTag = schluessel;

    const erster = new Date(Date.UTC(t.year, t.month - 1, 1));
    const tage = new Date(Date.UTC(t.year, t.month, 0)).getUTCDate();
    const versatz = (erster.getUTCDay() + 6) % 7; // Montag zuerst
    text('kal-monat', monatFormat.format(erster));
    text('uhr-datum', datumFormat.format(new Date()));

    const zellen = [];
    const zelle = (inhalt, klasse) => {
      const s = document.createElement('span');
      s.textContent = inhalt;
      if (klasse) s.className = klasse;
      zellen.push(s);
    };
    WOCHENTAGE.forEach((w) => zelle(w, 'kal-kopf'));
    for (let i = 0; i < versatz; i += 1) zelle('', '');
    for (let tag = 1; tag <= tage; tag += 1) {
      const spalte = (versatz + tag - 1) % 7;
      const klassen = [];
      if (spalte >= 5) klassen.push('kal-we');
      if (tag === t.day) klassen.push('kal-heute');
      zelle(String(tag), klassen.join(' '));
    }
    raster.replaceChildren(...zellen);
  }

  function tick() {
    const t = uhrTick();
    kalenderBauen(t);
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- Wetter und Pegel aus data/live.json ---------- */
  const WETTER = [
    // [Codes, Symbol, Text]
    [[0], 'sonne', 'Klar'],
    [[1], 'sonne', 'Überwiegend klar'],
    [[2], 'teils', 'Teils bewölkt'],
    [[3], 'wolken', 'Bedeckt'],
    [[45, 48], 'nebel', 'Nebel'],
    [[51, 53, 55], 'regen', 'Nieselregen'],
    [[56, 57], 'regen', 'Gefrierender Nieselregen'],
    [[61], 'regen', 'Leichter Regen'],
    [[63], 'regen', 'Regen'],
    [[65], 'regen', 'Starker Regen'],
    [[66, 67], 'regen', 'Gefrierender Regen'],
    [[71], 'schnee', 'Leichter Schneefall'],
    [[73], 'schnee', 'Schneefall'],
    [[75, 77], 'schnee', 'Starker Schneefall'],
    [[80, 81, 82], 'regen', 'Regenschauer'],
    [[85, 86], 'schnee', 'Schneeschauer'],
    [[95, 96, 99], 'gewitter', 'Gewitter'],
  ];
  // Ausblick aus dem Fenster: welche Ebenen zum Wettercode gehören
  function aussichtArten(code) {
    if (code <= 1) return ['sonne'];
    if (code === 2) return ['sonne', 'wolken'];
    if (code === 3) return ['wolken'];
    if (code === 45 || code === 48) return ['nebel'];
    if (code >= 95) return ['wolken', 'regen', 'blitz'];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['wolken', 'schnee'];
    return ['wolken', 'regen'];
  }

  function teilchen(elId, klasse, anzahl, dauer) {
    const ebene = $(elId);
    if (!ebene) return;
    for (let i = 0; i < anzahl; i += 1) {
      const t = document.createElement('i');
      t.className = klasse;
      t.style.setProperty('--x', `${Math.round(Math.random() * 520)}px`);
      t.style.setProperty('--d', `${(-Math.random() * dauer).toFixed(2)}s`);
      t.style.setProperty('--t', `${(dauer * (0.8 + Math.random() * 0.5)).toFixed(2)}s`);
      ebene.append(t);
    }
  }
  teilchen('aussicht-regen', 'tropfen', 46, 0.9);
  teilchen('aussicht-schnee', 'flocke', 40, 6);

  function aussichtSetzen(code) {
    const arten = aussichtArten(code);
    document.querySelectorAll('.aussicht-ebene').forEach((e) => e.classList.toggle('aktiv', arten.includes(e.dataset.art)));
  }

  const RICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  const VERALTET_NACH_MS = 6 * 60 * 60 * 1000;

  const standText = (iso, alt) => `${alt ? 'Letzter bekannter Stand' : 'Stand'}: ${standFormat.format(new Date(iso))} Uhr`;
  const gueltig = (v) => typeof v === 'number' && Number.isFinite(v);

  function markiereVeraltet(tafelId, iso) {
    const tafel = $(tafelId);
    const alt = Date.now() - new Date(iso).getTime() > VERALTET_NACH_MS;
    tafel.classList.toggle('veraltet', alt);
    return alt;
  }

  function wetterAnzeigen(w) {
    if (!w || !gueltig(w.temperatur)) return;
    const eintrag = WETTER.find(([codes]) => codes.includes(w.code)) || [[], 'wolken', 'Wetter'];
    text('wetter-temp', `${eine.format(w.temperatur)} °C`);
    text('wetter-text', eintrag[2]);
    if (gueltig(w.gefuehlt)) text('wetter-gefuehlt', `${eine.format(w.gefuehlt)} °C`);
    if (gueltig(w.wind)) {
      const richtung = gueltig(w.windrichtung) ? ` ${RICHTUNGEN[Math.round(w.windrichtung / 45) % 8]}` : '';
      text('wetter-wind', `${keine.format(w.wind)} km/h${richtung}`);
    }
    if (gueltig(w.feuchte)) text('wetter-feuchte', `${keine.format(w.feuchte)} %`);
    if (gueltig(w.niederschlag)) text('wetter-regen', `${eine.format(w.niederschlag)} mm`);
    aussichtSetzen(w.code);
    document.querySelectorAll('#wetter-icon svg').forEach((s) => s.classList.toggle('aktiv', s.dataset.icon === eintrag[1]));
    const alt = markiereVeraltet('wetter', w.stand);
    text('wetter-stand', standText(w.stand, alt));
  }

  function pegelAnzeigen(p) {
    if (!p || !gueltig(p.wasserstand_cm)) return;
    text('pegel-wert', eine.format(p.wasserstand_cm));
    const tendenz = p.tendenz === 1 ? 'steigend' : p.tendenz === -1 ? 'fallend' : 'gleichbleibend';
    text('pegel-tendenz', `Wasserstand, ${tendenz}`);
    if (gueltig(p.wassertemperatur)) text('pegel-temp', `${eine.format(p.wassertemperatur)} °C`);
    $('latte').style.setProperty('--pegel', String(Math.min(1, Math.max(0, p.wasserstand_cm / 400))));
    const alt = markiereVeraltet('pegel', p.stand);
    text('pegel-stand', standText(p.stand, alt));
  }

  async function datenLaden() {
    try {
      const antwort = await fetch('data/live.json', { cache: 'no-cache' });
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      const daten = await antwort.json();
      wetterAnzeigen(daten.wetter);
      pegelAnzeigen(daten.pegel);
    } catch (e) {
      text('wetter-text', 'Keine Daten');
      text('pegel-tendenz', 'Keine Daten');
    }
  }
  datenLaden();
  setInterval(datenLaden, 10 * 60 * 1000);
})();
