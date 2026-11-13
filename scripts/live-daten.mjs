// Holt Wetter (Open-Meteo) und Pegel (Land Tirol, Hydro Online) und schreibt data/live.json.
// Schlägt ein Abruf fehl oder liefert er Unsinn, bleibt der bisherige Wert samt Zeitstempel erhalten.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const AUSGABE = new URL('../data/live.json', import.meta.url);
const LIENZ = { lat: 46.829, lon: 12.769 };
const PEGEL_NUMMER = '212167'; // Isel, Lienz (HD Tirol)
const TIMEOUT_MS = 20000;

async function holeJson(url) {
  const antwort = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
  if (!antwort.ok) throw new Error(`${url} -> HTTP ${antwort.status}`);
  return antwort.json();
}

const zahl = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

async function wetter() {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${LIENZ.lat}&longitude=${LIENZ.lon}`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m'
    + '&wind_speed_unit=kmh&timezone=GMT';
  const c = (await holeJson(url)).current;
  const stand = new Date(`${c.time}:00Z`);
  const ergebnis = {
    stand: stand.toISOString(),
    temperatur: zahl(c.temperature_2m, -60, 60),
    gefuehlt: zahl(c.apparent_temperature, -80, 70),
    feuchte: zahl(c.relative_humidity_2m, 0, 100),
    niederschlag: zahl(c.precipitation, 0, 500),
    wind: zahl(c.wind_speed_10m, 0, 400),
    windrichtung: zahl(c.wind_direction_10m, 0, 360),
    code: zahl(c.weather_code, 0, 99),
  };
  if (Number.isNaN(stand.getTime()) || ergebnis.temperatur === null || ergebnis.code === null) {
    throw new Error('Wetterdaten unvollständig');
  }
  return ergebnis;
}

async function pegel() {
  const stationen = await holeJson('https://hydro.tirol.gv.at/stationdata/data.json?parameter=Wasserstand');
  const s = stationen.find((x) => x.number === PEGEL_NUMMER);
  if (!s) throw new Error(`Messstelle ${PEGEL_NUMMER} nicht gefunden`);
  const w = s.values?.W?.Cmd;
  const wt = s.values?.WT?.['15m.Cmd.HD'];
  const wasserstand = zahl(w?.v, -50, 1500);
  if (wasserstand === null || typeof w.dt !== 'number') throw new Error('Pegelwert fehlt');
  return {
    messstelle: s.name,
    gewaesser: s.WTO_OBJECT,
    stand: new Date(w.dt).toISOString(),
    wasserstand_cm: wasserstand,
    tendenz: zahl(w.tendency, -1, 1),
    wassertemperatur: zahl(wt?.v, -5, 40),
    wassertemperatur_stand: typeof wt?.dt === 'number' ? new Date(wt.dt).toISOString() : null,
  };
}

let alt = {};
try { alt = JSON.parse(await readFile(AUSGABE, 'utf8')); } catch { /* erster Lauf */ }

const [w, p] = await Promise.allSettled([wetter(), pegel()]);
if (w.status === 'rejected' && p.status === 'rejected') {
  console.error('Beide Abrufe fehlgeschlagen, data/live.json bleibt unverändert.');
  process.exit(1);
}
const neu = { ...alt };
if (w.status === 'fulfilled') neu.wetter = w.value; else console.error('Wetter:', w.reason?.message ?? w.reason);
if (p.status === 'fulfilled') neu.pegel = p.value; else console.error('Pegel:', p.reason?.message ?? p.reason);

neu.quellen = {
  wetter: 'Open-Meteo.com',
  pegel: 'Land Tirol – Hydro Online (hydro.tirol.gv.at)',
};

const text = `${JSON.stringify(neu, null, 2)}\n`;
let vorher = '';
try { vorher = await readFile(AUSGABE, 'utf8'); } catch { /* neu */ }
if (text === vorher) {
  console.log('Keine Änderung.');
} else {
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(AUSGABE, text);
  console.log('data/live.json aktualisiert.');
}
