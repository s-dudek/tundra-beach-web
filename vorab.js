// Läuft vor dem ersten Rendern: Intro nur einmal pro Sitzung, Szene nur ohne reduzierte Bewegung.
(function () {
  var root = document.documentElement;
  try {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('szene');
  } catch (e) { /* ohne Szene weiter */ }
  try {
    if (sessionStorage.getItem('tbIntroSeen')) root.classList.add('skip-intro');
    else sessionStorage.setItem('tbIntroSeen', '1');
  } catch (e) { /* sessionStorage nicht verfügbar */ }
})();
