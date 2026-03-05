import { colors } from "../theme.js";

/**
 * Horizontal timeline bar from today → readiness date.
 * Markers for ST→LT conversion dates and one-time obligations.
 *
 * @param {number} readinessMonth - month index when ready (null if never)
 * @param {number} totalMonths - total projection horizon
 * @param {Array} markers - [{ month, label, type: "ltDate"|"obligation"|"target" }]
 * @param {string} signal - "green"|"amber"|"red"
 */
export default function ReadinessTimeline({ readinessMonth, totalMonths, markers = [], signal = "green" }) {
  const horizon = Math.max(totalMonths, readinessMonth || 0, 12);
  const pct = (m) => Math.min(100, (m / horizon) * 100);

  const barColor = signal === "green" ? colors.green
    : signal === "amber" ? colors.amber
    : colors.red;

  const barPct = readinessMonth != null ? pct(readinessMonth) : 100;

  // Sort markers by position and stagger labels above/below to avoid overlap
  const sorted = [...markers].sort((a, b) => a.month - b.month);
  const staggered = [];
  for (let i = 0; i < sorted.length; i++) {
    let above = i % 2 === 0;
    if (i > 0 && Math.abs(pct(sorted[i].month) - pct(sorted[i - 1].month)) < 8) {
      above = !staggered[i - 1].above;
    }
    staggered.push({ ...sorted[i], above });
  }

  return (
    <div style={{ padding: "30px 0 12px" }}>
      {/* Track */}
      <div style={{ position: "relative", height: 28, background: colors.bgInput, borderRadius: 14, overflow: "visible" }}>
        {/* Filled bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, height: "100%",
          width: `${barPct}%`, borderRadius: 14,
          background: `linear-gradient(90deg, ${barColor}33, ${barColor}88)`,
          transition: "width 0.4s ease",
        }} />

        {/* Markers */}
        {staggered.map((m, i) => {
          const left = pct(m.month);
          const markerColor = m.type === "target" ? colors.green
            : m.type === "ltDate" ? colors.blue
            : colors.amber;
          return (
            <div key={i} title={m.label} style={{
              position: "absolute", top: -4, left: `${left}%`, transform: "translateX(-50%)",
              width: m.type === "target" ? 3 : 2, height: 36,
              background: markerColor, opacity: m.type === "target" ? 0.9 : 0.7,
            }}>
              <div style={{
                position: "absolute",
                ...(m.above
                  ? { bottom: 40, left: "50%", transform: "translateX(-50%)" }
                  : { top: 40, left: "50%", transform: "translateX(-50%)" }),
                fontSize: 9, color: markerColor, fontWeight: m.type === "target" ? 600 : 400,
                whiteSpace: "nowrap", letterSpacing: 0.5,
              }}>
                {m.label}
              </div>
            </div>
          );
        })}

        {/* Readiness marker */}
        {readinessMonth != null && readinessMonth > 0 && (
          <div style={{
            position: "absolute", top: -2, left: `${barPct}%`, transform: "translateX(-50%)",
            width: 14, height: 32, borderRadius: 7,
            background: barColor, border: `2px solid ${colors.bg}`,
            boxShadow: `0 0 10px ${barColor}66`,
          }} />
        )}
      </div>

      {/* Labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontSize: 11, color: colors.dim }}>
        <span>Today</span>
        {readinessMonth != null && readinessMonth > 0 && (
          <span style={{ color: barColor, fontWeight: 600 }}>
            Ready — month {readinessMonth}
          </span>
        )}
        <span>{horizon} months</span>
      </div>
    </div>
  );
}
