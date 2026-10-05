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

  function formatFilterResult(template, count, total) {
    if (typeof template !== "string" || template === "") {
      return "";
    }

    return template
      .split("{count}").join(String(count))
      .split("{total}").join(String(total));
  }

  /* The filter-status template lives in the markup for German (Approach A: the
   * German text is the static source of truth, and there is deliberately no de
   * dictionary), so an active EN/FR dictionary is tried first and the markup's
   * own template is the fallback. Without this the live region reads empty in
   * German. */
  function pickFilterTemplate(activeDict, domTemplate) {
    var value = activeDict && activeDict["filter.result"];
    if (typeof value === "string" && value !== "") return value;
    if (typeof domTemplate === "string" && domTemplate !== "") return domTemplate;
    return "";
  }

  /* An open menu makes <main> and <footer> inert, and the only control that
   * clears that is #nav-toggle -- which is display:none above the breakpoint.
   * So crossing into the wide state while the menu is open would leave the whole
   * page inert and unclickable, with nothing on screen to explain it. */
  function shouldResetNav(isWide, navIsOpen) {
    return isWide && navIsOpen;
  }

  var api = {
    STORAGE_KEYS: STORAGE_KEYS,
    resolveTheme: resolveTheme,
    buildMailtoUrl: buildMailtoUrl,
    translateDocument: translateDocument,
    cardMatchesCategory: cardMatchesCategory,
    formatFilterResult: formatFilterResult,
    pickFilterTemplate: pickFilterTemplate,
    shouldResetNav: shouldResetNav
  };

  // --- module guard (Node tests) ---

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  // --- DOM wiring ---
  //
  // Every lookup is guarded. The two legal pages share this file but have no
  // language group, nav menu, filter, or form, so a missing element is normal
  // rather than exceptional.

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      var doc = document;
      var root = doc.documentElement;
      var dicts = (typeof window !== "undefined" && window.I18N) || {};
      var state = { lang: "de" };

      function readPref(key) {
        try {
          return window.localStorage.getItem(key);
        } catch (e) {
          return null;
        }
      }

      function writePref(key, value) {
        try {
          window.localStorage.setItem(key, value);
        } catch (e) {
          /* storage unavailable: the page still works, it just will not remember */
        }
      }

      function dict() {
        return dicts[state.lang] || {};
      }

      /* Snapshot the German strings before any translation runs. Switching back
       * to German restores from this snapshot, because by then every textContent
       * has already been overwritten with EN or FR.
       *
       * Snapshotted per element, not per translation key: some keys legitimately
       * appear on more than one element (hero.name is both the header brand and
       * the h1), and a key-keyed map would restore only the first match, leaving
       * the other showing stale foreign text. */
      var germanTextNodes = doc.querySelectorAll("[data-i18n]:not([data-i18n-attr])");
      var germanText = [];
      for (var gt = 0; gt < germanTextNodes.length; gt++) {
        germanText.push(germanTextNodes[gt].textContent);
      }

      var germanAttrNodes = doc.querySelectorAll("[data-i18n][data-i18n-attr]");
      var germanAttrs = [];
      for (var ga = 0; ga < germanAttrNodes.length; ga++) {
        var gaNode = germanAttrNodes[ga];
        germanAttrs.push(gaNode.getAttribute(gaNode.getAttribute("data-i18n-attr")));
      }

      function restoreGerman() {
        for (var t = 0; t < germanTextNodes.length; t++) {
          germanTextNodes[t].textContent = germanText[t];
        }
        for (var a = 0; a < germanAttrNodes.length; a++) {
          germanAttrNodes[a].setAttribute(
            germanAttrNodes[a].getAttribute("data-i18n-attr"),
            germanAttrs[a]
          );
        }
      }

      function setLanguage(lang) {
        if (["de", "en", "fr"].indexOf(lang) === -1) lang = "de";
        state.lang = lang;
        root.lang = lang;

        if (lang === "de") {
          restoreGerman();
        } else {
          translateDocument(doc, dicts[lang] || {});
        }

        var buttons = doc.querySelectorAll("[data-lang]");
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].setAttribute(
            "aria-pressed",
            buttons[i].getAttribute("data-lang") === lang ? "true" : "false"
          );
        }

        updateThemeLabel();
        applyFilter(activeFilter);
      }

      /* ------------------------- theme ------------------------- */

      var themeToggle = doc.getElementById("theme-toggle");

      function currentTheme() {
        var stored = readPref(STORAGE_KEYS.theme);
        var prefersDark = false;
        try {
          prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        } catch (e) {
          prefersDark = false;
        }
        return resolveTheme(stored, prefersDark);
      }

      function updateThemeLabel() {
        if (!themeToggle) return;
        var dark = root.dataset.theme === "dark";
        themeToggle.setAttribute("aria-pressed", dark ? "true" : "false");

        /* German for this label lives in the markup's own aria-label, since the
         * button holds SVG icons and must never receive a textContent write.
         * Only overwrite when the active dictionary actually has a translation. */
        var value = dict()[dark ? "theme.toLight" : "theme.toDark"];
        if (value) themeToggle.setAttribute("aria-label", value);
      }

      if (themeToggle) {
        root.dataset.theme = currentTheme();
        updateThemeLabel();

        themeToggle.addEventListener("click", function () {
          var next = root.dataset.theme === "dark" ? "light" : "dark";
          root.dataset.theme = next;
          writePref(STORAGE_KEYS.theme, next);
          updateThemeLabel();
        });
      }

      /* ----------------------- language ----------------------- */

      var langButtons = doc.querySelectorAll("[data-lang]");
      for (var lb = 0; lb < langButtons.length; lb++) {
        langButtons[lb].addEventListener("click", function (event) {
          setLanguage(event.currentTarget.getAttribute("data-lang"));
          writePref(STORAGE_KEYS.lang, state.lang);
        });
      }

      /* ------------------------ mobile nav ------------------------ */

      var navToggle = doc.getElementById("nav-toggle");
      var navMenu = doc.getElementById("nav-menu");
      var navOpen = false;

      function setNav(open) {
        navOpen = open;
        if (navToggle) navToggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (navMenu) navMenu.classList.toggle("is-open", open);
        if (navToggle) {
          /* Same rule as the theme toggle: German is in the markup, so only
           * overwrite the accessible name when a translation exists. */
          var navLabel = dict()[open ? "nav.close" : "nav.menu"];
          if (navLabel) navToggle.setAttribute("aria-label", navLabel);
        }
        /* Keep Tab from reaching the content behind an open menu. Only main and
         * footer go inert: the header's own controls stay reachable, which is
         * what lets the menu be closed with the keyboard. */
        ["main", "footer"].forEach(function (tag) {
          var el = doc.querySelector(tag);
          if (!el) return;
          if (open) el.setAttribute("inert", "");
          else el.removeAttribute("inert");
        });
      }

      if (navToggle && navMenu) {
        navToggle.addEventListener("click", function () {
          setNav(!navOpen);
        });

        doc.addEventListener("keydown", function (event) {
          if (event.key === "Escape" && navOpen) {
            setNav(false);
            navToggle.focus();
          }
        });

        /* Reset when the viewport crosses into the wide state, so rotating a
         * phone or dragging a window wider cannot strand <main> as inert. */
        var wide = null;
        try {
          wide = window.matchMedia("(min-width: 54rem)");
        } catch (e) {
          wide = null;
        }

        if (wide) {
          var onBreakpoint = function (event) {
            if (shouldResetNav(event.matches, navOpen)) {
              setNav(false);
            }
          };
          if (typeof wide.addEventListener === "function") {
            wide.addEventListener("change", onBreakpoint);
          } else if (typeof wide.addListener === "function") {
            wide.addListener(onBreakpoint);
          }
        }
      }

      /* ------------------- anchor focus management ------------------- */

      /* Delegated from the document, not the nav list: the hero's two primary
       * CTAs are in-page anchors too, and they are the most prominent links on
       * the page. Leaving them out strands focus thousands of pixels above the
       * target after Enter or Space. */
      doc.addEventListener("click", function (event) {
        var origin = event.target;
        var link = origin && origin.closest ? origin.closest("a[href^='#']") : null;
        if (!link) return;

        var target = doc.getElementById(link.getAttribute("href").slice(1));
        if (!target) return;

        event.preventDefault();
        if (navOpen) setNav(false);
        target.setAttribute("tabindex", "-1");
        target.scrollIntoView();
        target.focus({ preventScroll: true });
      });

      /* ------------------------ scroll spy ------------------------ */

      var sections = doc.querySelectorAll("main section[id]");
      var navLinks = navMenu ? navMenu.querySelectorAll("a[href^='#']") : [];

      function markCurrent(id) {
        for (var i = 0; i < navLinks.length; i++) {
          if (navLinks[i].getAttribute("href") === "#" + id) {
            navLinks[i].setAttribute("aria-current", "true");
          } else {
            navLinks[i].removeAttribute("aria-current");
          }
        }
      }

      if (sections.length && navLinks.length && typeof IntersectionObserver !== "undefined") {
        var visible = {};

        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            visible[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
          });

          var best = null;
          var bestRatio = 0;
          sections.forEach(function (section) {
            var ratio = visible[section.id] || 0;
            if (ratio > bestRatio) {
              bestRatio = ratio;
              best = section;
            }
          });

          if (best) markCurrent(best.id);
        }, {
          rootMargin: "-45% 0px -45% 0px",
          threshold: [0, 0.25, 0.5, 0.75, 1]
        });

        sections.forEach(function (section) {
          observer.observe(section);
        });
      }

      /* ------------------------ project filter ------------------------ */

      var filterButtons = doc.querySelectorAll("[data-filter]");
      var cards = doc.querySelectorAll("#project-grid [data-category]");
      var filterStatus = doc.getElementById("filter-status");
      var filterEmpty = doc.getElementById("filter-empty");
      var activeFilter = "all";

      function applyFilter(category) {
        if (!filterButtons.length) return;
        activeFilter = category;

        var visibleCount = 0;
        for (var i = 0; i < cards.length; i++) {
          var card = cards[i];
          var match = cardMatchesCategory(card.getAttribute("data-category"), category);
          if (match) {
            card.removeAttribute("hidden");
            visibleCount += 1;
          } else {
            card.setAttribute("hidden", "");
          }
        }

        for (var b = 0; b < filterButtons.length; b++) {
          filterButtons[b].setAttribute(
            "aria-pressed",
            filterButtons[b].getAttribute("data-filter") === category ? "true" : "false"
          );
        }

        if (filterStatus) {
          filterStatus.textContent = formatFilterResult(
            pickFilterTemplate(dict(), filterStatus.getAttribute("data-count-template")),
            visibleCount,
            cards.length
          );
        }

        if (filterEmpty) {
          if (visibleCount === 0) filterEmpty.removeAttribute("hidden");
          else filterEmpty.setAttribute("hidden", "");
        }
      }

      for (var fb = 0; fb < filterButtons.length; fb++) {
        filterButtons[fb].addEventListener("click", function (event) {
          applyFilter(event.currentTarget.getAttribute("data-filter"));
        });
      }

      /* Runs on boot too, so the live region never shows a raw {count} template. */
      applyFilter("all");

      /* ------------------------ contact form ------------------------ */



      var form = doc.getElementById("contact-form");
      var contactStatus = doc.getElementById("contact-status");

      if (form) {
        form.addEventListener("submit", function (event) {
          event.preventDefault();

          if (!form.reportValidity()) {
            if (contactStatus) {
              contactStatus.textContent = dict()["contact.status"] || "Please fill in all fields.";
            }
            return;
          }

          var name = (form.elements.name && form.elements.name.value) || "";
          var subject = (form.elements.subject && form.elements.subject.value) || "";
          var message = (form.elements.message && form.elements.message.value) || "";
          var body = [name, subject, "", message].join("\n");

          window.location.href = buildMailtoUrl("[name@example.com]", {
            subject: subject,
            body: body
          });
        });
      }

      /* ------------------------ header shadow ------------------------ */

      var header = doc.getElementById("site-header");
      if (header) {
        var onScroll = function () {
          header.classList.toggle("is-scrolled", window.scrollY > 8);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });

        /* --header-h is a design guess, and the header wraps to two or three
         * rows on narrow phones -- which made it taller than the sections'
         * scroll-margin-top and hid the top of each heading when jumping to an
         * anchor. Measure it into a SEPARATE property, --header-offset: feeding
         * it back into --header-h would ratchet the header taller forever,
         * because .site-header__inner's min-height uses that token. */
        var syncHeaderOffset = function () {
          var height = Math.ceil(header.getBoundingClientRect().height);
          if (height > 0) {
            root.style.setProperty("--header-offset", height + 16 + "px");
          }
        };

        syncHeaderOffset();
        window.addEventListener("resize", syncHeaderOffset);

        if (typeof ResizeObserver !== "undefined") {
          new ResizeObserver(syncHeaderOffset).observe(header);
        }
      }

      /* --------------------------- boot --------------------------- */
      //
      // Last, so every element and function the language and filter paths touch
      // already exists. Calling setLanguage earlier would run applyFilter with an
      // uninitialised activeFilter and hide every card.

      var storedLang = readPref(STORAGE_KEYS.lang);
      setLanguage(["de", "en", "fr"].indexOf(storedLang) === -1 ? "de" : storedLang);
      applyFilter(activeFilter);
    });
  }
})();
