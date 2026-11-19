/* Delight layer: scroll reveals, card glow, floating decorations, click
   sparkles and a scroll progress ribbon. Runs on every page (and again after
   every instant page swap), never touches text, and stays off in edit mode. */
(function () {
  "use strict";
  var body = document.body;
  if (!body || body.__dl) return;
  body.__dl = true;
  if (window.__SITE_EDIT__) return;

  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  root.classList.add("dl-on");

  /* ---------- helpers ---------- */
  var seed = 7;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  function cs(el) { return getComputedStyle(el); }
  function lum(color) {
    var m = color && color.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    if (m.length > 3 && parseFloat(m[3]) === 0) return null;
    return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
  }
  function ensurePositioned(el) {
    if (cs(el).position === "static") el.style.position = "relative";
  }
  var SKIP = ".sticky-top, .navbar, .lx, .ah, .owl-carousel, .dl-deco, .dl-glow, .modal, script, style, iframe[src*='instagram']";

  /* ---------- shapes ---------- */
  function svg(path) { return '<svg viewBox="0 0 24 24"><path d="' + path + '"/></svg>'; }
  var TOOTH = "M12 3.2c-1.7 0-2.6.8-4.3.8S5.2 2.6 3.7 4.3C2 6.3 2.6 9.6 3.8 12c.9 1.8 1.2 4.3 1.7 6.8.3 1.6.9 2.7 1.9 2.7 1.2 0 1.6-1.6 2-3.8.3-1.7.9-3 2.6-3s2.3 1.3 2.6 3c.4 2.2.8 3.8 2 3.8 1 0 1.6-1.1 1.9-2.7.5-2.5.8-5 1.7-6.8 1.2-2.4 1.8-5.7.1-7.7-1.5-1.7-2.3-.3-4-.3s-2.6-.8-4.3-.8z";
  var SPARK = "M12 1c.9 6.2 3.8 9.1 11 11-7.2 1.9-10.1 4.8-11 11-.9-6.2-3.8-9.1-11-11 7.2-1.9 10.1-4.8 11-11z";
  var HEART = "M12 21s-7.6-4.6-10-9.4C.4 8.3 2.5 4 6.5 4c2.3 0 3.9 1.3 5.5 3.3C13.6 5.3 15.2 4 17.5 4c4 0 6.1 4.3 4.5 7.6C19.6 16.4 12 21 12 21z";
  var SHAPES = [
    ["dl-tooth", svg(TOOTH)],
    ["dl-sparkle", svg(SPARK)],
    ["dl-ring", ""],
    ["dl-heart", svg(HEART)],
    ["dl-sparkle", svg(SPARK)],
    ["dl-tooth", svg(TOOTH)],
    ["dl-ring", ""]
  ];

  /* ---------- scroll progress ---------- */
  var bar = document.createElement("div");
  bar.className = "dl-progress";
  bar.setAttribute("aria-hidden", "true");
  body.appendChild(bar);

  if (reduce) return; // static polish only

  /* ---------- sections ---------- */
  var sections = Array.prototype.filter.call(body.children, function (el) {
    if (!/^(SECTION|DIV|FOOTER)$/.test(el.tagName)) return false;
    if (el.matches(".sticky-top, .back-to-top, .dl-progress, .modal")) return false;
    return el.offsetHeight > 160;
  });

  var pending = [];
  var vh = innerHeight;

  function hide(el, kind, delay) {
    if (el.classList.contains("dl-hide") || el.closest(".dl-hide")) return;
    var r = el.getBoundingClientRect();
    if (r.top < vh * 0.9 && r.bottom > 0) return; // already on screen: leave it be
    if (cs(el).animationName !== "none") return;  // has its own entrance
    el.classList.add("dl-hide", "dl-reveal");
    if (kind) el.classList.add(kind);
    if (delay) el.style.setProperty("--dl-d", delay + "ms");
    pending.push(el);
  }

  function isVisualCard(el) {
    var s = cs(el);
    var bg = lum(s.backgroundColor);
    return bg !== null || s.backgroundImage !== "none" || parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== "none";
  }

  function unwrap(el) {
    // Grid columns usually wrap the real card: descend to it.
    while (el.children.length === 1) {
      var c = el.children[0];
      if (Math.abs(c.offsetWidth - el.offsetWidth) > 40 || c.offsetHeight < el.offsetHeight * 0.7) break;
      el = c;
    }
    return el;
  }

  function makeCard(card, i) {
    if (card.classList.contains("dl-card")) return;
    card.classList.add("dl-card");
    ensurePositioned(card);
    var glow = document.createElement("span");
    glow.className = "dl-glow";
    glow.setAttribute("aria-hidden", "true");
    card.appendChild(glow);
    var l = lum(cs(card).backgroundColor);
    if (l !== null && l > 0.6) card.classList.add("dl-light");
    // icon bubbles bob gently
    var icon = card.querySelector("[class*='icon']:not(i):not(svg):not(img), .btn-square, .tc-avatar");
    if (!icon) icon = card.querySelector("i.fa, i.fas, i.far, i.fab, i.bi");
    if (icon && !icon.closest(".btn")) {
      icon.classList.add("dl-icon");
      icon.style.setProperty("--dl-i", (i % 5) * -0.6 + "s");
    }
    card.querySelectorAll("img").forEach(function (img) {
      var p = img.parentElement;
      if (p && p !== card && cs(p).overflow === "hidden") img.classList.add("dl-zoom");
      else if (p === card && cs(card).overflow === "hidden") img.classList.add("dl-zoom");
    });
  }

  sections.forEach(function (section, sIndex) {
    if (section.matches(".lx, .ah")) return;

    // 1) groups of similar boxes -> staggered cards
    section.querySelectorAll("*").forEach(function (el) {
      if (el.closest(SKIP) || el.closest(".dl-card")) return;
      var kids = el.children;
      if (kids.length < 2) return;
      var sig = {};
      var max = 0;
      for (var k = 0; k < kids.length; k++) {
        var key = kids[k].tagName + "." + (kids[k].classList[0] || "");
        sig[key] = (sig[key] || 0) + 1;
        if (sig[key] > max) max = sig[key];
      }
      if (max < 2 || max / kids.length < 0.6) return;
      var ok = 0;
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].offsetWidth >= 150 && kids[j].offsetHeight >= 70 && !/^(P|H\d|SPAN|A|LI|I|IMG|BR)$/.test(kids[j].tagName)) ok++;
      }
      if (ok < 2 || ok / kids.length < 0.6) return;
      var visual = 0;
      var cards = [];
      for (var n = 0; n < kids.length; n++) {
        var c = unwrap(kids[n]);
        cards.push(c);
        if (isVisualCard(c)) visual++;
      }
      cards.forEach(function (c, idx) {
        var isCard = visual >= 2 && isVisualCard(c) && !c.closest(".reels-track, [class*='reel'] .owl-stage");
        if (isCard) makeCard(c, idx);
        hide(kids[idx], isCard ? "dl-pop" : null, (idx % 6) * 110);
      });
    });

    // 2) headings
    section.querySelectorAll("h1, h2").forEach(function (h) {
      if (h.closest(SKIP) || h.closest(".dl-card, .dl-hide")) return;
      hide(h, "dl-title", 0);
    });
    // 3) supporting text, buttons, media
    section.querySelectorAll("h3, h4, h5, h6, p, .btn, ul, img, iframe, video, .before-after-wrapper, form").forEach(function (el) {
      if (el.closest(SKIP) || el.closest(".dl-card, .dl-hide")) return;
      if (el.tagName === "IMG" || el.tagName === "IFRAME" || el.tagName === "VIDEO") hide(el, "dl-pop", 120);
      else hide(el, null, el.tagName === "P" ? 120 : el.classList.contains("btn") ? 220 : 60);
    });

    // 4) floating decorations
    var host = (section.matches(".ft") && section.querySelector(".ft-tile")) || section;
    var dark = (function () {
      var l = lum(cs(host).color);
      return l !== null && l > 0.6;
    })();
    var deco = document.createElement("div");
    deco.className = "dl-deco" + (dark ? " dl-dark" : "");
    deco.setAttribute("aria-hidden", "true");
    var count = 6;
    for (var d = 0; d < count; d++) {
      var shape = SHAPES[(d + sIndex) % SHAPES.length];
      var s = document.createElement("span");
      s.className = shape[0];
      s.innerHTML = shape[1];
      var left = d % 2 === 0 ? 1 + rand() * 3.5 : 95.5 - rand() * 3.5;
      s.style.left = left + "%";
      s.style.top = (8 + (d / count) * 80 + rand() * 6) + "%";
      s.style.setProperty("--s", Math.round(14 + rand() * 20) + "px");
      s.style.setProperty("--t", (7 + rand() * 6).toFixed(1) + "s");
      s.style.setProperty("--dl-i", (-rand() * 8).toFixed(1) + "s");
      deco.appendChild(s);
    }
    ensurePositioned(host);
    host.insertBefore(deco, host.firstChild);
  });

  /* ---------- shimmering accent words ---------- */
  document.querySelectorAll("h1 span, h2 span, h1 em, h2 em, h3 em").forEach(function (sp) {
    if (sp.closest(".lx, .ah, .navbar, .dl-deco") || sp.children.length) return;
    var styled = sp.classList.contains("text-primary") || cs(sp).fontStyle === "italic" || sp.tagName === "EM";
    if (!styled) return;
    var h = sp.parentElement;
    var l = lum(cs(h).color);
    sp.classList.add("dl-shimmer");
    if (l !== null && l > 0.6) sp.classList.add("dl-on-dark");
  });

  /* ---------- stray cards outside groups (review cards, tiles …) ---------- */
  document.querySelectorAll(".testimonial-card, .qual-card, .membership-card, .cred-custom-card, .appt-tile, .reel-card").forEach(function (c, i) {
    makeCard(c, i);
  });

  /* ---------- buttons: gloss ---------- */
  document.querySelectorAll(".btn-primary, .btn-secondary, .btn-dark, .btn-outline-primary").forEach(function (b, i) {
    if (b.classList.contains("back-to-top") || b.querySelector(".dl-gloss")) return;
    var pos = cs(b).position;
    if (pos === "fixed" || pos === "sticky") return;
    if (pos === "static") b.style.position = "relative";
    b.classList.add("dl-btn");
    var g = document.createElement("span");
    g.className = "dl-gloss";
    g.setAttribute("aria-hidden", "true");
    g.style.setProperty("--dl-i", (i % 4) * 1.2 + "s");
    b.appendChild(g);
  });

  /* ---------- reveal loop ---------- */
  var ticking = false;
  function check() {
    ticking = false;
    vh = innerHeight;
    var h = root.scrollHeight - vh;
    bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, scrollY / h) : 0) + ")";
    // at the very bottom of the page nothing can scroll further up, so show everything on screen
    var limit = scrollY >= h - 4 ? vh + 60 : vh * 0.92;
    for (var i = pending.length - 1; i >= 0; i--) {
      var el = pending[i];
      var r = el.getBoundingClientRect();
      if (r.top < limit && r.bottom > -40) {
        pending.splice(i, 1);
        reveal(el);
      }
    }
  }
  function reveal(el) {
    el.classList.add("dl-in");
    setTimeout(function () {
      el.classList.remove("dl-hide", "dl-in", "dl-reveal", "dl-pop", "dl-title", "dl-side");
      el.style.removeProperty("--dl-d");
    }, 1300 + (parseInt(el.style.getPropertyValue("--dl-d"), 10) || 0));
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(check); }
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  addEventListener("load", onScroll);
  requestAnimationFrame(function () { requestAnimationFrame(check); });
  // Safety: anything still hidden after a long wait near the top is shown.
  setTimeout(check, 1500);

  /* ---------- card spotlight follows the pointer ---------- */
  if (fine) {
    document.addEventListener("pointermove", function (e) {
      var card = e.target && e.target.closest ? e.target.closest(".dl-card") : null;
      if (!card) return;
      var glow = card.querySelector(":scope > .dl-glow");
      if (!glow) return;
      var r = card.getBoundingClientRect();
      glow.style.setProperty("--mx", (e.clientX - r.left) + "px");
      glow.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });

  }

  /* ---------- click sparkles ---------- */
  var COLORS = ["#e89a6e", "#f0b089", "#17605c", "#2f8c85", "#fbe9de"];
  document.addEventListener("pointerdown", function (e) {
    var t = e.target;
    if (!t || (t.closest && t.closest("input, textarea, select, video, iframe, .reel-media"))) return;
    var burst = document.createElement("div");
    burst.className = "dl-burst";
    burst.style.left = e.clientX + "px";
    burst.style.top = e.clientY + "px";
    var n = 9;
    for (var i = 0; i < n; i++) {
      var p = document.createElement("i");
      if (i % 3 === 0) p.className = "dl-dot";
      var a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      var dist = 26 + Math.random() * 30;
      p.style.setProperty("--x", Math.cos(a) * dist + "px");
      p.style.setProperty("--y", Math.sin(a) * dist + "px");
      p.style.setProperty("--c", COLORS[i % COLORS.length]);
      burst.appendChild(p);
    }
    body.appendChild(burst);
    setTimeout(function () { burst.remove(); }, 800);
  }, { passive: true });

})();
