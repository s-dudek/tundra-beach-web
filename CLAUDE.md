# tundra-beach-web

Webseite für www.tundra-beach.at – Spaßseite eines nicht eingetragenen Vereins (kein Firmen- oder Privatauftritt).

## Hosting
- GitHub Pages aus dem Branch `main`, Root-Verzeichnis. Jeder Push auf `main` geht live.
- Domain über `CNAME` (www.tundra-beach.at). DNS liegt bei Hosttech – `CNAME` nicht ändern oder löschen.
- Kontakt-Mail: info@tundra-beach.at (Zoho Mail).

## Aktueller Stand
- Live ist der Platzhalter "Work in Progress" (`index.html`). Die Seite mit dem 3D-Rundgang durch die Hütte liegt als `seite.html` bereit. Sie wurde zurückgenommen, weil sie auf dem Gerät des Auftraggebers "komplett zerschossen" dargestellt wurde (Gerät und Browser unbekannt, im Test-Browser lief sie).
- Neuer Versuch (nur über `marke.html` erreichbar, nirgends verlinkt): Tundra Beach UNTER WASSER, WebGL2, vollflächiges Canvas. Wünsche des Auftraggebers: Marke von Anfang an da (setzt sich nicht zusammen), schwebt im Raum, anklick- und drehbar; die Bereiche sind **Seifenblasen** mit Symbol und Namen (Wasserstand = Blase mit Wasser, Wetter = Sonne und Wolke, Kalender = Kalenderblatt mit dem heutigen Tag, Kontakt = Briefumschlag), auf der Startseite sichtbar; Scrollen = Zoomen: immer auf den Mittelpunkt der Marke zu (bis ca. 3-fach) und wieder zurück in die Anfangsansicht, ohne Drehung; die Blasen wandern dabei aus dem Bild und kommen zurück. Zu den Inhalten kommt man per Klick auf eine Blase, die Infos erscheinen als Text in der Blase; Klick auf eine Blase fliegt hin; am Ende der Reise zurück in die Anfangsperspektive (kein Zerlegen); wo die Maus entlangfährt, steigen kleine Blasen auf; das Home-Logo oben links gibt es erst, wenn man nicht mehr auf der Startseite ist, es bewegt sich nur ganz leicht mit dem Zeiger, Klick = Neustart/zurück; im Untermenü oben ein Pfeil "← Zurück zur Startseite"; alle Bewegungen sehr weich, nichts stoppt abrupt. Die Uhr steht im Kalender-Bereich (`#uhr` führt dorthin). Aufbau:
  - `geometrie.js`: SVG-Pfade lesen (Bézier in Strecken), Konturen gleichmäßig abtasten, Polygone mit Löchern bilden, Earcut-Triangulierung (Mapbox, ISC), Körper mit abgerundeter Kante aufziehen (Rundung pro Punkt auf den freien Platz begrenzt, bei Überschneidungen verkleinert). Läuft auch in Node zum Testen (Flächen-Gegenprobe).
  - `daten.js`: Uhr (Lienzer Zeit), Kalender, Wetter, Wasserstand, Kontakt. Ein Zustand für alles (`inhalt(key)` = Hauptzahl, Zeilen, Stand/Quelle); `einbauen()` schreibt ihn per `textContent` in Absätze (ändert nur, was sich geändert hat). Textfassung im DOM (`#daten`, für Screenreader und ohne WebGL sichtbar). Daten aus `data/live.json`.
  - `symbole.js`: malt die vier Symbole (weiße Linien, 512 × 512) auf Canvas, die als Textur in der Mitte der Blasen liegen. Das Kalender-Symbol zeigt den heutigen Tag.
  - `marke3d.js`: Bildmarke (Pfadnummern in `SCHICHTEN` aus `gesamt-4c_web.svg`; wirft Fehler, wenn die Maße nicht passen), Blasen (`BLASEN`: Lage für Querformat und Hochformat im Blickfeld der Startansicht, Kugel mit Spiegelung, Regenbogenhaut und Glanz am Rand, Rück- und Vorderseite, Symbol als Rechteck zur Kamera dazwischen), Wasser (Hintergrund-Shader: Lichtschwund nach unten, ziehende Trübung, Strahlen von einer Sonne über dem Bild, Glanz oben; Nebel nach Entfernung, Lichtmuster/Kaustik auf den Körpern, blaugrünes Streulicht), Teilchen (1500 Punktsprites: Meeresstaub, Plankton, schwankend aufsteigende Luftblasen, große unscharfe Lichtflecken (Bokeh); um die Kamera gekachelt, fest in der Welt, Tiefenunschärfe), Zeigerblasen (bis 90 Punktsprites, entstehen auf der Blickgeraden des Zeigers, steigen schwankend auf und platzen). Kamerabahn `BAHN` (Übersicht, ganz nah am Mittelpunkt `MITTE`/`TIEFE_ZOOM`, zurück; sanfter Übergang ohne Überschwingen, Blickrichtung bleibt) und `blasePose` (Flug zu einer Blase). Beschriftung der Blasen als DOM (`.blase`, per Projektion am Mittelpunkt, `--r` = Radius, `--f` = Besuch 0 bis 1: Name wandert unter der Blase in die Blase, die Zeilen blenden nacheinander ein). Scrollen, Ziehen, Flug und Rückdrehen laufen über gedämpfte Federn (`glatt`, SmoothDamp). Flug zur Blase: Kamera wendet sich schneller zum Ziel, als sie hinfährt. Untermenü per `#wasserstand|#wetter|#kalender|#kontakt` (Verlauf/Zurück-Taste, Esc, direkter Einstieg), Scrollen dort gesperrt, `history.scrollRestoration = manual`.
  - Intro "Auftauchen" (7,5 s): Marke ist da, Kamera fährt aus der Tiefe heran, Marke dreht sich einmal herum, Wasser wird heller, Blasen rauschen vorbei, Licht schwenkt; die Namen der Blasen blenden erst gegen Ende ein.
  - Home-Logo (`#mini`): zweiter WebGL-Kontext ohne Wasser, Blasen und Teilchen; Klasse `versteckt` auf der Startseite.
  - Vorschau einer Stelle: `marke.html?p=0.5` (0 bis 1, ohne Intro und Scrollen; 0.5 = ganz nah). Seite ist 600 svh hoch, solange 3D läuft.
  - Sicherheitsnetz: Klappt WebGL2 nicht, bleibt `web_marke-gelb_tundra-beach.svg` mit den Inhalten als Text. Bei `prefers-reduced-motion`: Standbild ohne Flug und ohne Zeigerblasen, die Blasen mit Namen sind das Menü.
  - Gestaltung dieser Seite weicht vom Rest ab: Unterwasser-Farben (Verlauf `#1d9bb8` → `#0d6286` → `#062a44`), weißer Text, gelbe Marke (`#fbba00`).
- `impressum.html`, `datenschutz.html`: Rechtsseiten im gleichen Stil. Der Datenschutztext ist noch nicht auf die Live-Daten abgestimmt (Besucher sprechen nur mit der eigenen Domain, siehe unten).

## Aufbau der Hütten-Szene (`seite.html`)
- Die Hütte ist die SVG `web_huette_tundra-beach.svg` als Fassade (Langseite) vorn, dazu Rück-, Seiten- und Innenwände, Boden, Decke. Maße (Weltpixel, 1 Zeichnungseinheit = 6,65 px): Körper 1200 breit, 600 tief (halb so tief wie breit), 805 hoch. Ursprung = Mitte des Hüttenbodens, y nach unten, z zum Betrachter. Tür und Fensterglas sind Ausschnitte (`clip-path: path()`) in der Fassade und in der Innen-Vorderwand; die Tür ist eine eigene Ebene mit Angel links und öffnet nach außen.
- Scharf bleibt die Hütte nur, weil die Kamera sich bewegt und nichts per `scale` aufgezogen wird. Kein `will-change: transform` auf großen Flächen.
- `vorab.js` (vor dem Rendern): setzt `skip-intro` und die Klasse `szene`. Bei `prefers-reduced-motion` fehlt `szene`, dann gibt es eine ruhige Seite untereinander (Hütte, Karten).
- `tour.js`: Scroll-Fortschritt `p` (0 bis 1, geglättet) steuert Kamera (Pfad aus Schlüsselbildern `pfad`) und Tür. Die Kamera dreht um das Auge (`persp`), nicht um den Ursprung. Abstände richten sich nach der Bildschirmgröße.
- `raum.js`: Inhalt der Wandobjekte (Uhr in Lienzer Zeit, Kalender, Wetter, Pegel) und die Ausblick-Animation (Sonne, Wolken, Regen, Schnee, Nebel, Blitz). Texte nur per `textContent`.
- `site.css`: alle Maße der 3D-Welt stehen hier und müssen zu den Konstanten in `tour.js` passen.
- Regeln fürs 3D: Flächen dürfen sich weder an der Kante berühren noch durchdringen (4 bis 6 px Abstand), sonst fehlen im Browser Stücke oder werden falsch überdeckt. Wenige große Flächen (der Boden draußen ist eine einzige, drinnen wird er ausgeblendet), sonst wird die Seite langsam.
- Meta-CSP in `index.html`: nur eigene Dateien, keine Inline-Styles und keine Inline-Skripte im HTML (Styles setzt JS über CSSOM).

## Platzhalter ein- und ausschalten
- Normalzustand: `index.html` = Seite, `wip.html` = alter Platzhalter "Work in Progress".
- Schalter: GitHub → Actions → "Seite oder Platzhalter schalten" → Run workflow → `wip` oder `seite`. Der Workflow tauscht die Dateien (`scripts/umschalten.sh`), im Platzhalter-Zustand liegt die Seite als `seite.html` bereit (Vorschau). Dauert etwa 1 bis 2 Minuten.
- Ohne Actions: `scripts/umschalten.sh wip` bzw. `seite`, committen, pushen. Oder auf GitHub den Merge-Pull-Request mit "Revert" zurücknehmen.
- `index.html` und `wip.html` nicht von Hand umbenennen oder löschen, sonst erkennt das Skript den Zustand nicht mehr.

## Live-Daten
- `data/live.json` wird alle 30 Min von `.github/workflows/live-daten.yml` über `scripts/live-daten.mjs` aktualisiert (Wetter: Open-Meteo, Lienz; Pegel: Land Tirol Hydro Online, Messstelle Isel/Lienz Nr. 212167). Scheduled Workflows laufen nur auf `main`.
- Die Seite liest nur diese Datei, Besucher sprechen mit keinem Dritten. Schlägt ein Abruf fehl, bleibt der letzte Stand samt Zeitstempel; älter als 6 h wird als "Letzter bekannter Stand" markiert.
- Eine Messstelle "Drausteg" gibt es nicht. Die Drau-Pegel in Lienz (Verbund Peggetz, TIWAG Falkensteinsteg) veröffentlichen nur Klassen wie "unter Mittelwasser", nie Zahlen. Deshalb die Isel kurz vor der Mündung in die Drau.
- Lokal testen: `NODE_USE_ENV_PROXY=1 node scripts/live-daten.mjs` (nur nötig hinter einem Proxy).

## Dateien
- `web_wortmarke_tundra-beach.svg` – Schriftzug (auch als Logo an der linken Innenwand)
- `web_bildmarke_tundra-beach.svg` – Bildmarke, auch Favicon
- `web_huette_tundra-beach.svg` – Hütten-Illustration, Fassade des 3D-Modells (Tür bei x 143,7 / y 46,9 / 43 × 99, Fensterglas bei x 107,5 / y 56,2 / 15,9 × 18,2, Wandkörper x 18,9 bis 199,6, von 221,97 × 157,3)
- `web_welle_tundra-beach.svg` – Welle (zurzeit nicht eingebunden)
- `gesamt-4c_web.svg` – Gesamtlogo (Quelle der 3D-Bildmarke)
- `web_marke-gelb_tundra-beach.svg` – flache gelbe Bildmarke, Sicherheitsnetz der 3D-Seite

## Gestaltung
- Hintergrund `#ffffff`, Text `#2c2c2b`; auch im Innenraum der Hütte alles weiß (Ziegel- und Dielenlinien in `#2c2c2b` mit geringer Deckkraft, weiche Schatten), einziger Akzent Wasserblau `#5b9bbd`
- Systemschrift (-apple-system, Segoe UI, Roboto …), Monospace für Status-Texte
- Ruhig, viel Weißraum; `prefers-reduced-motion` immer berücksichtigen

## Regeln für Code
- Reines HTML/CSS/JS, kein Build-Schritt, keine Frameworks, keine externen CDNs oder Tracker.
- Sicherheit hat Vorrang: kein `innerHTML` mit fremden Daten, kein Inline-Event-Handler, externe Links mit `rel="noopener noreferrer"`.
- Sauber, logisch und schlank strukturiert, keine doppelten Styles ohne Grund.
- Neue Seiten bekommen den Footer mit Kontakt · Impressum · Datenschutz.
- Sprache der Seite und der Kommunikation: Deutsch.

## Arbeitsweise
- Simon pflegt eine lokale Kopie im Ordner tundra-beach-web auf seiner SanDisk-Festplatte. Nach Änderungen dort `git pull`.
- Größere Änderungen erst auf einem eigenen Branch, `main` nur mit fertigem Stand.
