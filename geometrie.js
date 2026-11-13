// Geometrie für die 3D-Bildmarke: SVG-Pfade lesen, in Polygone zerlegen, in Dreiecke teilen (Ohrenschnitt nach
// dem Earcut-Verfahren von Mapbox, ISC-Lizenz) und zu Körpern mit abgerundeten Kanten aufziehen.
// Reines JS ohne Abhängigkeiten, läuft im Browser und in Node (zum Testen).
(function (global) {
  'use strict';

  /* ---------- SVG-Pfad → Konturen (Beziérkurven werden in kurze Strecken zerlegt) ---------- */
  const ZAHL = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
  const ARGUMENTE = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

  function pfadLesen(d, schritt) {
    const teilung = schritt || 0.8; // gewünschte Länge einer Strecke in Zeichnungseinheiten
    const konturen = [];
    let kontur = null;
    let x = 0; let y = 0; let startX = 0; let startY = 0;
    let letzterBefehl = '';
    let ctrlX = 0; let ctrlY = 0; // letzter Kontrollpunkt für S und T

    const neu = (px, py) => { kontur = [[px, py]]; konturen.push(kontur); };
    const linie = (px, py) => { kontur.push([px, py]); };
    const kubisch = (x1, y1, x2, y2, x3, y3) => {
      const laenge = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
      const n = Math.min(64, Math.max(3, Math.ceil(laenge / teilung)));
      for (let i = 1; i <= n; i += 1) {
        const t = i / n; const u = 1 - t;
        linie(
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        );
      }
      ctrlX = x2; ctrlY = y2; x = x3; y = y3;
    };
    const quadratisch = (x1, y1, x2, y2) => {
      const laenge = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1);
      const n = Math.min(64, Math.max(3, Math.ceil(laenge / teilung)));
      for (let i = 1; i <= n; i += 1) {
        const t = i / n; const u = 1 - t;
        linie(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2);
      }
      ctrlX = x1; ctrlY = y1; x = x2; y = y2;
    };

    const befehle = d.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    befehle.forEach((teil) => {
      const buchstabe = teil[0];
      const gross = buchstabe.toUpperCase();
      const relativ = buchstabe !== gross;
      const zahlen = (teil.slice(1).match(ZAHL) || []).map(Number);
      const anzahl = ARGUMENTE[gross];
      if (anzahl === undefined) throw new Error(`Pfadbefehl ${buchstabe} wird nicht unterstützt`);
      if (gross === 'Z') {
        if (kontur) { x = startX; y = startY; }
        letzterBefehl = 'Z';
        return;
      }
      for (let k = 0; k + anzahl <= zahlen.length; k += anzahl) {
        const a = zahlen.slice(k, k + anzahl);
        const ox = relativ ? x : 0; const oy = relativ ? y : 0;
        let befehl = gross;
        if (gross === 'M' && k > 0) befehl = 'L'; // weitere Paare nach M sind Linien
        switch (befehl) {
          case 'M':
            x = a[0] + ox; y = a[1] + oy; startX = x; startY = y; neu(x, y); ctrlX = x; ctrlY = y; break;
          case 'L':
            if (!kontur) neu(x, y);
            x = a[0] + ox; y = a[1] + oy; linie(x, y); ctrlX = x; ctrlY = y; break;
          case 'H':
            if (!kontur) neu(x, y);
            x = a[0] + (relativ ? x : 0); linie(x, y); ctrlX = x; ctrlY = y; break;
          case 'V':
            if (!kontur) neu(x, y);
            y = a[0] + (relativ ? y : 0); linie(x, y); ctrlX = x; ctrlY = y; break;
          case 'C':
            if (!kontur) neu(x, y);
            kubisch(a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy, a[4] + ox, a[5] + oy); break;
          case 'S': {
            if (!kontur) neu(x, y);
            const gespiegelt = 'CS'.includes(letzterBefehl);
            const c1x = gespiegelt ? 2 * x - ctrlX : x;
            const c1y = gespiegelt ? 2 * y - ctrlY : y;
            kubisch(c1x, c1y, a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy); break;
          }
          case 'Q':
            if (!kontur) neu(x, y);
            quadratisch(a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy); break;
          case 'T': {
            if (!kontur) neu(x, y);
            const gespiegelt = 'QT'.includes(letzterBefehl);
            const cx = gespiegelt ? 2 * x - ctrlX : x;
            const cy = gespiegelt ? 2 * y - ctrlY : y;
            quadratisch(cx, cy, a[0] + ox, a[1] + oy); break;
          }
          default:
            throw new Error(`Pfadbefehl ${buchstabe} wird nicht unterstützt`);
        }
        letzterBefehl = befehl;
      }
    });

    // Doppelte Punkte entfernen, Kontur schließen, Winzlinge verwerfen
    return konturen.map((k) => {
      const sauber = [];
      k.forEach((p) => {
        const l = sauber[sauber.length - 1];
        if (!l || Math.abs(l[0] - p[0]) > 2e-3 || Math.abs(l[1] - p[1]) > 2e-3) sauber.push(p);
      });
      while (sauber.length > 1) {
        const a = sauber[0]; const b = sauber[sauber.length - 1];
        if (Math.abs(a[0] - b[0]) < 2e-3 && Math.abs(a[1] - b[1]) < 2e-3) sauber.pop(); else break;
      }
      return sauber;
    }).filter((k) => k.length >= 3 && Math.abs(flaeche(k)) > 1e-4);
  }

  // Polygonfläche mit Vorzeichen (positiv = gegen den Uhrzeigersinn bei y nach oben)
  function flaeche(k) {
    let s = 0;
    for (let i = 0, j = k.length - 1; i < k.length; j = i, i += 1) s += (k[j][0] * k[i][1]) - (k[i][0] * k[j][1]);
    return s / 2;
  }

  function imInnern(punkt, k) {
    let drin = false;
    for (let i = 0, j = k.length - 1; i < k.length; j = i, i += 1) {
      if ((k[i][1] > punkt[1]) !== (k[j][1] > punkt[1])
        && punkt[0] < ((k[j][0] - k[i][0]) * (punkt[1] - k[i][1])) / (k[j][1] - k[i][1]) + k[i][0]) drin = !drin;
    }
    return drin;
  }

  // Konturen nach Verschachtelung ordnen: gerade Tiefe = Außenkontur, ungerade = Loch der direkten Mutter.
  // Außenkonturen werden gegen den Uhrzeigersinn, Löcher im Uhrzeigersinn ausgerichtet:
  // so liegt das Material immer links von der Laufrichtung.
  function polygone(konturen) {
    const eintraege = konturen.map((k) => ({ k, a: Math.abs(flaeche(k)) })).sort((p, q) => q.a - p.a);
    eintraege.forEach((e, i) => {
      e.tiefe = 0; e.mutter = null;
      for (let j = i - 1; j >= 0; j -= 1) {
        if (imInnern(e.k[0], eintraege[j].k) || imInnern(e.k[Math.floor(e.k.length / 2)], eintraege[j].k)) {
          if (e.mutter === null) e.mutter = eintraege[j];
          e.tiefe += 1;
        }
      }
    });
    const ergebnis = [];
    const zuPolygon = new Map();
    eintraege.forEach((e) => {
      if (e.tiefe % 2 === 0) {
        const ausen = flaeche(e.k) > 0 ? e.k.slice() : e.k.slice().reverse();
        const pg = { aussen: ausen, loecher: [] };
        zuPolygon.set(e, pg); ergebnis.push(pg);
      }
    });
    eintraege.forEach((e) => {
      if (e.tiefe % 2 === 1 && e.mutter && zuPolygon.has(e.mutter)) {
        zuPolygon.get(e.mutter).loecher.push(flaeche(e.k) < 0 ? e.k.slice() : e.k.slice().reverse());
      }
    });
    return ergebnis;
  }

  /* ---------- Earcut (Ohrenschnitt) ---------- */
  function earcut(data, holeIndices, dim) {
    dim = dim || 2;
    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
    let outerNode = linkedList(data, 0, outerLen, dim, true);
    const triangles = [];
    if (!outerNode || outerNode.next === outerNode.prev) return triangles;
    if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);
    earcutLinked(outerNode, triangles, dim, 0);
    return triangles;
  }
  function linkedList(data, start, end, dim, clockwise) {
    let last;
    if (clockwise === (signedArea(data, start, end, dim) > 0)) {
      for (let i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
    } else {
      for (let i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
    }
    if (last && equals(last, last.next)) { removeNode(last); last = last.next; }
    return last;
  }
  function filterPoints(start, end) {
    if (!start) return start;
    if (!end) end = start;
    let p = start; let again;
    do {
      again = false;
      if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
        removeNode(p);
        p = end = p.prev;
        if (p === p.next) break;
        again = true;
      } else {
        p = p.next;
      }
    } while (again || p !== end);
    return end;
  }
  function earcutLinked(ear, triangles, dim, pass) {
    if (!ear) return;
    let stop = ear; let prev; let next;
    while (ear.prev !== ear.next) {
      prev = ear.prev; next = ear.next;
      if (isEar(ear)) {
        triangles.push((prev.i / dim) | 0, (ear.i / dim) | 0, (next.i / dim) | 0);
        removeNode(ear);
        ear = next.next; stop = next.next;
        continue;
      }
      ear = next;
      if (ear === stop) {
        if (!pass) earcutLinked(filterPoints(ear), triangles, dim, 1);
        else if (pass === 1) {
          ear = cureLocalIntersections(filterPoints(ear), triangles, dim);
          earcutLinked(ear, triangles, dim, 2);
        } else if (pass === 2) splitEarcut(ear, triangles, dim);
        break;
      }
    }
  }
  function isEar(ear) {
    const a = ear.prev; const b = ear; const c = ear.next;
    if (area(a, b, c) >= 0) return false;
    const x0 = Math.min(a.x, b.x, c.x); const y0 = Math.min(a.y, b.y, c.y);
    const x1 = Math.max(a.x, b.x, c.x); const y1 = Math.max(a.y, b.y, c.y);
    let p = c.next;
    while (p !== a) {
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1
        && pointInTriangleExceptFirst(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y)
        && area(p.prev, p, p.next) >= 0) return false;
      p = p.next;
    }
    return true;
  }
  function cureLocalIntersections(start, triangles, dim) {
    let p = start;
    do {
      const a = p.prev; const b = p.next.next;
      if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
        triangles.push((a.i / dim) | 0, (p.i / dim) | 0, (b.i / dim) | 0);
        removeNode(p); removeNode(p.next);
        p = start = b;
      }
      p = p.next;
    } while (p !== start);
    return filterPoints(p);
  }
  function splitEarcut(start, triangles, dim) {
    let a = start;
    do {
      let b = a.next.next;
      while (b !== a.prev) {
        if (a.i !== b.i && isValidDiagonal(a, b)) {
          let c = splitPolygon(a, b);
          a = filterPoints(a, a.next);
          c = filterPoints(c, c.next);
          earcutLinked(a, triangles, dim, 0);
          earcutLinked(c, triangles, dim, 0);
          return;
        }
        b = b.next;
      }
      a = a.next;
    } while (a !== start);
  }
  function eliminateHoles(data, holeIndices, outerNode, dim) {
    const queue = [];
    for (let i = 0, len = holeIndices.length; i < len; i += 1) {
      const start = holeIndices[i] * dim;
      const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
      const list = linkedList(data, start, end, dim, false);
      if (list === list.next) list.steiner = true;
      queue.push(getLeftmost(list));
    }
    queue.sort((a, b) => a.x - b.x);
    for (let i = 0; i < queue.length; i += 1) outerNode = eliminateHole(queue[i], outerNode);
    return outerNode;
  }
  function eliminateHole(hole, outerNode) {
    const bridge = findHoleBridge(hole, outerNode);
    if (!bridge) return outerNode;
    const bridgeReverse = splitPolygon(bridge, hole);
    filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
  }
  function findHoleBridge(hole, outerNode) {
    let p = outerNode;
    const hx = hole.x; const hy = hole.y;
    let qx = -Infinity; let m;
    do {
      if (equals(hole, p)) return p;
      if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
        const x = p.x + ((hy - p.y) * (p.next.x - p.x)) / (p.next.y - p.y);
        if (x <= hx && x > qx) {
          qx = x;
          m = p.x < p.next.x ? p : p.next;
          if (x === hx) return m;
        }
      }
      p = p.next;
    } while (p !== outerNode);
    if (!m) return null;
    const stop = m; const mx = m.x; const my = m.y;
    let tanMin = Infinity; let tan;
    p = m;
    do {
      if (hx >= p.x && p.x >= mx && hx !== p.x
        && pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
        tan = Math.abs(hy - p.y) / (hx - p.x);
        if (locallyInside(p, hole) && (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
          m = p; tanMin = tan;
        }
      }
      p = p.next;
    } while (p !== stop);
    return m;
  }
  function sectorContainsSector(m, p) { return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0; }
  function getLeftmost(start) {
    let p = start; let leftmost = start;
    do {
      if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p;
      p = p.next;
    } while (p !== start);
    return leftmost;
  }
  function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
    return (cx - px) * (ay - py) >= (ax - px) * (cy - py)
      && (ax - px) * (by - py) >= (bx - px) * (ay - py)
      && (bx - px) * (cy - py) >= (cx - px) * (by - py);
  }
  function pointInTriangleExceptFirst(ax, ay, bx, by, cx, cy, px, py) {
    return !(ax === px && ay === py) && pointInTriangle(ax, ay, bx, by, cx, cy, px, py);
  }
  function isValidDiagonal(a, b) {
    return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b)
      && ((locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b)
        && (area(a.prev, a, b.prev) || area(a, b.prev, b)))
        || (equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0));
  }
  function area(p, q, r) { return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y); }
  function equals(p1, p2) { return p1.x === p2.x && p1.y === p2.y; }
  function sign(num) { return num > 0 ? 1 : num < 0 ? -1 : 0; }
  function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  }
  function intersects(p1, q1, p2, q2) {
    const o1 = sign(area(p1, q1, p2)); const o2 = sign(area(p1, q1, q2));
    const o3 = sign(area(p2, q2, p1)); const o4 = sign(area(p2, q2, q1));
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
  }
  function intersectsPolygon(a, b) {
    let p = a;
    do {
      if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && intersects(p, p.next, a, b)) return true;
      p = p.next;
    } while (p !== a);
    return false;
  }
  function locallyInside(a, b) {
    return area(a.prev, a, a.next) < 0
      ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0
      : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
  }
  function middleInside(a, b) {
    let p = a; let inside = false;
    const px = (a.x + b.x) / 2; const py = (a.y + b.y) / 2;
    do {
      if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y
        && (px < ((p.next.x - p.x) * (py - p.y)) / (p.next.y - p.y) + p.x)) inside = !inside;
      p = p.next;
    } while (p !== a);
    return inside;
  }
  function splitPolygon(a, b) {
    const a2 = createNode(a.i, a.x, a.y); const b2 = createNode(b.i, b.x, b.y);
    const an = a.next; const bp = b.prev;
    a.next = b; b.prev = a;
    a2.next = an; an.prev = a2;
    b2.next = a2; a2.prev = b2;
    bp.next = b2; b2.prev = bp;
    return b2;
  }
  function insertNode(i, x, y, last) {
    const p = createNode(i, x, y);
    if (!last) { p.prev = p; p.next = p; } else {
      p.next = last.next; p.prev = last; last.next.prev = p; last.next = p;
    }
    return p;
  }
  function removeNode(p) { p.next.prev = p.prev; p.prev.next = p.next; }
  function createNode(i, x, y) { return { i, x, y, prev: null, next: null, steiner: false }; }
  function signedArea(data, start, end, dim) {
    let sum = 0;
    for (let i = start, j = end - dim; i < end; i += dim) { sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]); j = i; }
    return sum;
  }

  /* ---------- Kontur versetzen (nach innen), Normalen ---------- */
  // Material liegt links der Laufrichtung, die Außennormale zeigt nach rechts.
  function normalen(k) {
    const n = k.length;
    const kanten = [];
    for (let i = 0; i < n; i += 1) {
      const a = k[i]; const b = k[(i + 1) % n];
      const dx = b[0] - a[0]; const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      kanten.push([dy / l, -dx / l]);
    }
    return k.map((_, i) => {
      const e0 = kanten[(i + n - 1) % n]; const e1 = kanten[i];
      let nx = e0[0] + e1[0]; let ny = e0[1] + e1[1];
      const l = Math.hypot(nx, ny);
      if (l < 1e-6) { nx = e1[0]; ny = e1[1]; } else { nx /= l; ny /= l; }
      const kos = Math.max(0.4, nx * e1[0] + ny * e1[1]); // Gehrung begrenzen
      return { x: nx, y: ny, gehrung: 1 / kos };
    });
  }

  function versetzen(k, ns, abstand) {
    return k.map((p, i) => [p[0] - ns[i].x * abstand * ns[i].gehrung, p[1] - ns[i].y * abstand * ns[i].gehrung]);
  }

  /* ---------- Konturen gleichmäßig neu abtasten, freien Platz messen ---------- */
  // Gleiche Punktabstände entlang der geschlossenen Kontur: stabile Richtungen und Normalen
  function neuAbtasten(k, h) {
    const n = k.length;
    const seg = []; let laenge = 0;
    for (let i = 0; i < n; i += 1) {
      const l = Math.hypot(k[(i + 1) % n][0] - k[i][0], k[(i + 1) % n][1] - k[i][1]);
      seg.push(l); laenge += l;
    }
    const anzahl = Math.max(8, Math.round(laenge / h));
    const dl = laenge / anzahl;
    const aus = []; let i = 0; let acc = 0;
    for (let m = 0; m < anzahl; m += 1) {
      const ziel = m * dl;
      while (i < n - 1 && acc + seg[i] < ziel) { acc += seg[i]; i += 1; }
      const t = seg[i] > 0 ? (ziel - acc) / seg[i] : 0;
      const a = k[i]; const b = k[(i + 1) % n];
      aus.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    return aus;
  }

  function abstandPunktStrecke(px, py, ax, ay, bx, by) {
    const dx = bx - ax; const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // Für jeden Punkt: Abstand zur nächsten Kante, die nicht in seiner Nähe liegt (= Dicke des Materials an der Stelle)
  function freiraum(konturen, nah) {
    const kanten = [];
    konturen.forEach((k, ci) => { for (let i = 0; i < k.length; i += 1) kanten.push([ci, i, k[i], k[(i + 1) % k.length], k.length]); });
    return konturen.map((k, ci) => k.map((p, i) => {
      let best = Infinity;
      for (let e = 0; e < kanten.length; e += 1) {
        const [c, j, a, b, n] = kanten[e];
        if (c === ci) {
          let dd = Math.abs(j - i); dd = Math.min(dd, n - dd);
          if (dd <= nah) continue;
        }
        const d = abstandPunktStrecke(p[0], p[1], a[0], a[1], b[0], b[1]);
        if (d < best) best = d;
      }
      return best;
    }));
  }

  // Werte entlang der Kontur glätten, ohne größer zu werden
  function glaetten(werte, durchgaenge) {
    let w = werte.slice();
    for (let d = 0; d < durchgaenge; d += 1) {
      const n = w.length;
      w = w.map((v, i) => Math.min(v, 0.5 * v + 0.25 * (w[(i + n - 1) % n] + w[(i + 1) % n]) + 0.02));
    }
    return w;
  }

  // Kreuzen sich Strecken der (verschobenen) Konturen? Liefert Paare [kontur, index, kontur, index]
  function kreuzungen(konturen) {
    const seg = [];
    konturen.forEach((k, ci) => {
      for (let i = 0; i < k.length; i += 1) {
        const a = k[i]; const b = k[(i + 1) % k.length];
        seg.push({ ci, i, n: k.length, ax: a[0], ay: a[1], bx: b[0], by: b[1],
          x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) });
      }
    });
    const o = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
    const paare = [];
    for (let a = 0; a < seg.length; a += 1) {
      const s1 = seg[a];
      for (let b = a + 1; b < seg.length; b += 1) {
        const s2 = seg[b];
        if (s2.x0 > s1.x1 || s2.x1 < s1.x0 || s2.y0 > s1.y1 || s2.y1 < s1.y0) continue;
        if (s1.ci === s2.ci) {
          let dd = Math.abs(s1.i - s2.i); dd = Math.min(dd, s1.n - dd);
          if (dd <= 1) continue;
        }
        const d1 = o(s1.ax, s1.ay, s1.bx, s1.by, s2.ax, s2.ay); const d2 = o(s1.ax, s1.ay, s1.bx, s1.by, s2.bx, s2.by);
        const d3 = o(s2.ax, s2.ay, s2.bx, s2.by, s1.ax, s1.ay); const d4 = o(s2.ax, s2.ay, s2.bx, s2.by, s1.bx, s1.by);
        if (d1 * d2 < 0 && d3 * d4 < 0) paare.push([s1.ci, s1.i, s2.ci, s2.i]);
      }
    }
    return paare;
  }

  /* ---------- Körper mit abgerundeter Kante ---------- */
  // Format pro Punkt: x y z, Normale nx ny nz, Höhenanteil an der Wand (0 unten, 1 oben)
  function koerperBauen(pg, opt) {
    const unten = opt.unten; const oben = opt.oben;
    const stufen = opt.stufen || 5;
    const abtastung = opt.abtastung || 0.7;
    const pos = []; const nor = []; const hoehe = []; const idx = [];

    // Konturen vorbereiten: gleichmäßig abtasten, Orientierung beibehalten (Material links)
    const konturen = [pg.aussen].concat(pg.loecher).map((k) => neuAbtasten(k, abtastung));
    const ns = konturen.map(normalen);
    const platz = freiraum(konturen, 4).map((r) => glaetten(r.map((d) => d * 0.45), 4));

    const rOben = konturen.map((k, ci) => k.map((_, i) => Math.max(0, Math.min(opt.fasenOben || 0, platz[ci][i], (oben - unten) / 2))));
    const rUnten = konturen.map((k, ci) => k.map((_, i) => Math.max(0, Math.min(opt.fasenUnten || 0, platz[ci][i], (oben - unten) / 2))));
    const hatUnten = (opt.fasenUnten || 0) > 0;
    const hatOben = (opt.fasenOben || 0) > 0;

    // Schlussprüfung: kreuzt sich die verschobene Kontur noch, Rundung an diesen Stellen verkleinern
    [rOben, rUnten].forEach((radien, welcher) => {
      if (!(welcher === 0 ? hatOben : hatUnten)) return;
      for (let durchgang = 0; durchgang < 10; durchgang += 1) {
        const innen = konturen.map((k, ci) => k.map((p, i) => {
          const d = radien[ci][i] * ns[ci][i].gehrung;
          return [p[0] - ns[ci][i].x * d, p[1] - ns[ci][i].y * d];
        }));
        const paare = kreuzungen(innen);
        if (!paare.length) break;
        paare.forEach(([c1, i1, c2, i2]) => {
          [[c1, i1], [c2, i2]].forEach(([c, i]) => {
            const n = konturen[c].length;
            for (let dk = -3; dk <= 4; dk += 1) {
              const j = (i + dk + n * 4) % n;
              radien[c][j] *= (dk === 0 || dk === 1) ? 0.3 : 0.65;
            }
          });
        });
      }
    });

    // Ringbeschreibung von unten nach oben
    const ringe = [];
    if (hatUnten) for (let j = stufen; j >= 1; j -= 1) ringe.push({ art: 'u', phi: (j / stufen) * Math.PI / 2, h: 0 });
    ringe.push({ art: 'wu', h: 0 });
    ringe.push({ art: 'wo', h: 1 });
    if (hatOben) for (let j = 1; j <= stufen; j += 1) ringe.push({ art: 'o', phi: (j / stufen) * Math.PI / 2, h: 1 });

    const ringStart = [];
    konturen.forEach((k, ci) => {
      const n = k.length;
      const starts = [];
      ringe.forEach((ring) => {
        starts.push(pos.length / 3);
        for (let i = 0; i < n; i += 1) {
          const nn = ns[ci][i];
          const ro = rOben[ci][i]; const ru = rUnten[ci][i];
          let ofs = 0; let z; let nh = 1; let nz = 0;
          if (ring.art === 'u') {
            const c = Math.cos(ring.phi); const sn = Math.sin(ring.phi);
            ofs = ru * (1 - c); z = unten + ru - ru * sn; nh = c; nz = -sn;
          } else if (ring.art === 'wu') { z = unten + ru; } else if (ring.art === 'wo') { z = oben - ro; } else {
            const c = Math.cos(ring.phi); const sn = Math.sin(ring.phi);
            ofs = ro * (1 - c); z = oben - ro + ro * sn; nh = c; nz = sn;
          }
          const d = ofs * nn.gehrung;
          pos.push(k[i][0] - nn.x * d, k[i][1] - nn.y * d, z);
          nor.push(nn.x * nh, nn.y * nh, nz);
          hoehe.push(ring.h);
        }
      });
      ringStart.push(starts);
      for (let r = 0; r < ringe.length - 1; r += 1) {
        for (let i = 0; i < n; i += 1) {
          const i2 = (i + 1) % n;
          const a = starts[r] + i; const b = starts[r] + i2; const c = starts[r + 1] + i; const d2 = starts[r + 1] + i2;
          idx.push(a, b, c, b, d2, c);
        }
      }
    });

    // Deckel oben (und optional unten) aus den innersten Ringen
    const deckel = (ringNr, nachOben, z, nz) => {
      const daten = []; const loch = []; const basis = pos.length / 3;
      konturen.forEach((k, ci) => {
        if (ci > 0) loch.push(daten.length / 2);
        const st = ringStart[ci][ringNr];
        for (let i = 0; i < k.length; i += 1) {
          const o = (st + i) * 3;
          daten.push(pos[o], pos[o + 1]);
          pos.push(pos[o], pos[o + 1], z);
          nor.push(0, 0, nz);
          hoehe.push(1);
        }
      });
      const tri = earcut(daten, loch, 2);
      for (let t = 0; t < tri.length; t += 3) {
        if (nachOben) idx.push(basis + tri[t], basis + tri[t + 1], basis + tri[t + 2]);
        else idx.push(basis + tri[t], basis + tri[t + 2], basis + tri[t + 1]);
      }
    };
    deckel(ringe.length - 1, true, oben, 1);
    if (opt.unterseite) deckel(0, false, unten, -1);

    return { pos, nor, hoehe, idx, konturen, rOben };
  }

  const api = { pfadLesen, polygone, flaeche, earcut, koerperBauen, normalen, versetzen, neuAbtasten, freiraum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.TB3D = api;
}(typeof window !== 'undefined' ? window : globalThis));
