#!/usr/bin/env bash
# Schaltet zwischen der Seite und dem Work-in-Progress-Platzhalter um.
#   Zustand "seite": index.html = Seite,       wip.html   = Platzhalter
#   Zustand "wip":   index.html = Platzhalter, seite.html = Seite (unter /seite.html als Vorschau erreichbar)
# Aufruf: scripts/umschalten.sh wip|seite   (danach committen und pushen)
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  wip)
    if [ -f seite.html ]; then echo "Der Platzhalter ist schon aktiv."; exit 0; fi
    git mv index.html seite.html
    git mv wip.html index.html
    echo "Platzhalter ist jetzt aktiv."
    ;;
  seite)
    if [ -f wip.html ]; then echo "Die Seite ist schon aktiv."; exit 0; fi
    git mv index.html wip.html
    git mv seite.html index.html
    echo "Die Seite ist jetzt aktiv."
    ;;
  *)
    echo "Aufruf: scripts/umschalten.sh wip|seite" >&2
    exit 2
    ;;
esac
