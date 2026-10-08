/* The airlift loop reactor band: bubbles rise through the riser, liquid
 * returns through the downcomer, particles ride the circulation.
 *
 * A separate deferred file so main.js keeps its size budget. It initialises
 * once the DOM is ready, then runs on canvas time: one still frame under
 * prefers-reduced-motion, paused while the band is off screen or the tab is
 * hidden, device pixel ratio capped at 2, and the palette read from the
 * page's custom properties so theme flips repaint the scene. */

(function () {
  "use strict";

  function initReactor() {
    var canvas = document.getElementById("reactor");
    if (!canvas || !canvas.getContext) { return; }
    var ctx = canvas.getContext("2d");
    if (!ctx) { return; }
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* Logical coordinate system; everything below is authored in these units. */
    var VW = 640, VH = 700;

    /* Vessel geometry (symmetric around CX). */
    var CX = 320;
    var WALL_L = 200, WALL_R = 440;      /* cylindrical walls            */
    var WALL_TOP = 100, WALL_BOTTOM = 560;
    var DOME_R = 120;                    /* hemispherical bottom         */
    var SURFACE_Y = 130;                 /* still liquid level           */
    var RISER_L = 280, RISER_R = 360;    /* riser tube walls             */
    var RISER_TOP = 165, RISER_BOTTOM = 610;
    var SPARGER_Y = 602;

    /* Palettes resolved from CSS custom properties on theme change. */
    var pal = {};
    function readPalette() {
      var cs = getComputedStyle(document.documentElement);
      pal.border = cs.getPropertyValue("--color-border").trim() || "#7d8896";
      pal.accent = cs.getPropertyValue("--color-accent").trim() || "#1d4ed8";
      pal.muted = cs.getPropertyValue("--color-muted").trim() || "#4b5563";
      pal.hairline = cs.getPropertyValue("--color-hairline").trim() || "#dde3ec";
    }

    /* Convert a hex colour to an rgba() string with the given alpha. */
    function fade(hex, a) {
      var m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
      if (!m) { return "rgba(0,0,0," + a + ")"; }
      var n = parseInt(m[1], 16);
      return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," +
        (n & 255) + "," + a + ")";
    }

    /* ------------------------------------------------------------------ *
     * Circulation paths
     *
     * One closed loop per downcomer side: up through the riser, over the
     * head, down the annulus, under the bottom and back into the riser.
     *
     * Speeds are coded per segment as v0/v1 (start/end): -1 means "riser
     * profile" (depends on the particle's lateral lane), any other value is
     * a constant. Turns interpolate between their neighbours so nobody
     * jumps between zones. The downcomer constant is the same value for
     * every particle.
     * ------------------------------------------------------------------ */

    var DOWN_V = 38;                       /* px/s, one speed for all    */

    function bez(p0, p1, p2, t) {
      var u = 1 - t;
      return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
      };
    }

    function buildPath(mirror) {
      var mx = function (x) { return mirror ? VW - x : x; };
      var P = function (x, y) { return { x: mx(x), y: y }; };

      /* the riser leg sits on the true centreline (320 mirrors to itself);
       * the bottom turn dips below the tube mouth (610) so particles
       * re-enter the riser from underneath */
      var segs = [
        { a: P(320, 645), c: null,        b: P(320, 160), steps: 64, v0: -1,     v1: -1     },
        { a: P(320, 160), c: P(320, 128), b: P(400, 178), steps: 26, v0: -1,     v1: DOWN_V },
        { a: P(400, 178), c: null,        b: P(400, 590), steps: 58, v0: DOWN_V, v1: DOWN_V },
        { a: P(400, 590), c: P(396, 648), b: P(330, 652), steps: 30, v0: DOWN_V, v1: -1     },
        { a: P(330, 652), c: P(316, 656), b: P(320, 645), steps: 10, v0: -1,     v1: -1     }
      ];

      var pts = [], mask = [], cum = [0], total = 0;

      segs.forEach(function (s) {
        for (var i = (pts.length ? 1 : 0); i <= s.steps; i++) {
          var t = i / s.steps;
          var p = s.c ? bez(s.a, s.c, s.b, t) : {
            x: s.a.x + (s.b.x - s.a.x) * t,
            y: s.a.y + (s.b.y - s.a.y) * t
          };
          if (pts.length) {
            var prev = pts[pts.length - 1];
            var d = Math.hypot(p.x - prev.x, p.y - prev.y);
            total += d;
            cum.push(total);
          }
          pts.push(p);
          mask.push({ v0: s.v0, v1: s.v1, tp: t });
        }
      });
      return { pts: pts, mask: mask, cum: cum, total: total };
    }

    var paths = [buildPath(false), buildPath(true)];

    /* ------------------------------------------------------------------ *
     * Actors
     * ------------------------------------------------------------------ */

    var RISER_HALF = 40;      /* riser and each annulus are 80 px wide    */
    var LANE_SD = 13;         /* sd of the horizontal (Gaussian) spread   */

    /* Box–Muller: one lane offset per particle, drawn once and kept for
     * the whole loop, so the cross-section reads as a normal distribution
     * in the downcomer as well as in the riser. */
    function gaussian(sd) {
      var u1 = Math.random() || 1e-9;
      var u2 = Math.random();
      return sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    var particles = [];
    function spawnParticle(pathIdx) {
      var path = paths[pathIdx];
      var r = 1.8 + Math.random() * 1.4;
      var lat = gaussian(LANE_SD);
      var latMax = RISER_HALF - r - 1;
      return {
        path: path,
        s: Math.random() * path.total,          /* arc length travelled  */
        lat: Math.max(Math.min(lat, latMax), -latMax),
        r: r,
        wob: Math.random() * Math.PI * 2,
        wobSpeed: 1.5 + Math.random() * 1.5
      };
    }
    for (var i = 0; i < 24; i++) {
      particles.push(spawnParticle(0));
      particles.push(spawnParticle(1));
    }

    function samplePath(path, s) {
      var cum = path.cum, lo = 0, hi = cum.length - 1;
      if (s <= 0) { return { i: 0, t: 0 }; }
      if (s >= cum[hi]) { return { i: hi - 1, t: 1 }; }
      while (lo + 1 < hi) {
        var mid = (lo + hi) >> 1;
        if (cum[mid] <= s) { lo = mid; } else { hi = mid; }
      }
      var span = cum[hi] - cum[lo];
      return { i: lo, t: span > 0 ? (s - cum[lo]) / span : 0 };
    }

    var bubbles = [];
    var spawnClock = 0;
    function spawnBubble() {
      var r = 2.4 + Math.pow(Math.random(), 1.7) * 4.2;
      bubbles.push({
        x: RISER_L + 10 + Math.random() * (RISER_R - RISER_L - 20),
        y: SPARGER_Y + 4,
        r: r,
        vy: 42 + r * 7,
        phase: Math.random() * Math.PI * 2,
        wob: 2 + Math.random() * 1.6
      });
    }

    var ripples = [];

    /* ------------------------------------------------------------------ *
     * Helpers
     * ------------------------------------------------------------------ */

    function surfaceY(x, t) {
      return SURFACE_Y +
        Math.sin(x * 0.035 + t * 1.3) * 2.6 +
        Math.sin(x * 0.014 - t * 0.7) * 1.6;
    }

    function vesselPath(t) {
      var p = new Path2D();
      p.moveTo(WALL_L, WALL_TOP + 14);
      p.quadraticCurveTo(WALL_L, WALL_TOP, WALL_L + 14, WALL_TOP);
      p.lineTo(WALL_R - 14, WALL_TOP);
      p.quadraticCurveTo(WALL_R, WALL_TOP, WALL_R, WALL_TOP + 14);
      p.lineTo(WALL_R, WALL_BOTTOM);
      p.arc(CX, WALL_BOTTOM, DOME_R, 0, Math.PI, false);
      p.lineTo(WALL_L, WALL_TOP + 14);
      return p;
    }

    /* Liquid body: wave on top, walls at the sides, dome at the bottom. */
    function liquidPath(t) {
      var p = new Path2D();
      p.moveTo(WALL_L, surfaceY(WALL_L, t));
      for (var x = WALL_L; x <= WALL_R; x += 8) {
        p.lineTo(x, surfaceY(x, t));
      }
      p.lineTo(WALL_R, WALL_BOTTOM);
      p.arc(CX, WALL_BOTTOM, DOME_R, 0, Math.PI, false);
      p.lineTo(WALL_L, surfaceY(WALL_L, t));
      return p;
    }

    /* ------------------------------------------------------------------ *
     * Simulation step
     *
     * Riser velocity profile: parabolic — fastest in the centre (where the
     * bubble plume drags the liquid), slowest against the wall. The
     * downcomer runs at one constant DOWN_V for every particle.
     * ------------------------------------------------------------------ */

    var UP_MAX = 105;                      /* px/s, centre of the riser   */
    var UP_MIN = 28;                       /* px/s, at the riser wall     */

    function riserProfile(pt) {
      var edge = Math.min(1, (pt.lat * pt.lat) / (RISER_HALF * RISER_HALF));
      return UP_MIN + (UP_MAX - UP_MIN) * (1 - edge);
    }

    function speedAtSample(pt, i) {
      var m = pt.path.mask[i];
      var v0 = m.v0 < 0 ? riserProfile(pt) : m.v0;
      var v1 = m.v1 < 0 ? riserProfile(pt) : m.v1;
      return v0 + (v1 - v0) * m.tp;
    }

    function step(dt, t) {
      /* particles */
      for (var i = 0; i < particles.length; i++) {
        var pt = particles[i];
        var sp = samplePath(pt.path, pt.s);
        var vA = speedAtSample(pt, sp.i);
        var vB = speedAtSample(pt, Math.min(sp.i + 1, pt.path.mask.length - 1));
        pt.s += (vA + (vB - vA) * sp.t) * dt;
        if (pt.s > pt.path.total) { pt.s -= pt.path.total; }
        pt.wob += pt.wobSpeed * dt;
      }

      /* bubbles */
      spawnClock += dt;
      if (spawnClock > 0.1) { spawnClock = 0; spawnBubble(); }
      for (var b = bubbles.length - 1; b >= 0; b--) {
        var bu = bubbles[b];
        bu.y -= bu.vy * dt;
        bu.r *= 1 + 0.07 * dt;                 /* expansion on the way up */
        var sx = surfaceY(bu.x, t);
        if (bu.y - bu.r <= sx) {
          ripples.push({ x: bu.x, y: sx, r: bu.r, age: 0 });
          bubbles.splice(b, 1);
        }
      }

      /* ripples */
      for (var k = ripples.length - 1; k >= 0; k--) {
        ripples[k].age += dt;
        if (ripples[k].age > 0.7) { ripples.splice(k, 1); }
      }

      /* population control */
      if (bubbles.length > 90) { bubbles.splice(0, bubbles.length - 90); }
    }

    /* ------------------------------------------------------------------ *
     * Drawing
     * ------------------------------------------------------------------ */

    function chevron(x, y, dir, alpha) {
      ctx.save();
      ctx.strokeStyle = fade(pal.muted, alpha);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 5 * dir);
      ctx.lineTo(x, y - 2 * dir);
      ctx.lineTo(x + 7, y + 5 * dir);
      ctx.stroke();
      ctx.restore();
    }

    function draw(t) {
      ctx.clearRect(0, 0, VW, VH);

      /* --- liquid ---------------------------------------------------- */
      var grad = ctx.createLinearGradient(0, SURFACE_Y, 0, WALL_BOTTOM + DOME_R);
      grad.addColorStop(0, fade(pal.accent, 0.07));
      grad.addColorStop(1, fade(pal.accent, 0.16));
      ctx.fillStyle = grad;
      ctx.fill(liquidPath(t));

      /* --- flow chevrons --------------------------------------------- */
      chevron(CX, 300, -1, 0.55);                 /* riser: up   */
      chevron(WALL_L + 40, 380, 1, 0.55);         /* downcomers: down */
      chevron(WALL_R - 40, 380, 1, 0.55);

      /* --- particles -------------------------------------------------- */
      ctx.fillStyle = fade(pal.accent, 0.85);
      for (var i = 0; i < particles.length; i++) {
        var pt = particles[i];
        var sp = samplePath(pt.path, pt.s);
        var a = pt.path.pts[sp.i];
        var b = pt.path.pts[Math.min(sp.i + 1, pt.path.pts.length - 1)];
        var x = a.x + (b.x - a.x) * sp.t;
        var y = a.y + (b.y - a.y) * sp.t;
        var jitter = Math.sin(pt.wob) * 1.1;
        x += pt.lat + jitter;
        ctx.beginPath();
        ctx.arc(x, y, pt.r, 0, Math.PI * 2);
        ctx.fill();
      }

      /* --- bubbles ---------------------------------------------------- */
      for (var j = 0; j < bubbles.length; j++) {
        var bu = bubbles[j];
        var wobble = Math.sin(t * bu.wob + bu.phase) * (2 + bu.r * 0.4);
        var bx = Math.min(Math.max(bu.x + wobble, RISER_L + bu.r + 3),
                          RISER_R - bu.r - 3);
        ctx.beginPath();
        ctx.arc(bx, bu.y, bu.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
        ctx.strokeStyle = fade(pal.accent, 0.6);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        /* highlight */
        ctx.beginPath();
        ctx.arc(bx - bu.r * 0.3, bu.y - bu.r * 0.35, Math.max(bu.r * 0.3, 1),
                0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fill();
      }

      /* --- ripples ---------------------------------------------------- */
      for (var k = 0; k < ripples.length; k++) {
        var rp = ripples[k];
        var p = rp.age / 0.7;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r + p * 26, Math.PI * 0.1, Math.PI * 0.9);
        ctx.strokeStyle = fade(pal.accent, 0.5 * (1 - p));
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* --- liquid surface line ---------------------------------------- */
      ctx.beginPath();
      ctx.moveTo(WALL_L, surfaceY(WALL_L, t));
      for (var x = WALL_L; x <= WALL_R; x += 6) {
        ctx.lineTo(x, surfaceY(x, t));
      }
      ctx.strokeStyle = fade(pal.accent, 0.75);
      ctx.lineWidth = 2;
      ctx.stroke();

      /* --- riser tube -------------------------------------------------- */
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(RISER_L, RISER_TOP);
      ctx.lineTo(RISER_L, RISER_BOTTOM);
      ctx.moveTo(RISER_R, RISER_TOP);
      ctx.lineTo(RISER_R, RISER_BOTTOM);
      ctx.stroke();

      /* --- sparger ------------------------------------------------------ */
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(RISER_L + 6, SPARGER_Y);
      ctx.lineTo(RISER_R - 6, SPARGER_Y);
      ctx.stroke();
      ctx.fillStyle = pal.border;
      for (var h = 0; h < 5; h++) {
        var hx = RISER_L + 18 + h * ((RISER_R - RISER_L - 36) / 4);
        ctx.beginPath();
        ctx.arc(hx, SPARGER_Y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      /* --- vessel outline ------------------------------------------------ */
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 2.5;
      ctx.stroke(vesselPath(t));

      /* top nozzle */
      ctx.beginPath();
      ctx.moveTo(CX - 16, WALL_TOP);
      ctx.lineTo(CX - 16, WALL_TOP - 20);
      ctx.moveTo(CX + 16, WALL_TOP);
      ctx.lineTo(CX + 16, WALL_TOP - 20);
      ctx.stroke();
      /* three pipe stubs above the head (as in the sketch) */
      ctx.lineWidth = 2;
      for (var n = -1; n <= 1; n++) {
        ctx.beginPath();
        ctx.moveTo(CX + n * 12, WALL_TOP - 20);
        ctx.lineTo(CX + n * 12, WALL_TOP - 34);
        ctx.stroke();
      }

      /* vessel drawn — no annotations, the motion tells the story */
    }

    /* ------------------------------------------------------------------ *
     * Loop control — DPR handling, pause off-screen, reduced motion
     * ------------------------------------------------------------------ */

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      var sx = canvas.width / VW, sy = canvas.height / VH;
      /* keep the aspect ratio identical to the CSS one, no distortion */
      var s = Math.min(sx, sy);
      ctx.setTransform(s, 0, 0, s, 0, (canvas.height - VH * s) / 2);
    }

    var running = false, visible = true, rafId = 0, last = 0, simT = 0;

    function frame(now) {
      rafId = requestAnimationFrame(frame);
      if (!last) { last = now; }
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!running || !visible) { return; }
      simT += dt;
      step(dt, simT);
      draw(simT);
    }

    function update() {
      var animate = !reduceMotion.matches;
      if (animate && !rafId) {
        last = 0;
        rafId = requestAnimationFrame(frame);
      } else if (!animate && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        draw(simT);
      }
      running = animate;
    }

    /* warm start so the very first frame already looks alive */
    for (var w = 0; w < 480; w++) { step(1 / 60, w / 60); simT = w / 60; }

    /* inView carries the observer's opinion alone; both guards funnel through
     * refreshVisibility so the animation also returns after a tab switch */
    var inView = true;
    function refreshVisibility() {
      visible = inView && !document.hidden;
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        refreshVisibility();
      }).observe(canvas);
    }
    document.addEventListener("visibilitychange", refreshVisibility);

    if (reduceMotion.addEventListener) {
      reduceMotion.addEventListener("change", update);
    }
    window.addEventListener("resize", function () {
      resize();
      if (!rafId) { draw(simT); }
    });

    /* repaint with the host palette when the page flips its theme */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        readPalette();
        draw(simT);
      }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
      });
    }

    readPalette();
    resize();
    update();
    draw(simT);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initReactor);
  }
}());
