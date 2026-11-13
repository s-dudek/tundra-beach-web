// Erzeugt das Tundra-Beach-Logo (Wortmarke "Tundra" und "Beach" plus Bildmarke) als 3D-Datei (glTF Binary, .glb).
// Quelle ist gesamt-4c_web.svg; die Körper entstehen mit derselben Geometrie wie auf der Seite (geometrie.js).
// Aufruf: node scripts/logo-3d-export.mjs [Zieldatei]     Standard: 3d-export/tundra-beach-logo.glb
// Hinweis: Die Schichten (Platten, Ränder, Buchstaben) sind eigene Körper, die übereinanderliegen und sich berühren.
// Das ist ideal zum Ansehen und Rendern (Blender, Viewer, AR), zum 3D-Druck müssten sie noch vereinigt werden.
// Schichtlisten und Höhen müssen zu SCHICHTEN und WORTE in marke3d.js passen.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(hier, '..');
const G = createRequire(import.meta.url)(resolve(wurzel, 'geometrie.js'));
const ziel = resolve(process.argv[2] || resolve(wurzel, '3d-export/tundra-beach-logo.glb'));

/* ---------- Schichten (Nummern = Reihenfolge der path/polygon-Elemente in der SVG, hinten nach vorn) ---------- */
const reihe = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const MARKE_OBEN = 26;            // gelbes Schild der Bildmarke: bestimmt Maßstab und Mitte
const TEILE = [
  { name: 'Tundra', schichten: [
    { nrs: [0], platte: true, unten: -15, fase: 3, glanz: 0.8 }, { nrs: [1], hoehe: 3, fase: 1.1 },
    { nrs: reihe(2, 7), hoehe: 6, fase: 0.9 }, { nrs: reihe(8, 13), hoehe: 10, fase: 1.3 }] },
  { name: 'Beach', schichten: [
    { nrs: [14], platte: true, unten: -15, fase: 3, glanz: 0.8 }, { nrs: [15], hoehe: 3, fase: 1.1 },
    { nrs: reihe(16, 20), hoehe: 6, fase: 0.9 }, { nrs: reihe(21, 25), hoehe: 10, fase: 1.3 }] },
  { name: 'Bildmarke', schichten: [
    { nrs: [26], platte: true, unten: -15, fase: 3.2 }, { nrs: [27], hoehe: 3.2, fase: 0.8 }, { nrs: [28], hoehe: 3.2, fase: 0.8 },
    { nrs: [31], hoehe: 8, fase: 1.8 }, { nrs: [32], hoehe: 5.6, fase: 1.0 }, { nrs: [34], hoehe: 5.4, fase: 1.6 },
    { nrs: [36], hoehe: 6.4, fase: 0.8 }, { nrs: [37], hoehe: 10, fase: 1.5 }, { nrs: [38], hoehe: 13, fase: 1.6 }] },
];
const METER_PRO_EINHEIT = 0.0004;  // 742,8 Zeichnungseinheiten Logobreite = rund 30 cm
const STUFEN = 3;                  // Rundung der Kanten: Stufen je Fase
const ABTAST = 1.0;                // Abstand der Konturpunkte in Zeichnungseinheiten (kleiner = feiner, aber größer)

/* ---------- SVG lesen ---------- */
const svg = readFileSync(resolve(wurzel, 'gesamt-4c_web.svg'), 'utf8');
const farben = {};
svg.replace(/\.(cls-\d+)\s*\{[^}]*?fill:\s*(#[0-9a-fA-F]{3,6})/g, (_, k, f) => { farben[k] = f.length === 4 ? `#${[...f.slice(1)].map((c) => c + c).join('')}` : f.toLowerCase(); });
const elemente = [...svg.matchAll(/<(path|polygon)\b([^>]*)>/g)].map((m) => ({
  klasse: (/class="([^"]+)"/.exec(m[2]) || [])[1], d: (/\sd="([^"]+)"/.exec(m[2]) || [])[1],
}));
const grenzen = (d) => {
  const k = G.pfadLesen(d, 0.8).flat(); const xs = k.map((p) => p[0]); const ys = k.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};
const schild = grenzen(elemente[MARKE_OBEN].d);
const s = 2 / (schild.maxY - schild.minY);                   // Maßstab der Seite: Schild = 2 Einheiten hoch
const gesamt = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
TEILE.forEach((t) => { const g = grenzen(elemente[t.schichten[0].nrs[0]].d); ['minX', 'minY'].forEach((k) => { gesamt[k] = Math.min(gesamt[k], g[k]); }); ['maxX', 'maxY'].forEach((k) => { gesamt[k] = Math.max(gesamt[k], g[k]); }); });
const mx = (gesamt.minX + gesamt.maxX) / 2; const my = (gesamt.minY + gesamt.maxY) / 2;   // Mitte des ganzen Logos = Nullpunkt
const f = METER_PRO_EINHEIT / s;                              // Zeichnungseinheit → Meter (die Körper rechnen in "Seitenmaß" s)

/* ---------- Körper bauen ---------- */
const linear = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const materialIndex = new Map(); const materialien = [];
const material = (klasse) => {
  const hex = farben[klasse] || '#2c2c2b';
  if (!materialIndex.has(hex)) {
    materialIndex.set(hex, materialien.length);
    materialien.push({ name: hex, pbrMetallicRoughness: { baseColorFactor: [...linear(hex), 1], metallicFactor: 0, roughnessFactor: 0.45 }, doubleSided: false });
  }
  return materialIndex.get(hex);
};
const teile = TEILE.map((t) => {
  const prims = [];
  t.schichten.forEach((sch) => sch.nrs.forEach((nr) => {
    const el = elemente[nr]; if (!el || !el.d) return;
    const konturen = G.pfadLesen(el.d, 0.8).map((k) => k.map((p) => [(p[0] - mx) * s, -(p[1] - my) * s]));
    const pos = []; const nor = []; const idx = [];
    G.polygone(konturen).forEach((pg) => {
      const k = G.koerperBauen(pg, {
        unten: sch.platte ? sch.unten * s : 0, oben: sch.platte ? 0 : sch.hoehe * s,
        fasenOben: sch.fase * s, fasenUnten: sch.platte ? sch.fase * s : 0, unterseite: !!sch.platte, stufen: STUFEN, abtastung: ABTAST * s,
      });
      const basis = pos.length / 3;
      for (let i = 0; i < k.pos.length; i += 1) pos.push(k.pos[i] * f);
      for (let i = 0; i < k.nor.length; i += 1) nor.push(k.nor[i]);
      k.idx.forEach((i) => idx.push(basis + i));
    });
    if (idx.length) prims.push({ pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint32Array(idx), material: material(el.klasse) });
  }));
  return { name: t.name, prims };
});

/* ---------- glTF zusammensetzen ---------- */
const teileBytes = []; const bufferViews = []; const accessors = []; let offset = 0;
const anhaengen = (daten, ziel2) => {
  const bytes = Buffer.from(daten.buffer, daten.byteOffset, daten.byteLength);
  const pad = (4 - (bytes.length % 4)) % 4;
  teileBytes.push(bytes, Buffer.alloc(pad));
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target: ziel2 });
  offset += bytes.length + pad;
  return bufferViews.length - 1;
};
const meshes = []; const nodes = [];
teile.forEach((t) => {
  const primitives = t.prims.map((p) => {
    const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.pos.length; i += 3) for (let j = 0; j < 3; j += 1) { min[j] = Math.min(min[j], p.pos[i + j]); max[j] = Math.max(max[j], p.pos[i + j]); }
    accessors.push({ bufferView: anhaengen(p.pos, 34962), componentType: 5126, count: p.pos.length / 3, type: 'VEC3', min, max });
    const aPos = accessors.length - 1;
    accessors.push({ bufferView: anhaengen(p.nor, 34962), componentType: 5126, count: p.nor.length / 3, type: 'VEC3' });
    const aNor = accessors.length - 1;
    accessors.push({ bufferView: anhaengen(p.idx, 34963), componentType: 5125, count: p.idx.length, type: 'SCALAR' });
    return { attributes: { POSITION: aPos, NORMAL: aNor }, indices: accessors.length - 1, material: p.material, mode: 4 };
  });
  meshes.push({ name: t.name, primitives });
  nodes.push({ name: t.name, mesh: meshes.length - 1 });
});
const json = {
  asset: { version: '2.0', generator: 'tundra-beach-web scripts/logo-3d-export.mjs', copyright: 'Tundra Beach' },
  scene: 0, scenes: [{ name: 'Tundra Beach Logo', nodes: [nodes.length] }],
  nodes: [...nodes, { name: 'Tundra Beach Logo', children: nodes.map((_, i) => i) }],
  meshes, materials: materialien, accessors, bufferViews, buffers: [{ byteLength: offset }],
};
let jsonText = JSON.stringify(json);
jsonText += ' '.repeat((4 - (jsonText.length % 4)) % 4);
const jsonBytes = Buffer.from(jsonText, 'utf8'); const bin = Buffer.concat(teileBytes);
const kopf = Buffer.alloc(12); kopf.writeUInt32LE(0x46546c67, 0); kopf.writeUInt32LE(2, 4); kopf.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + bin.length, 8);
const kJson = Buffer.alloc(8); kJson.writeUInt32LE(jsonBytes.length, 0); kJson.writeUInt32LE(0x4e4f534a, 4);
const kBin = Buffer.alloc(8); kBin.writeUInt32LE(bin.length, 0); kBin.writeUInt32LE(0x004e4942, 4);
mkdirSync(dirname(ziel), { recursive: true });
writeFileSync(ziel, Buffer.concat([kopf, kJson, jsonBytes, kBin, bin]));
const dreiecke = accessors.filter((a) => a.type === 'SCALAR').reduce((n, a) => n + a.count / 3, 0);
console.log(`${ziel}: ${Math.round((12 + 16 + jsonBytes.length + bin.length) / 1024)} KB, ${meshes.length} Teile, ${materialien.length} Farben, ${dreiecke} Dreiecke`);
console.log(`Maße: ${((gesamt.maxX - gesamt.minX) * METER_PRO_EINHEIT * 100).toFixed(1)} cm breit, ${((gesamt.maxY - gesamt.minY) * METER_PRO_EINHEIT * 100).toFixed(1)} cm hoch`);
