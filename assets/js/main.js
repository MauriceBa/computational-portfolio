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

  function translateDocument(doc, dict) {
    var nodes = doc.querySelectorAll("[data-i18n]");
    var written = 0;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var key = node.getAttribute("data-i18n");

      if (!dict || !Object.prototype.hasOwnProperty.call(dict, key)) {
        continue;
      }

      var attr = node.getAttribute("data-i18n-attr");

      if (attr) {
        node.setAttribute(attr, dict[key]);
      } else {
        node.textContent = dict[key];
      }

      written += 1;
    }

    return written;
  }

  function cardMatchesCategory(cardCategory, activeCategory) {
    return activeCategory === "all" || cardCategory === activeCategory;
  }

  var api = {
    STORAGE_KEYS: STORAGE_KEYS,
    resolveTheme: resolveTheme,
    buildMailtoUrl: buildMailtoUrl,
    translateDocument: translateDocument,
    cardMatchesCategory: cardMatchesCategory
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
