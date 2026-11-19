/* Site-wide helpers that run on every page.
   - Contact details saved in the admin "Contact Info" tab update the phone,
     WhatsApp, Instagram and Facebook buttons.
   - The appointment form also sends a copy of each request to the admin's
     "Appointment Requests" inbox (patients still go to WhatsApp as before).
   Page texts and photos edited in the admin are applied on the server. */
(function () {
  "use strict";

  function applyContact() {
    var c = window.__SITE_CONTACT__;
    if (!c || typeof c !== "object") return;
    var digits = function (v) { return String(v || "").replace(/[^0-9]/g, ""); };
    if (c.phone) {
      document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
        a.setAttribute("href", "tel:+" + digits(c.phone));
      });
    }
    if (c.whatsapp) {
      document.querySelectorAll('a[href*="wa.me/"]').forEach(function (a) {
        var rest = (a.getAttribute("href") || "").split("wa.me/")[1] || "";
        var q = rest.indexOf("?") >= 0 ? rest.slice(rest.indexOf("?")) : "";
        a.setAttribute("href", "https://wa.me/" + digits(c.whatsapp) + q);
      });
    }
    if (c.email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
        a.setAttribute("href", "mailto:" + c.email);
      });
    }
    if (c.instagram) {
      document.querySelectorAll('a[href*="instagram.com"]:not([data-instagram-reel-link])').forEach(function (a) {
        a.setAttribute("href", c.instagram);
      });
    }
    if (c.facebook) {
      document.querySelectorAll("a .fa-facebook-f").forEach(function (i) {
        i.closest("a").setAttribute("href", c.facebook);
      });
    }
  }

  var lastSent = window.__lcLastSent || (window.__lcLastSent = { phone: "", at: 0 });
  function onRequestClick(e) {
    if (window.__SITE_EDIT__) return;
    var btn = e.target && e.target.closest && e.target.closest("#appo13 .appo8, #appo13 button[type=submit]");
    if (!btn) return;
    var val = function (id) { var el = document.getElementById(id); return el ? String(el.value || "").trim() : ""; };
    var name = val("appo14");
    var phone = val("appo15");
    if (!name || !phone) return;
    var now = Date.now();
    if (lastSent.phone === phone && now - lastSent.at < 5000) return;
    lastSent.phone = phone;
    lastSent.at = now;
    try {
      fetch("/api/public/appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          name: name.slice(0, 120),
          phone: phone.slice(0, 40),
          date: val("appo16").slice(0, 60),
          message: val("appo17").slice(0, 3000),
          page: location.pathname.slice(0, 200),
        }),
      }).catch(function () {});
    } catch (err) {}
  }
  // Instant page switching removes listeners added by page scripts and re-runs
  // this file on every page, so re-attach each time (dropping any old copy).
  function onRequestKey(e) {
    if (e.key !== "Enter") return;
    var t = e.target;
    if (!t || !t.closest || !t.closest("#appo13") || t.tagName === "TEXTAREA") return;
    var b = document.querySelector("#appo13 .appo8");
    if (b) onRequestClick({ target: b });
  }
  var prev = window.__lcHandlers;
  if (prev) {
    document.removeEventListener("click", prev.click, true);
    document.removeEventListener("keydown", prev.key, true);
  }
  window.__lcHandlers = { click: onRequestClick, key: onRequestKey };
  document.addEventListener("click", onRequestClick, true);
  document.addEventListener("keydown", onRequestKey, true);

  window.__applyLocalContent__ = applyContact;
  applyContact();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyContact);
})();
