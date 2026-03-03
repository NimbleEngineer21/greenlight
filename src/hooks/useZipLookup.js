import { useState, useEffect, useCallback } from "react";
import { loadZipData, getZipInfo } from "../lib/zipLookup.js";

/**
 * React hook for zip code → location lookup.
 * Lazily loads the zip data on mount and provides a synchronous lookup function.
 * @returns {{ loaded: boolean, lookup: (zip: string|number) => { state, county, city } | null }}
 */
export function useZipLookup() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadZipData().then(() => setLoaded(true));
  }, []);

  const lookup = useCallback(
    (zipCode) => getZipInfo(zipCode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded],
  );

  return { loaded, lookup };
}
