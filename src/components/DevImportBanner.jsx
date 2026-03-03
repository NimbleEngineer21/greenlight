import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PROVIDERS } from "../data/providers.js";
import { colors, fonts } from "../theme.js";

// Dev-only banner: detects locally placed brokerage CSV/XLSX files in data/user_[initials]/
// and offers a one-click link to the Import page.
// Renders nothing in production (import.meta.env.DEV is false in built output).
export default function DevImportBanner() {
  const [detectedProviders, setDetectedProviders] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    fetch("/api/dev/data-files")
      .then(r => r.json())
      .then(files => {
        const keys = [...new Set(files.map(f => f.provider))].filter(k => PROVIDERS[k]);
        setDetectedProviders(keys);
      })
      .catch(() => setDetectedProviders([]));
  }, []);

  if (!import.meta.env.DEV) return null;
  if (!detectedProviders || detectedProviders.length === 0 || dismissed) return null;

  const names = detectedProviders.map(k => PROVIDERS[k].name).join(", ");

  return (
    <div style={{
      background: colors.blueDim,
      borderBottom: `1px solid ${colors.blue}`,
      padding: "9px 20px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 13,
      fontFamily: fonts.mono,
      color: colors.textBright,
    }}>
      <span style={{ color: colors.blue }}>↑</span>
      <span>
        Local data found: <strong>{names}</strong>.{" "}
        <Link to="/import" style={{ color: colors.blue, textDecoration: "underline" }}>
          Import now →
        </Link>
      </span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          color: colors.muted,
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: "0 4px",
          fontFamily: fonts.mono,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
