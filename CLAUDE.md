# tundra-beach-web

Webseite für www.tundra-beach.at – Spaßseite eines nicht eingetragenen Vereins (kein Firmen- oder Privatauftritt).

## Hosting
- GitHub Pages aus dem Branch `main`, Root-Verzeichnis. Jeder Push auf `main` geht live.
- Domain über `CNAME` (www.tundra-beach.at). DNS liegt bei Hosttech – `CNAME` nicht ändern oder löschen.
- Kontakt-Mail: info@tundra-beach.at (Zoho Mail).

## Aktueller Stand
- Live ist die Unterwasser-Seite (`index.html`, geschaltet am 13.11.2026). Der Platzhalter "Work in Progress" liegt als `wip.html` bereit (Rückweg siehe unten). Die frühere Hütten-Seite (CSS-3D-Rundgang) wurde entfernt: Sie wurde auf dem Gerät des Auftraggebers "komplett zerschossen" dargestellt (Gerät und Browser unbekannt, im Test-Browser lief sie). Vorsicht deshalb: Die Unterwasser-Seite wurde bisher nur in einem Test-Browser ohne Grafikkarte geprüft; bei Problemen nach Gerät und Browser fragen.
- Die Seite (`index.html`): Tundra Beach UNTER WASSER, WebGL2, vollflächiges Canvas. Wünsche des Auftraggebers: Marke von Anfang an da (setzt sich nicht zusammen), schwebt im Raum, anklick- und drehbar; die Bereiche sind **Seifenblasen** mit Symbol und Namen (Wasserstand = Blase mit Wasser, Wetter = Sonne und Wolke, Kalender = Kalenderblatt mit dem heutigen Tag, Kontakt = Briefumschlag), erst beim Scrollen sichtbar; oben über der Marke steht der Titel in 3D: "Willkommen bei" als aufgezogene Schrift und "Tundra Beach" als Wortmarke aus dem Logo (die Marke sitzt dafür etwas weiter unten), darunter "Scroll down" (Klick scrollt automatisch zu den Blasen); der Titel hängt in der Welt und wandert beim Scrollen mit nach oben aus dem Bild; Scrollen = nach unten schauen: die Kamera sinkt im Wasser, darunter schweben die vier Blasen (alle mit Namen im Bild), ganz unten gibt es "To the top" (fährt weich nach oben, jede Eingabe bricht ab); die Infos erscheinen als Text in der Blase, Klick auf eine Blase fliegt hin, "Zurück" fliegt zu den Blasen zurück; je tiefer, desto dunkler das Wasser; wo die Maus entlangfährt, steigen kleine Blasen auf; dazu ein paar größere Blasen zum Anklicken und Platzenlassen (kleines Spiel mit Zähler); das Home-Logo oben links gibt es erst, wenn man nicht mehr auf der Startseite ist, es bewegt sich nur ganz leicht mit dem Zeiger, Klick = Neustart/zurück; im Untermenü oben ein Pfeil "← Zurück zur Startseite"; alle Bewegungen sehr weich, nichts stoppt abrupt. Die Uhr steht im Kalender-Bereich (`#uhr` führt dorthin). Aufbau:
  - `geometrie.js`: SVG-Pfade lesen (Bézier in Strecken), Konturen gleichmäßig abtasten, Polygone mit Löchern bilden, Earcut-Triangulierung (Mapbox, ISC), Körper mit abgerundeter Kante aufziehen (Rundung pro Punkt auf den freien Platz begrenzt, bei Überschneidungen verkleinert). Läuft auch in Node zum Testen (Flächen-Gegenprobe).
  - `daten.js`: Uhr (Lienzer Zeit), Kalender, Wetter, Wasserstand, Kontakt. Ein Zustand für alles (`inhalt(key)` = Hauptzahl, Zeilen, Stand/Quelle); `einbauen()` schreibt ihn per `textContent` in Absätze (ändert nur, was sich geändert hat). Textfassung im DOM (`#daten`, für Screenreader und ohne WebGL sichtbar). Daten aus `data/live.json`.
  - `schrift3d.js`: zeichnet Text mit der Systemschrift des Geräts in ein Canvas und holt per Marching Squares die Umrisse heraus (Konturen mit Löchern, vereinfacht); daraus zieht `marke3d.js` "Willkommen bei" als 3D-Schrift auf (`willkommenKoerper`). Klappt das nicht, fehlt nur diese Zeile.
  - `symbole.js`: malt die vier Symbole (weiße Linien, 512 × 512) auf Canvas, die als Textur in der Mitte der Blasen liegen. Das Kalender-Symbol zeigt den heutigen Tag.
  - `marke3d.js`: Bildmarke (Pfadnummern in `SCHICHTEN` aus `gesamt-4c_web.svg`; wirft Fehler, wenn die Maße nicht passen), Wortmarke (`WORTE`: Pfade 0 bis 13 = "Tundra", 14 bis 25 = "Beach"; je gelbe Platte, dunkler Rand, Schatten-Buchstaben, blaue Buchstaben; `titelLage` ordnet im Querformat eine Zeile, im Hochformat zwei Zeilen an, `startPose` rahmt Titel und Marke ein), Blasen (`BLASEN`: Lage um `GRUPPE` für Querformat und Hochformat, Kugel mit Spiegelung, Regenbogenhaut und Glanz am Rand, Rück- und Vorderseite, Symbol als Rechteck zur Kamera dazwischen), Wasser (Hintergrund-Shader: Lichtschwund nach unten, ziehende Trübung, Strahlen von einer Sonne über dem Bild, Glanz oben; Nebel nach Entfernung, Lichtmuster/Kaustik auf den Körpern, blaugrünes Streulicht), Teilchen (1500 Punktsprites: Meeresstaub, Plankton, schwankend aufsteigende Luftblasen, große unscharfe Lichtflecken (Bokeh, fest vor der Linse, folgen Zoom und Blickrichtung); um die Kamera gekachelt, fest in der Welt, Tiefenunschärfe; beim Scrollen ziehen sie schneller mit), Zeigerblasen (bis 90 Punktsprites, entstehen auf der Blickgeraden des Zeigers, steigen schwankend auf und platzen). Platzblasen (Spiel: bis 9 größere Blasen steigen von unten durchs Bild, Anklicken lässt sie platzen = Ring und Tröpfchen, selten eine goldene Blase mit +5; Zähler `#spielstand` oben rechts, Meldung bei 10/25/50/100; Treffer per Projektion in `spielTreffer`, nicht bei reduzierter Bewegung). Kamerabahn `bahnBauen` (Übersicht mit Begrüßung, Gruppe der Blasen `gruppePose` passend zum Seitenverhältnis, ganz unten `UNTEN`; sanfter Übergang ohne Überschwingen) und `blasePose` (Flug zu einer Blase). Beschriftung der Blasen als DOM, nur der Name, keine Unterzeile (`.blase`, per Projektion am Mittelpunkt, `--r` = Radius, `--f` = Besuch 0 bis 1: Name wandert unter der Blase in die Blase, die Zeilen blenden nacheinander ein). Scrollen, Ziehen, Flug und Rückdrehen laufen über gedämpfte Federn (`glatt`, SmoothDamp). Flug zur Blase: Kamera wendet sich schneller zum Ziel, als sie hinfährt. Untermenü per `#wasserstand|#wetter|#kalender|#kontakt` (Verlauf/Zurück-Taste, Esc, direkter Einstieg), Scrollen dort gesperrt, `history.scrollRestoration = manual`.
  - Intro "Auftauchen" (7,5 s): Marke ist da, Kamera fährt aus der Tiefe heran, Marke dreht sich einmal herum, Wasser wird heller, Blasen rauschen vorbei, Licht schwenkt; die Namen der Blasen blenden erst gegen Ende ein.
  - Home-Logo (`#mini`): zweiter WebGL-Kontext ohne Wasser, Blasen und Teilchen; Klasse `versteckt` auf der Startseite.
  - Vorschau einer Stelle: `index.html?p=0.5` (0 bis 1, ohne Intro und Scrollen; 0.5 = bei den Blasen, 1 = ganz unten). Seite ist 600 svh hoch, solange 3D läuft.
  - Sicherheitsnetz: Klappt WebGL2 nicht, bleibt `web_marke-gelb_tundra-beach.svg` mit den Inhalten als Text. Bei `prefers-reduced-motion`: Standbild ohne Flug und ohne Zeigerblasen mit Titel und Marke; ein Menü (`#menue`) führt zu den vier Bereichen.
  - Gestaltung dieser Seite weicht vom Rest ab: gedämpfte Unterwasser-Farben (Verlauf `#3f8f9c` → `#17566f` → `#0a2a40`, nicht zu knallig blau), weißer Text, gelbe Marke (`#fbba00`).
- `impressum.html`, `datenschutz.html`: Rechtsseiten im gleichen Stil. Der Datenschutztext ist noch nicht auf die Live-Daten abgestimmt (Besucher sprechen nur mit der eigenen Domain, siehe unten).

## Platzhalter ein- und ausschalten
- Normalzustand (jetzt aktiv): `index.html` = Seite, `wip.html` = Platzhalter "Work in Progress".
- Schalter: GitHub → Actions → "Seite oder Platzhalter schalten" → Run workflow → `wip` oder `seite`. Der Workflow tauscht die Dateien (`scripts/umschalten.sh`), im Platzhalter-Zustand liegt die Seite als `seite.html` bereit (Vorschau, z. B. `/seite.html?p=0.5`). Dauert etwa 1 bis 2 Minuten.
- Ohne Actions: `scripts/umschalten.sh wip` bzw. `seite`, committen, pushen. Oder auf GitHub den Merge-Pull-Request mit "Revert" zurücknehmen.
- `index.html` und `wip.html` nicht von Hand umbenennen oder löschen, sonst erkennt das Skript den Zustand nicht mehr.

## Live-Daten
- `data/live.json` wird alle 30 Min von `.github/workflows/live-daten.yml` über `scripts/live-daten.mjs` aktualisiert (Wetter: Open-Meteo, Lienz; Pegel: Land Tirol Hydro Online, Messstelle Isel/Lienz Nr. 212167). Scheduled Workflows laufen nur auf `main`.
- Die Seite liest nur diese Datei, Besucher sprechen mit keinem Dritten. Schlägt ein Abruf fehl, bleibt der letzte Stand samt Zeitstempel; älter als 6 h wird als "Letzter bekannter Stand" markiert.
- Eine Messstelle "Drausteg" gibt es nicht. Die Drau-Pegel in Lienz (Verbund Peggetz, TIWAG Falkensteinsteg) veröffentlichen nur Klassen wie "unter Mittelwasser", nie Zahlen. Deshalb die Isel kurz vor der Mündung in die Drau.
- Lokal testen: `NODE_USE_ENV_PROXY=1 node scripts/live-daten.mjs` (nur nötig hinter einem Proxy).

## Dateien
- `web_wortmarke_tundra-beach.svg` – Schriftzug (zurzeit nicht eingebunden)
- `web_bildmarke_tundra-beach.svg` – Bildmarke, auch Favicon
- `web_huette_tundra-beach.svg` – Hütten-Illustration (zurzeit nicht eingebunden, war die Fassade der alten Hütten-Seite)
- `web_welle_tundra-beach.svg` – Welle (zurzeit nicht eingebunden)
- `gesamt-4c_web.svg` – Gesamtlogo (Quelle der 3D-Bildmarke)
- `web_marke-gelb_tundra-beach.svg` – flache gelbe Bildmarke, Sicherheitsnetz der 3D-Seite

## Gestaltung
- Startseite (`index.html`): Unterwasser-Welt, gedämpfte Blautöne, weißer Text, gelbe Marke (siehe oben). `impressum.html` und `datenschutz.html` sind ruhig und hell: Hintergrund `#ffffff`, Text `#2c2c2b`, Akzent Wasserblau `#5b9bbd`.
- Systemschrift (-apple-system, Segoe UI, Roboto …), Monospace für Status-Texte
- `prefers-reduced-motion` immer berücksichtigen

## Regeln für Code
- Reines HTML/CSS/JS, kein Build-Schritt, keine Frameworks, keine externen CDNs oder Tracker.
- Sicherheit hat Vorrang: kein `innerHTML` mit fremden Daten, kein Inline-Event-Handler, externe Links mit `rel="noopener noreferrer"`.
- Sauber, logisch und schlank strukturiert, keine doppelten Styles ohne Grund.
- Neue Seiten bekommen den Footer mit Kontakt · Impressum · Datenschutz.
- Sprache der Seite und der Kommunikation: Deutsch.

## Arbeitsweise
- Simon pflegt eine lokale Kopie im Ordner tundra-beach-web auf seiner SanDisk-Festplatte. Nach Änderungen dort `git pull`.
- Größere Änderungen erst auf einem eigenen Branch, `main` nur mit fertigem Stand.
