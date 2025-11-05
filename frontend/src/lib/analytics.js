// Lightweight analytics utility for GA4 and Meta Pixel
// Reads IDs from env: REACT_APP_GA_MEASUREMENT_ID and REACT_APP_META_PIXEL_ID

let initialized = false;
let runtimeConfig = null;

function injectScript(src) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function initAnalytics() {
  if (initialized) return;

  const gaId = process.env.REACT_APP_GA_MEASUREMENT_ID;
  const metaPixelId = process.env.REACT_APP_META_PIXEL_ID;

  // Initialize GA4 if ID is present
  if (gaId) {
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${gaId}`);
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // Disable automatic page_view; we will track SPA navigations manually
    window.gtag('config', gaId, { send_page_view: false });
  }

  // Initialize Meta Pixel if ID is present
  if (metaPixelId) {
    (function(f,b,e,v,n,t,s){
      if(f.fbq)return; n=f.fbq=function(){ n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments) };
      if(!f._fbq)f._fbq=n; n.push=n; n.loaded=!0; n.version='2.0';
      n.queue=[]; t=b.createElement(e); t.async=!0;
      t.src=v; s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', metaPixelId);
    // Optional: grant consent by default; adjust for your GDPR policy
    try { window.fbq('consent', 'grant'); } catch (e) { /* no-op */ }
  }

  initialized = true;
}

export function initAnalyticsWithIds(gaIdOverride, metaPixelIdOverride) {
  if (initialized) return;
  const gaId = gaIdOverride || process.env.REACT_APP_GA_MEASUREMENT_ID;
  const metaPixelId = metaPixelIdOverride || process.env.REACT_APP_META_PIXEL_ID;

  if (gaId) {
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${gaId}`);
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', gaId, { send_page_view: false });
  }

  if (metaPixelId) {
    (function(f,b,e,v,n,t,s){
      if(f.fbq)return; n=f.fbq=function(){ n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments) };
      if(!f._fbq)f._fbq=n; n.push=n; n.loaded=!0; n.version='2.0';
      n.queue=[]; t=b.createElement(e); t.async=!0;
      t.src=v; s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', metaPixelId);
    try { window.fbq('consent', 'grant'); } catch (e) { /* no-op */ }
  }

  initialized = true;
}

export function setRuntimeConfig(cfg) {
  runtimeConfig = cfg || null;
}

function isAnalyticsEnabled() {
  if (!runtimeConfig) return true; // default enabled if no config
  return runtimeConfig.enabled !== false;
}

function isEventEnabled(name) {
  if (!isAnalyticsEnabled()) return false;
  const events = runtimeConfig?.events;
  if (!events || !Array.isArray(events) || events.length === 0) return true; // default allow all when not specified
  return events.includes(name);
}

function filterParams(params) {
  const allowed = runtimeConfig?.data_fields;
  if (!allowed || !Array.isArray(allowed) || allowed.length === 0) return params || {};
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (allowed.includes(k)) out[k] = v;
  });
  return out;
}

export function trackPageView(path, title) {
  const pagePath = path || window.location.pathname + window.location.search;
  const pageTitle = title || document.title;
  const pageLocation = window.location.href;

  if (!isEventEnabled('page_view')) return;

  // GA4 page_view
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', filterParams({
      page_title: pageTitle,
      page_location: pageLocation,
      page_path: pagePath,
    }));
  }

  // Meta Pixel PageView
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
}

export function trackEvent(name, params = {}) {
  if (!isEventEnabled(name)) return;
  // GA4 custom/standard events
  if (typeof window.gtag === 'function') {
    try { window.gtag('event', name, filterParams(params || {})); } catch (e) { /* no-op */ }
  }

  // Meta Pixel events (standard or custom)
  if (typeof window.fbq === 'function') {
    try { window.fbq('track', name, filterParams(params || {})); } catch (e) { /* no-op */ }
  }
}