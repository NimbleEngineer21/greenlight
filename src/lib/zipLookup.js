/**
 * Lazy-loaded zip code → location metadata.
 * Fetches public/zipLookup.json on first use and caches in memory.
 */

let cache = null;
let fetchPromise = null;

/**
 * Load the zip lookup data. Returns cached data if already loaded.
 * @returns {Promise<Map<number, { state: string, county: string, city: string }>>}
 */
export async function loadZipData() {
  if (cache) return cache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/zipLookup.json")
    .then(r => {
      if (!r.ok) throw new Error(`Failed to load zip data: ${r.status}`);
      return r.json();
    })
    .then(data => {
      cache = new Map();
      // Format: { "10001": ["NY", "New York", "Manhattan"], ... }
      for (const [zip, info] of Object.entries(data)) {
        cache.set(Number(zip), { state: info[0], county: info[1], city: info[2] });
      }
      fetchPromise = null;
      return cache;
    })
    .catch(err => {
      console.error("[GreenLight] Failed to load zip lookup:", err);
      fetchPromise = null;
      return new Map();
    });

  return fetchPromise;
}

/**
 * Look up location info for a zip code. Returns null if data hasn't loaded or zip unknown.
 * @param {string|number} zipCode
 * @returns {{ state: string, county: string, city: string } | null}
 */
export function getZipInfo(zipCode) {
  if (!cache) return null;
  const zip = typeof zipCode === "string" ? parseInt(zipCode, 10) : zipCode;
  return cache.get(zip) || null;
}
