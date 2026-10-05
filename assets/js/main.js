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

  /* An open menu makes <main> and <footer> inert, and the only control that
   * clears that is #nav-toggle -- which is display:none above the breakpoint.
   * So crossing into the wide state while the menu is open would leave the whole
   * page inert and unclickable, with nothing on screen to explain it. */
  function shouldResetNav(isWide, navIsOpen) {
    return isWide && navIsOpen;
  }

  /* One CV per language. A single hard-coded href hands every visitor the German
   file regardless of which language they are reading in. */
  var CV_FILENAMES = {
    de: "CV_DE_Maurice_Bastard.pdf",
    en: "CV_EN_Maurice_Bastard.pdf",
    fr: "CV_FR_Maurice_Bastard.pdf"
  };

  function cvFilename(lang) {
    return Object.prototype.hasOwnProperty.call(CV_FILENAMES, lang)
      ? CV_FILENAMES[lang]
      : CV_FILENAMES.de;
  }

  function cvPath(lang) {
    return "assets/pdf/" + cvFilename(lang);
  }

  function cvDownloadName(lang) {
    return cvFilename(lang);
  }

  var api = {
    STORAGE_KEYS: STORAGE_KEYS,
    resolveTheme: resolveTheme,
    buildMailtoUrl: buildMailtoUrl,
    translateDocument: translateDocument,
    shouldResetNav: shouldResetNav,
    cvPath: cvPath,
    cvDownloadName: cvDownloadName
  };

  // --- module guard (Node tests) ---

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  // --- DOM wiring ---
  //
  // Every lookup is guarded. The two legal pages share this file but have no
  // language group, nav menu, or form, so a missing element is normal
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
        updateCvLink();
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

      /* ------------------- language-versioned CV ------------------- */

      var cvLink = doc.getElementById("cv-download");

      function updateCvLink() {
        if (!cvLink) return;
        cvLink.setAttribute("href", cvPath(state.lang));
        cvLink.setAttribute("download", cvDownloadName(state.lang));
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

          window.location.href = buildMailtoUrl("contact@mauricebastard.de", {
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

      /* ------------------------ hero flow field ------------------------ */

      /* Potential flow past two fixed cylinders, with the pointer acting as a
       * third obstacle the streamlines bend around. This is the page's one
       * authored motion moment, so it gets the care: every buffer is allocated
       * in setup() (never in the frame loop), the loop stops while the hero is
       * off screen or the tab is hidden, and under prefers-reduced-motion the
       * field is warmed up once and drawn as a still image. */
      function initHeroField() {
        var canvas = doc.querySelector(".hero__mesh");
        var hero = doc.getElementById("hero");
        if (!canvas || !hero || !canvas.getContext) return;

        var ctx = canvas.getContext("2d");
        if (!ctx) return;

        var TRAIL = 14;
        var BASE_SPEED = 54; /* px/s, rightwards */
        var reducedMotion = window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        var width = 1, height = 1;
        var count = 0, head = 0;
        var pos = null; /* Float32Array(count * TRAIL * 2) */
        var obstacles = [];
        var pointer = { x: -9999, y: -9999, on: false };
        var accent = "#1d4ed8";
        var lastTheme = null;
        var rafId = 0, lastTime = 0, running = false;
        var onScreen = true, pageVisible = !doc.hidden;
        var resizePending = false;

        function readAccent() {
          var value = window.getComputedStyle(doc.documentElement)
            .getPropertyValue("--color-accent");
          return (value || "").trim() || "#1d4ed8";
        }

        function setup() {
          var rect = hero.getBoundingClientRect();
          width = Math.max(1, Math.round(rect.width));
          height = Math.max(1, Math.round(rect.height));
          var dpr = Math.min(window.devicePixelRatio || 1, 2);

          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          /* Placed as fractions of the box so the composition holds at any
           * viewport size instead of drifting off canvas. */
          obstacles = [
            { x: width * 0.27, y: height * 0.42, r: Math.max(46, height * 0.11) },
            { x: width * 0.68, y: height * 0.66, r: Math.max(34, height * 0.08) }
          ];

          count = Math.max(180, Math.min(660, Math.round((width * height) / 2733)));
          pos = new Float32Array(count * TRAIL * 2);
          head = 0;

          for (var i = 0; i < count; i++) {
            var x = Math.random() * width;
            var y = Math.random() * height;
            for (var t = 0; t < TRAIL; t++) {
              pos[(i * TRAIL + t) * 2] = x;
              pos[(i * TRAIL + t) * 2 + 1] = y;
            }
          }

          accent = readAccent();
          lastTheme = doc.documentElement.getAttribute("data-theme");
        }

        /* Perturbation of the free stream by one cylinder (a doublet). Inside
         * the cylinder the analytic form divides by ~0, so particles get a
         * radial escape velocity instead of exploding. Writes into a shared
         * scratch object: the frame loop allocates nothing. */
        var flowOut = { u: 0, v: 0 };

        function applyObstacle(x, y, ox, oy, radius, flow) {
          var dx = x - ox, dy = y - oy;
          var r2 = dx * dx + dy * dy;
          var rMax = radius * radius;

          if (r2 < rMax) {
            var dist = Math.sqrt(r2) || 1;
            flowOut.u = (dx / dist) * 90;
            flowOut.v = (dy / dist) * 90;
            return flowOut;
          }

          var k = (flow * rMax) / (r2 * r2);
          flowOut.u = -k * (dx * dx - dy * dy);
          flowOut.v = -k * 2 * dx * dy;
          return flowOut;
        }

        function step(dt) {
          head = (head + 1) % TRAIL;

          for (var i = 0; i < count; i++) {
            var prev = (i * TRAIL + (head + TRAIL - 1) % TRAIL) * 2;
            var x = pos[prev], y = pos[prev + 1];
            var u = BASE_SPEED, v = 0;
            var o, add;

            for (o = 0; o < obstacles.length; o++) {
              add = applyObstacle(x, y, obstacles[o].x, obstacles[o].y, obstacles[o].r, BASE_SPEED);
              u += add.u; v += add.v;
            }

            if (pointer.on) {
              add = applyObstacle(x, y, pointer.x, pointer.y, 58, BASE_SPEED);
              u += add.u; v += add.v;
            }

            if (x > width + 16 || y < -24 || y > height + 24) {
              x = -8; y = Math.random() * height;
              for (var t = 0; t < TRAIL; t++) {
                pos[(i * TRAIL + t) * 2] = x;
                pos[(i * TRAIL + t) * 2 + 1] = y;
              }
            }

            var idx = (i * TRAIL + head) * 2;
            pos[idx] = x + u * dt;
            pos[idx + 1] = y + v * dt;
          }
        }

        function draw() {
          ctx.clearRect(0, 0, width, height);
          ctx.lineWidth = 1;
          ctx.lineCap = "round";
          ctx.strokeStyle = accent;

          for (var i = 0; i < count; i++) {
            ctx.beginPath();
            for (var t = 0; t < TRAIL; t++) {
              var k = (i * TRAIL + (head + 1 + t) % TRAIL) * 2;
              if (t === 0) ctx.moveTo(pos[k], pos[k + 1]);
              else ctx.lineTo(pos[k], pos[k + 1]);
            }
            ctx.globalAlpha = 0.13;
            ctx.stroke();

            ctx.beginPath();
            var started = false;
            for (var s = TRAIL - 5; s < TRAIL; s++) {
              var j = (i * TRAIL + (head + 1 + s) % TRAIL) * 2;
              if (!started) { ctx.moveTo(pos[j], pos[j + 1]); started = true; }
              else ctx.lineTo(pos[j], pos[j + 1]);
            }
            ctx.globalAlpha = 0.5;
            ctx.stroke();
          }

          ctx.globalAlpha = 1;
        }

        function warmToStill() {
          for (var i = 0; i < 260; i++) step(1 / 60);
          draw();
        }

        function frameLoop(time) {
          rafId = 0;
          if (!running) return;

          var dt = lastTime ? Math.min((time - lastTime) / 1000, 1 / 30) : 1 / 60;
          lastTime = time;

          var theme = doc.documentElement.getAttribute("data-theme");
          if (theme !== lastTheme) {
            lastTheme = theme;
            accent = readAccent();
          }

          step(dt);
          draw();
          rafId = window.requestAnimationFrame(frameLoop);
        }

        function evaluate() {
          var shouldRun = onScreen && pageVisible && !reducedMotion;

          if (shouldRun && !running) {
            running = true;
            lastTime = 0;
            rafId = window.requestAnimationFrame(frameLoop);
          } else if (!shouldRun && running) {
            running = false;
            if (rafId) window.cancelAnimationFrame(rafId);
            rafId = 0;
          }
        }

        function onResize() {
          if (resizePending) return;
          resizePending = true;
          window.requestAnimationFrame(function () {
            resizePending = false;
            setup();
            if (reducedMotion) warmToStill();
          });
        }

        setup();

        if (reducedMotion) {
          warmToStill();
          return;
        }

        if (typeof ResizeObserver !== "undefined") {
          new ResizeObserver(onResize).observe(hero);
        } else {
          window.addEventListener("resize", onResize);
        }

        if (typeof IntersectionObserver !== "undefined") {
          new IntersectionObserver(function (entries) {
            onScreen = entries[0].isIntersecting;
            evaluate();
          }).observe(hero);
        }

        doc.addEventListener("visibilitychange", function () {
          pageVisible = !doc.hidden;
          evaluate();
        });

        hero.addEventListener("pointermove", function (event) {
          var rect = canvas.getBoundingClientRect();
          pointer.x = event.clientX - rect.left;
          pointer.y = event.clientY - rect.top;
          pointer.on = true;
        }, { passive: true });

        hero.addEventListener("pointerleave", function () {
          pointer.on = false;
        }, { passive: true });

        evaluate();
      }

      /* ------------------------ card reveal ------------------------ */

      function initProjectReveal() {
        if (typeof IntersectionObserver === "undefined") return;
        if (window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        var cards = doc.querySelectorAll(".project");
        if (!cards.length) return;

        /* The class that hides the cards is added here, in the same tick that
         * the observer revealing them is registered -- so a script that never
         * runs leaves the cards visible, which is the only safe default. */
        doc.documentElement.classList.add("reveal");

        for (var i = 0; i < cards.length; i++) {
          cards[i].style.setProperty("--reveal-delay", Math.min(i, 5) * 60 + "ms");
        }

        var observer = new IntersectionObserver(function (entries) {
          for (var j = 0; j < entries.length; j++) {
            if (entries[j].isIntersecting) {
              entries[j].target.classList.add("is-revealed");
              observer.unobserve(entries[j].target);
            }
          }
        }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

        for (var k = 0; k < cards.length; k++) observer.observe(cards[k]);
      }

      /* -------------------------- card glow --------------------------- */

      function initCardGlow() {
        var cards = doc.querySelectorAll(".card");

        for (var i = 0; i < cards.length; i++) {
          (function (card) {
            card.addEventListener("pointermove", function (event) {
              var rect = card.getBoundingClientRect();
              card.style.setProperty("--glow-x", event.clientX - rect.left + "px");
              card.style.setProperty("--glow-y", event.clientY - rect.top + "px");
            }, { passive: true });

            card.addEventListener("pointerleave", function () {
              card.style.removeProperty("--glow-x");
              card.style.removeProperty("--glow-y");
            }, { passive: true });
          })(cards[i]);
        }
      }

      /* --------------------------- lightbox --------------------------- */

      /* Every project image is a button, so the enlarged view is reachable by
       * keyboard as well as by pointer. The dialog takes focus on open, keeps
       * Tab inside itself, closes on Escape, the backdrop and its own button,
       * and hands focus back to the card that opened it. */
      function initLightbox() {
        var box = doc.getElementById("lightbox");
        var image = doc.getElementById("lightbox-image");
        var caption = doc.getElementById("lightbox-caption");
        if (!box || !image) return;

        var lastFocus = null;
        var rootOverflow = "";
        var bodyOverflow = "";

        function open(trigger) {
          var img = trigger.querySelector ? trigger.querySelector("img") : null;
          if (!img) return;

          var card = trigger.closest ? trigger.closest(".project") : null;
          var heading = card ? card.querySelector("h3") : null;
          var title = heading ? heading.textContent : "";

          image.src = img.currentSrc || img.src;
          image.alt = title;
          if (caption) caption.textContent = title;

          lastFocus = doc.activeElement;
          /* The viewport takes its overflow from the root element, so locking
           * only <body> leaves the page scrollable behind the dialog. */
          rootOverflow = doc.documentElement.style.overflow;
          bodyOverflow = doc.body.style.overflow;
          doc.documentElement.style.overflow = "hidden";
          doc.body.style.overflow = "hidden";
          box.hidden = false;

          var closeBtn = doc.getElementById("lightbox-close");
          if (closeBtn) closeBtn.focus();
        }

        function close() {
          if (box.hidden) return;
          box.hidden = true;
          doc.documentElement.style.overflow = rootOverflow;
          doc.body.style.overflow = bodyOverflow;
          if (lastFocus && lastFocus.focus) lastFocus.focus();
          lastFocus = null;
        }

        doc.addEventListener("click", function (event) {
          var target = event.target;
          if (!target || !target.closest) return;

          var trigger = target.closest(".project__zoom");
          if (trigger) {
            open(trigger);
            return;
          }

          if (target.closest("[data-lightbox-dismiss]") ||
              target.id === "lightbox-close") {
            close();
          }
        });

        doc.addEventListener("keydown", function (event) {
          if (box.hidden) return;

          if (event.key === "Escape" || event.key === "Esc") {
            close();
            return;
          }

          if (event.key === "Tab") {
            var closeBtn = doc.getElementById("lightbox-close");
            if (closeBtn) {
              event.preventDefault();
              closeBtn.focus();
            }
          }
        });
      }

      /* --------------------------- boot --------------------------- */
      //
      // Last, so every element the language path touches already exists.

      initHeroField();
      initProjectReveal();
      initCardGlow();
      initLightbox();

      var storedLang = readPref(STORAGE_KEYS.lang);
      setLanguage(["de", "en", "fr"].indexOf(storedLang) === -1 ? "de" : storedLang);
    });
  }
})();
