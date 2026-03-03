// GreenLight Design Tokens
// All visual decisions flow from this file.
// The "Mission Control" aesthetic: deep dark space, precision mono,
// green light as the signal that your finances check out.

export const colors = {
  // Brand — the green light
  green: "#22c55e",
  greenDim: "#166534",
  greenGlow: "rgba(34, 197, 94, 0.12)",

  // Semantic
  red: "#ef4444",
  redDim: "#7f1d1d",
  blue: "#38bdf8",
  blueDim: "#0c4a6e",
  amber: "#f59e0b",
  amberDim: "#78350f",

  // Text hierarchy
  text: "#b8c9db",
  textBright: "#e2eaf3",
  dim: "#4a5d75",
  muted: "#6b7f95",

  // Surfaces (ordered dark → light)
  bg: "#06090f",
  bgAlt: "#080d14",
  bgHeader: "#0a1018",
  card: "#0c1219",
  cardHover: "#101d28",
  bgInput: "#0f1923",
  bgButton: "#162030",
  bgButtonHover: "#1c2840",

  // Borders
  border: "#1a2a3e",
  borderAccent: "#1a3a60",
  borderFocus: "#38bdf8",

  // Gradients
  bgGradientStart: "#0a1929",
  bgGradientEnd: "#0d2240",

  // Chart bar segments
  barTax: "#1a3a60",
  barInsurance: "#2a3050",
  gradientDark: "#0d1a2a",

  // Misc
  footerDim: "#1e2e42",
};

export const fonts = {
  mono: "'IBM Plex Mono', monospace",
};

// Shared form styles — used across page components
export const styles = {
  input: {
    background: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.text,
    padding: "8px 12px", borderRadius: 5, fontFamily: fonts.mono, fontSize: 15, width: "100%", boxSizing: "border-box",
  },
  btn: {
    background: colors.bgButton, border: `1px solid ${colors.border}`, color: colors.blue,
    padding: "8px 16px", borderRadius: 5, fontFamily: fonts.mono, fontSize: 14, cursor: "pointer",
  },
  label: { fontSize: 10, color: colors.dim, textTransform: "uppercase", letterSpacing: 1 },
  sectionTitle: { fontSize: 10, color: colors.dim, fontWeight: 600, letterSpacing: 1.5 },
  card: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 18 },
  pageTitle: { margin: 0, fontSize: 21, fontWeight: 700, color: colors.blue, letterSpacing: 1 },
};

styles.labelCompact = { ...styles.label, marginBottom: 2 };
styles.cardSection = { ...styles.card, marginBottom: 14 };

export const SIGNAL_COLORS = { green: colors.green, yellow: colors.amber, red: colors.red };
export const SIGNAL_BG = { green: colors.greenGlow, yellow: "rgba(245, 158, 11, 0.08)", red: "rgba(239, 68, 68, 0.08)" };
