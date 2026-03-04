import { useState, useEffect } from "react";
import { colors, fonts } from "../theme.js";
import { getConsent, setConsent, track } from "../lib/analytics.js";

export default function ConsentBanner() {
  const [consent, setLocal] = useState(() => getConsent());

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "greenlight_analytics_consent") setLocal(getConsent());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (consent !== null) return null;

  const handleAccept = () => {
    const ok = setConsent("accepted");
    if (ok) {
      setLocal("accepted");
      track("consent_accept");
    }
  };

  const handleDecline = () => {
    const ok = setConsent("declined");
    if (ok) setLocal("declined");
  };

  const btnBase = {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 20px",
    borderRadius: 4,
    cursor: "pointer",
    border: `1px solid ${colors.border}`,
  };

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: colors.card,
        borderTop: `1px solid ${colors.border}`,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        flexWrap: "wrap",
        fontFamily: fonts.mono,
      }}
    >
      <span style={{ fontSize: 12, color: colors.dim, maxWidth: 520, lineHeight: 1.6 }}>
        GreenLight uses Umami to count page views — no cookies, no personal data, no cross-site tracking.
        You can change this anytime in Settings.
      </span>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleDecline} style={{ ...btnBase, background: colors.bgAlt, color: colors.text }}>
          Decline
        </button>
        <button onClick={handleAccept} style={{ ...btnBase, background: colors.greenDim, color: colors.green }}>
          Allow analytics
        </button>
      </div>
    </div>
  );
}
