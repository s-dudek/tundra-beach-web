# tundra-beach-web

Webseite für www.tundra-beach.at – Spaßseite eines nicht eingetragenen Vereins (kein Firmen- oder Privatauftritt).

## Hosting
- GitHub Pages aus dem Branch `main`, Root-Verzeichnis. Jeder Push auf `main` geht live.
- Domain über `CNAME` (www.tundra-beach.at). DNS liegt bei Hosttech – `CNAME` nicht ändern oder löschen.
- Kontakt-Mail: info@tundra-beach.at (Zoho Mail).

## Aktueller Stand
- `index.html`: Platzhalter "Work in Progress" mit Intro-Animation (Wortmarke → Bildmarke, einmal pro Sitzung über sessionStorage), animierter Welle und Decode-Text.
- `impressum.html`, `datenschutz.html`: Rechtsseiten im gleichen Stil.
- Die eigentliche Seite mit Inhalten ist noch zu bauen.

## Dateien
- `web_wortmarke_tundra-beach.svg` – Schriftzug
- `web_bildmarke_tundra-beach.svg` – Bildmarke, auch Favicon
- `web_huette_tundra-beach.svg` – Hütten-Illustration (Hintergrund, 14 % Deckkraft)
- `web_welle_tundra-beach.svg` – Welle
- `gesamt-4c_web.svg` – Gesamtlogo

## Gestaltung
- Hintergrund `#ffffff`, Text `#2c2c2b`
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
