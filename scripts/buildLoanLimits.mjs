#!/usr/bin/env node
/**
 * Preprocessing script: FHFA conforming loan limit CSVs + USCities.json → bundleable data.
 *
 * Reads:
 *   data/fhfa/US.csv  (UTF-16LE, tab-delimited — 50 states + DC)
 *   data/fhfa/AK.csv  (UTF-16LE, tab-delimited — Alaska)
 *   data/fhfa/HI.csv  (UTF-16LE, tab-delimited — Hawaii)
 *   data/USCities.json
 *
 * Writes:
 *   src/data/conformingLimits.js   — bundled module (only high-cost zips + known-zip set)
 *   public/zipLookup.json          — lazy-loaded zip → location metadata
 *
 * Usage:  node scripts/buildLoanLimits.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── State abbreviation map ──────────────────────────────────────────────────

const STATE_NAME_TO_ABBR = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "Dist. of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI",
  "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME",
  "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
  "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
  "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
  "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
  "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
};

const VALID_STATE_ABBRS = new Set(Object.values(STATE_NAME_TO_ABBR));

// ── Connecticut county → planning region limit ──────────────────────────────
// FHFA uses Planning Regions for CT; USCities.json uses traditional counties.
// When a county spans multiple regions with different limits, take the higher one.

const CT_COUNTY_LIMITS = {
  "Fairfield":  977500,   // Greater Bridgeport + Western CT
  "Hartford":   832750,   // Capitol
  "Litchfield": 832750,   // Northwest Hills (some overlap with Western CT)
  "Middlesex":  832750,   // Lower CT River Valley
  "New Haven":  851000,   // South Central CT + Naugatuck Valley (take higher)
  "New London": 832750,   // Southeastern CT
  "Tolland":    832750,   // Capitol
  "Windham":    832750,   // Northeastern CT
};

const BASELINE_LIMIT = 832750;

// ── Manual overrides for outdated county names in USCities.json ─────────────
// Census boundary changes, mergers, and renames that don't match FHFA data.

const MANUAL_COUNTY_LIMITS = {
  // VA independent cities merged into parent counties
  "VA|Clifton Forge City": BASELINE_LIMIT,   // merged into Alleghany County (2001)
  "VA|Bedford City": BASELINE_LIMIT,         // merged into Bedford County (2013)
  // SD county rename
  "SD|Shannon": BASELINE_LIMIT,              // renamed to Oglala Lakota County (2015)
  // AK census area boundary changes — all AK is $1,249,125
  "AK|Wade Hampton": 1249125,                // renamed to Kusilvak Census Area (2015)
  "AK|Yukon Koyukuk": 1249125,              // hyphen mismatch (Yukon-Koyukuk)
  "AK|Valdez Cordova": 1249125,             // split into Chugach + Copper River (2019)
  "AK|Matanuska Susitna": 1249125,          // hyphen mismatch
  "AK|Skagway Hoonah Angoon": 1249125,      // split into Skagway + Hoonah-Angoon
  "AK|Wrangell Petersburg": 1249125,        // split into Wrangell + Petersburg
  "AK|Prince Wales Ketchikan": 1249125,     // renamed/split
};

// ── Parse a UTF-16LE tab-delimited FHFA CSV ─────────────────────────────────

function parseFhfaCsv(filePath) {
  const buf = readFileSync(filePath);
  // Decode UTF-16LE; strip BOM
  const text = new TextDecoder("utf-16le").decode(buf).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const stateName = (cols[5] || "").trim();
    const countyRaw = (cols[6] || "").trim();
    const amountStr = (cols[4] || "").trim();
    if (!stateName || !countyRaw || !amountStr) continue;

    const amount = parseInt(amountStr.replace(/[$,]/g, ""), 10);
    if (!Number.isFinite(amount)) continue;

    records.push({ stateName, countyRaw, amount });
  }
  return records;
}

// ── Normalize county name ───────────────────────────────────────────────────
// FHFA uses: "Suffolk County", "Allen Parish", "Anchorage Municipality",
// "Bethel Census Area", "Juneau City And Borough", "Capitol Planning Region"

const COUNTY_SUFFIXES = [
  " City And Borough",
  " Census Area",
  " Planning Region",
  " Municipality",
  " Borough",
  " Parish",
  " County",
];

function normalizeCounty(raw) {
  let name = raw.trim();
  for (const suffix of COUNTY_SUFFIXES) {
    if (name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length);
      break;
    }
  }
  return name;
}

/**
 * Create a fuzzy match key for resolving naming differences between
 * USCities.json and FHFA data (Saint/St., apostrophes, De Kalb/DeKalb, etc.)
 */
function matchKey(county) {
  return county
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    .replace(/\bsainte\b/g, "ste")
    .replace(/\bst\.\s*/g, "st ")
    .replace(/\bste\.\s*/g, "ste ")
    .replace(/['']/g, "")           // strip apostrophes
    .replace(/\bdu\s+/g, "du")     // "Du Page" → "Dupage"
    .replace(/\bde\s+/g, "de")     // "De Kalb" → "Dekalb"
    .replace(/\bla\s+/g, "la")     // "La Salle" → "Lasalle"
    .replace(/\s+/g, " ")
    .trim();
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("Building conforming loan limit data...\n");

  // 1. Parse all FHFA CSVs
  const usRecords = parseFhfaCsv(join(ROOT, "data/fhfa/US.csv"));
  const akRecords = parseFhfaCsv(join(ROOT, "data/fhfa/AK.csv"));
  const hiRecords = parseFhfaCsv(join(ROOT, "data/fhfa/HI.csv"));
  const allRecords = [...usRecords, ...akRecords, ...hiRecords];

  console.log(`  FHFA records: US=${usRecords.length}, AK=${akRecords.length}, HI=${hiRecords.length}`);

  // 2. Build state+county → limit map
  //    Primary map keyed by "ST|CountyName" (exact), fuzzy map keyed by matchKey
  const countyLimits = new Map();      // exact: "ST|CountyName" → limit
  const fuzzyLimits = new Map();       // fuzzy: "st|matchkey" → limit
  let unmappedStates = new Set();

  for (const { stateName, countyRaw, amount } of allRecords) {
    const abbr = STATE_NAME_TO_ABBR[stateName];
    if (!abbr) {
      unmappedStates.add(stateName);
      continue;
    }

    // Skip CT from FHFA — we handle it via hardcoded county mapping
    if (abbr === "CT") continue;

    const county = normalizeCounty(countyRaw);
    const key = `${abbr}|${county}`;
    const fKey = `${abbr.toLowerCase()}|${matchKey(county)}`;

    // If multiple entries for the same county, take the higher limit
    const existing = countyLimits.get(key) || 0;
    if (amount > existing) {
      countyLimits.set(key, amount);
      fuzzyLimits.set(fKey, amount);
    }
  }

  // Add CT from hardcoded mapping
  for (const [county, limit] of Object.entries(CT_COUNTY_LIMITS)) {
    countyLimits.set(`CT|${county}`, limit);
    fuzzyLimits.set(`ct|${matchKey(county)}`, limit);
  }

  if (unmappedStates.size > 0) {
    console.log(`  Warning: unmapped state names: ${[...unmappedStates].join(", ")}`);
  }
  console.log(`  County-level limits: ${countyLimits.size} entries`);

  // 3. Read USCities.json
  const cities = JSON.parse(readFileSync(join(ROOT, "data/USCities.json"), "utf8"));
  console.log(`  USCities.json: ${cities.length} zip codes`);

  // 4. Build zip → conforming limit (only store non-baseline zips)
  const highCostZips = {};
  const knownZips = new Set();
  let matchCount = 0;
  let missCount = 0;
  const missedCombos = new Set();

  for (const city of cities) {
    const zip = city.zip_code;
    const state = city.state;
    const county = city.county;

    // Only include US states (skip territories like PR, GU, AS, etc.)
    if (!VALID_STATE_ABBRS.has(state)) continue;
    // Skip empty county entries (data quality issues — ~3 zips)
    if (!county || !county.trim()) continue;

    knownZips.add(zip);

    // 1. Try exact match
    const key = `${state}|${county}`;
    let limit = countyLimits.get(key);

    // 2. Fuzzy match (handles Saint/St., apostrophes, De Kalb/DeKalb, etc.)
    if (limit == null) {
      const fKey = `${state.toLowerCase()}|${matchKey(county)}`;
      limit = fuzzyLimits.get(fKey);
    }

    // 3. VA independent cities: USCities may have "Radford" while FHFA has "Radford City"
    if (limit == null && state === "VA" && !county.endsWith(" City")) {
      const vaKey = `va|${matchKey(county + " City")}`;
      limit = fuzzyLimits.get(vaKey);
    }

    // 4. Manual overrides for outdated names (AK reorganizations, VA mergers, SD rename)
    if (limit == null) {
      limit = MANUAL_COUNTY_LIMITS[key];
    }

    if (limit == null) {
      missCount++;
      missedCombos.add(key);
      continue;
    }

    matchCount++;
    if (limit !== BASELINE_LIMIT) {
      highCostZips[zip] = limit;
    }
  }

  console.log(`  Zip matches: ${matchCount}, misses: ${missCount}`);
  console.log(`  High-cost zips (above baseline): ${Object.keys(highCostZips).length}`);
  if (missedCombos.size > 0 && missedCombos.size <= 20) {
    console.log(`  Unmatched state|county combos: ${[...missedCombos].join(", ")}`);
  } else if (missedCombos.size > 20) {
    const sample = [...missedCombos].slice(0, 10);
    console.log(`  Unmatched combos (${missedCombos.size} total, showing 10): ${sample.join(", ")}`);
  }

  // 5. Write src/data/conformingLimits.js
  const limitsModule = `// Generated by scripts/buildLoanLimits.mjs — do not edit manually
// Source: FHFA 2025 Conforming Loan Limits
// https://www.fhfa.gov/data/dashboard/conforming-loan-limit-values-map
// Generated: ${new Date().toISOString().slice(0, 10)}

export const BASELINE_LIMIT = ${BASELINE_LIMIT};
export const YEAR = 2025;

// Only zips where the limit differs from BASELINE_LIMIT
const HIGH_COST_LIMITS = {
${Object.entries(highCostZips)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([zip, limit]) => `  ${zip}: ${limit},`)
  .join("\n")}
};

/**
 * Get the conforming loan limit for a US zip code.
 * Returns the high-cost limit if the zip is in a high-cost area,
 * otherwise returns BASELINE_LIMIT.
 * Zip validity should be checked separately via the zipLookup module.
 * @param {string|number} zipCode
 * @returns {number} Limit in dollars.
 */
export function getConformingLimit(zipCode) {
  const zip = typeof zipCode === "string" ? parseInt(zipCode, 10) : zipCode;
  return HIGH_COST_LIMITS[zip] ?? BASELINE_LIMIT;
}
`;

  writeFileSync(join(ROOT, "src/data/conformingLimits.js"), limitsModule);
  console.log(`\n  Wrote src/data/conformingLimits.js`);

  // 6. Write public/zipLookup.json (compact format)
  mkdirSync(join(ROOT, "public"), { recursive: true });

  const zipLookup = {};
  for (const city of cities) {
    if (!VALID_STATE_ABBRS.has(city.state)) continue;
    zipLookup[city.zip_code] = [city.state, city.county, city.city];
  }

  writeFileSync(
    join(ROOT, "public/zipLookup.json"),
    JSON.stringify(zipLookup),
  );
  console.log(`  Wrote public/zipLookup.json (${Object.keys(zipLookup).length} entries)`);

  console.log("\nDone!");
}

main();
