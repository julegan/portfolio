/* Shared GA4 page analytics; no interactive consent interface.
 * Honor previous refusals and browser privacy signals. No custom events.
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

  window[optOutKey] = true;
  let previouslyDeclined = true;
  try {
    previouslyDeclined = localStorage.getItem(CONSENT_KEY) === "deny";
  } catch (_) {
    // Fail closed when a previous refusal cannot be checked.
  }

  // Noninteractive disclosure, not a consent prompt.
  const footer = document.querySelector("footer");
  if (footer) {
    const notice = document.createElement("small");
    notice.className = "portfolio-analytics-notice";
    notice.append("This site uses Google Analytics on selected pages. ");
    const link = document.createElement("a");
    link.href = "https://tools.google.com/dlpage/gaoptout";
    link.textContent = "Google Analytics opt-out";
    notice.appendChild(link);
    footer.appendChild(notice);
  }

  if (!isProduction || browserOptOut || previouslyDeclined) return;
  window[optOutKey] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  // Analytics is enabled by default; this is not a record of visitor consent.
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
    page_location: window.location.origin + window.location.pathname
  });
  const tag = document.createElement("script");
  tag.async = true;
  tag.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
  tag.id = "portfolio-google-tag";
  document.head.appendChild(tag);
})();
