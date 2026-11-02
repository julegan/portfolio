/* Shared, optional GA4 page analytics for the independent portfolio.
 * No Google script, cookie, or measurement request before an explicit opt-in.
 * Local-first experiments and SHOWS have no custom tracking events.
 */
(() => {
  "use strict";

  const MEASUREMENT_ID = "G-LMS6LWDK63";
  const CONSENT_KEY = "julieowens.analytics.choice.v1";
  const PRODUCTION_HOSTS = new Set(["julieowens.me", "www.julieowens.me"]);
  const optOutKey = "ga-disable-" + MEASUREMENT_ID;
  const browserOptOut = navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === "1" || window.doNotTrack === "1";
  const isProduction = PRODUCTION_HOSTS.has(window.location.hostname);
  let choice = null;
  let loaded = false;
  let settingsButton = null;
  let panel = null;
  let allowButton = null;
  let status = null;

  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "allow" || stored === "deny") choice = stored;
  } catch (_) {
    // Storage may be blocked. Stay opted out until this page has an explicit choice.
  }

  window[optOutKey] = true;

  function saveChoice(value) {
    choice = value;
    try { localStorage.setItem(CONSENT_KEY, value); } catch (_) {
      // If storage is disabled, permission applies only to this page.
    }
  }

  function clearAnalyticsCookies() {
    // Best effort: cookies set on the current domain can be cleared on
    // withdrawal, though third-party browser data is outside this site's reach.
    const names = document.cookie.split(";").map(part => part.split("=")[0].trim());
    const hosts = [window.location.hostname, "." + window.location.hostname];
    for (const name of names) {
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of hosts) {
        document.cookie = encodeURIComponent(name) + "=; Max-Age=0; Path=/; SameSite=Lax; Domain=" + domain;
      }
      document.cookie = encodeURIComponent(name) + "=; Max-Age=0; Path=/; SameSite=Lax";
    }
  }

  function startAnalytics() {
    if (!isProduction || browserOptOut || choice !== "allow") return;
    window[optOutKey] = false;
    if (loaded) {
      // A visitor can change their mind again without a reload.
      window.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
      window.gtag("config", MEASUREMENT_ID, {
        send_page_view: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: window.location.origin + window.location.pathname
      });
      return;
    }
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    // Block all advertising consent categories, even after analytics opt-in.
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID, {
      send_page_view: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      // Do not leak experimental design parameters or shareable link contents.
      page_location: window.location.origin + window.location.pathname
    });

    const tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
    tag.id = "portfolio-google-tag";
    document.head.appendChild(tag);
  }

  function stopAnalytics() {
    window[optOutKey] = true;
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
    }
    clearAnalyticsCookies();
  }

  function updatePanel() {
    if (!panel) return;
    if (browserOptOut) {
      status.textContent = "Your browser requests no tracking. Analytics is disabled.";
      allowButton.hidden = true;
    } else {
      status.textContent = choice === "allow" ? "Current preference: analytics allowed."
        : choice === "deny" ? "Current preference: analytics declined."
        : "Your preference: not selected. Analytics is off.";
      allowButton.hidden = false;
    }
    settingsButton.setAttribute("aria-expanded", String(!panel.hidden));
  }

  function showPanel(focusHeading) {
    panel.hidden = false;
    updatePanel();
    if (focusHeading) panel.querySelector("h2").focus({ preventScroll: true });
  }
  function hidePanel(returnFocus) {
    panel.hidden = true;
    updatePanel();
    if (returnFocus) settingsButton.focus({ preventScroll: true });
  }

  function buildControls() {
    const footer = document.querySelector("footer") || document.body;
    settingsButton = document.createElement("button");
    settingsButton.type = "button";
    settingsButton.className = "portfolio-analytics-settings";
    settingsButton.textContent = "Analytics preferences";
    settingsButton.setAttribute("aria-controls", "portfolio-analytics-choices");
    settingsButton.setAttribute("aria-expanded", "false");
    footer.appendChild(settingsButton);

    panel = document.createElement("section");
    panel.id = "portfolio-analytics-choices";
    panel.className = "portfolio-analytics-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", "portfolio-analytics-heading");
    panel.innerHTML = [
      '<h2 id="portfolio-analytics-heading" tabindex="-1">Optional site analytics</h2>',
      '<p>With your permission, Google Analytics helps measure visits to this portfolio, SHOWS, and other projects. Google may receive page paths and browser/device information and set analytics cookies. The site works without it.</p>',
      '<p>We do not send your experimental designs, saved SHOWS events, or URL query parameters to Google through our own analytics code. Google may collect automatically measured events depending on the Analytics property settings. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google privacy policy</a>.</p>',
      '<p class="portfolio-analytics-status" id="portfolio-analytics-status" aria-live="polite"></p>',
      '<div class="portfolio-analytics-actions">',
      '  <button id="portfolio-analytics-allow" type="button">Allow analytics</button>',
      '  <button id="portfolio-analytics-decline" type="button">Decline</button>',
      '  <button id="portfolio-analytics-close" type="button">Close</button>',
      '</div>'
    ].join("");
    document.body.appendChild(panel);

    status = panel.querySelector("#portfolio-analytics-status");
    allowButton = panel.querySelector("#portfolio-analytics-allow");

    settingsButton.addEventListener("click", () => {
      if (panel.hidden) showPanel(true);
      else hidePanel(true);
    });
    allowButton.addEventListener("click", () => {
      if (browserOptOut) return;
      saveChoice("allow");
      startAnalytics();
      hidePanel(true);
    });
    panel.querySelector("#portfolio-analytics-decline").addEventListener("click", () => {
      saveChoice("deny");
      stopAnalytics();
      hidePanel(true);
    });
    panel.querySelector("#portfolio-analytics-close").addEventListener("click", () => hidePanel(true));
    panel.addEventListener("keydown", event => {
      if (event.key === "Escape") hidePanel(true);
    });

    panel.hidden = true;
    if (choice === null && !browserOptOut) showPanel(false);
    updatePanel();
  }

  // Main app scripts remain independent: this nonblocking control adds no
  // dependencies and does not observe clicks, searches, inputs, or designs.
  buildControls();
  if (choice === "allow" && !browserOptOut) startAnalytics();
})();
