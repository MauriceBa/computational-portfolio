(function () {
  "use strict";

  // --- pure logic (unit-tested) -------------------------------------------

  var STORAGE_KEYS = {
    theme: "portfolio-theme",
    lang: "portfolio-lang"
  };

  function resolveTheme(storedValue, prefersDark) {
    var stored = typeof storedValue === "string" ? storedValue.trim().toLowerCase() : "";

    if (stored === "dark") return "dark";
    if (stored === "light") return "light";

    return prefersDark ? "dark" : "light";
  }

  var api = {
    STORAGE_KEYS: STORAGE_KEYS,
    resolveTheme: resolveTheme
  };

  // --- module guard (Node tests) ---

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  // --- DOM wiring ---

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      // filled in by later tasks
    });
  }
})();
