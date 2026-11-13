# tundra-beach-web

Webseite für www.tundra-beach.at – Spaßseite eines nicht eingetragenen Vereins (kein Firmen- oder Privatauftritt).

## Hosting
- GitHub Pages aus dem Branch `main`, Root-Verzeichnis. Jeder Push auf `main` geht live.
- Domain über `CNAME` (www.tundra-beach.at). DNS liegt bei Hosttech – `CNAME` nicht ändern oder löschen.
- Kontakt-Mail: info@tundra-beach.at (Zoho Mail).

## Aktueller Stand
- `index.html`: Scroll-Erlebnis (Branch `claude/gracious-ride-1gkoh8`, noch nicht auf `main`). Die Hütte steht da, beim Scrollen öffnet sich die Tür, man geht hinein und durch einen Gang mit vier Tafeln (Uhr, Kalender, Wetter Lienz, Pegel Isel Lienz), dreht sich um, geht hinaus und die Tür schließt sich. Davor das Intro (Wortmarke → Bildmarke, einmal pro Sitzung über sessionStorage).
- `impressum.html`, `datenschutz.html`: Rechtsseiten im gleichen Stil. Der Datenschutztext ist noch nicht auf die Live-Daten abgestimmt (Besucher sprechen nur mit der eigenen Domain, siehe unten).

## Aufbau der Szene
- `vorab.js` (vor dem Rendern): setzt `skip-intro` und die Klasse `szene`. Bei `prefers-reduced-motion` fehlt `szene`, dann gibt es eine ruhige Seite untereinander (Hütte, Tafeln).
- `tour.js`: Scroll-Fortschritt `p` (0 bis 1, geglättet) steuert alles. Zeitplan in `T`, Raum-Maße oben in der Datei. Tür und Wand der Hütte sind getrennte Ebenen (Türfläche in Zeichnungs-Koordinaten, `TUER`). Der Gang ist ein CSS-3D-Raum, die Kamera dreht um das Auge (`persp`), nicht um den Ursprung.
- `raum.js`: Inhalt der Tafeln (Uhr in Lienzer Zeit, Kalender, Wetter, Pegel). Texte nur per `textContent`.
- `site.css`: alles Layout. Gang-Maße (`--b`, `--l`, `--z0` …) müssen zu den Konstanten in `tour.js` passen. Ein- und Rückwand sind absichtlich 8 kleiner als der Gang, sonst fehlen im Browser Stücke davon.
- Meta-CSP in `index.html`: nur eigene Dateien, keine Inline-Styles und keine Inline-Skripte im HTML (Styles setzt JS über CSSOM).

## Live-Daten
- `data/live.json` wird alle 30 Min von `.github/workflows/live-daten.yml` über `scripts/live-daten.mjs` aktualisiert (Wetter: Open-Meteo, Lienz; Pegel: Land Tirol Hydro Online, Messstelle Isel/Lienz Nr. 212167). Scheduled Workflows laufen nur auf `main`.
- Die Seite liest nur diese Datei, Besucher sprechen mit keinem Dritten. Schlägt ein Abruf fehl, bleibt der letzte Stand samt Zeitstempel; älter als 6 h wird als "Letzter bekannter Stand" markiert.
- Eine Messstelle "Drausteg" gibt es nicht. Die Drau-Pegel in Lienz (Verbund Peggetz, TIWAG Falkensteinsteg) veröffentlichen nur Klassen wie "unter Mittelwasser", nie Zahlen. Deshalb die Isel kurz vor der Mündung in die Drau.
- Lokal testen: `NODE_USE_ENV_PROXY=1 node scripts/live-daten.mjs` (nur nötig hinter einem Proxy).

## Dateien
- `web_wortmarke_tundra-beach.svg` – Schriftzug (auch invertiert auf der Rückwand im Gang)
- `web_bildmarke_tundra-beach.svg` – Bildmarke, auch Favicon
- `web_huette_tundra-beach.svg` – Hütten-Illustration, ist die Hauptfigur der Startszene (Tür bei x 143,7 / y 46,9 / 43 × 99 von 221,97 × 157,3)
- `web_welle_tundra-beach.svg` – Welle (zurzeit nicht eingebunden)
- `gesamt-4c_web.svg` – Gesamtlogo

## Gestaltung
- Hintergrund `#ffffff`, Text `#2c2c2b`; im Innenraum der Hütte umgekehrt (Wand `#2c2c2b`, Tafeln weiß), einziger Akzent Wasserblau `#5b9bbd`
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
