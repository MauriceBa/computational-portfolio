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

  function buildMailtoUrl(email, fields) {
    var subject = fields && typeof fields.subject === "string" ? fields.subject : "";
    var body = fields && typeof fields.body === "string" ? fields.body : "";

    if (subject === "" && body === "") {
      return "mailto:" + email;
    }

    return (
      "mailto:" + email +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body)
    );
  }

  var api = {
    STORAGE_KEYS: STORAGE_KEYS,
    resolveTheme: resolveTheme,
    buildMailtoUrl: buildMailtoUrl
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
