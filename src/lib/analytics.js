const CONSENT_KEY = "greenlight_analytics_consent";
const UMAMI_SRC = "https://cloud.umami.is/script.js";
const UMAMI_ID = "10861293-fe91-4430-9cde-d068d26ae225";

let loadingState = "idle"; // "idle" | "loading" | "ready" | "failed"
let pendingEvents = [];
const MAX_PENDING = 50;

function safeGetItem(key) {
  try { return localStorage.getItem(key); }
  catch (err) {
    console.warn("[GreenLight] localStorage read failed:", err.message);
    return null;
  }
}

function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch (err) {
    console.error("[GreenLight] localStorage write failed:", err.message);
    return false;
  }
}

function safeRemoveItem(key) {
  try { localStorage.removeItem(key); } catch { /* non-critical */ }
}

/** Read current consent: "accepted" | "declined" | null */
export function getConsent() {
  return safeGetItem(CONSENT_KEY);
}

/** Write consent and load/disable Umami. Returns true if persisted. */
export function setConsent(value) {
  const ok = safeSetItem(CONSENT_KEY, value);
  if (value === "accepted") loadUmami();
  else disableUmami();
  return ok;
}

/** Safe event tracking — buffers if Umami still loading, no-ops if declined */
export function track(eventName, data) {
  if (getConsent() !== "accepted") return;

  if (loadingState === "ready" && typeof window.umami?.track === "function") {
    window.umami.track(eventName, data);
  } else if (loadingState === "loading" && pendingEvents.length < MAX_PENDING) {
    pendingEvents.push({ eventName, data });
  }
}

/** Call once at app init (main.jsx, before createRoot) */
export function initAnalytics() {
  if (getConsent() === "accepted") loadUmami();
}

function loadUmami() {
  if (loadingState !== "idle") return;
  loadingState = "loading";

  safeRemoveItem("umami.disabled");

  const s = document.createElement("script");
  s.defer = true;
  s.src = UMAMI_SRC;
  s.dataset.websiteId = UMAMI_ID;
  s.dataset.excludeSearch = "true";
  s.dataset.excludeHash = "true";

  s.onload = () => {
    if (typeof window.umami?.track === "function") {
      loadingState = "ready";
      drainQueue();
    } else {
      loadingState = "failed";
      pendingEvents = [];
    }
  };

  s.onerror = () => {
    loadingState = "failed";
    pendingEvents = [];
  };

  document.head.appendChild(s);
}

function drainQueue() {
  for (const { eventName, data } of pendingEvents) {
    window.umami.track(eventName, data);
  }
  pendingEvents = [];
}

function disableUmami() {
  safeSetItem("umami.disabled", "1");
}
