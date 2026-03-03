import { useState } from "react";
import { colors } from "../theme.js";

const PAD = { top: 20, right: 20, bottom: 30, left: 50 };

/**
 * Pure SVG mortgage rate chart from FRED data.
 * @param {{ rates: Array<{date, value}>, currentRate: number, height?: number }} props
 */
export default function RateChart({ rates, currentRate, height = 200 }) {
  const [hover, setHover] = useState(null);
  const width = 600; // viewBox width, stretches to 100%

  if (!rates?.length) {
    return (
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 18, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, letterSpacing: 1.5, marginBottom: 8 }}>
          MORTGAGE RATE TREND
        </div>
        <div style={{ color: colors.dim, fontSize: 14, padding: 20 }}>
          No rate data available. Add a FRED API key in Settings to fetch historical rates.
        </div>
      </div>
    );
  }

  // Filter to last 2 years
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const cutoff = twoYearsAgo.toISOString().slice(0, 10);
  const data = rates.filter(r => r.date >= cutoff);
  if (data.length < 2) return null;

  const values = data.map(d => d.value);
  const minY = Math.floor(Math.min(...values, currentRate || Infinity) * 2) / 2;
  const maxY = Math.ceil(Math.max(...values, currentRate || 0) * 2) / 2;
  const rangeY = maxY - minY || 1;

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const scaleX = (i) => PAD.left + (i / (data.length - 1)) * plotW;
  const scaleY = (v) => PAD.top + (1 - (v - minY) / rangeY) * plotH;

  // Build polyline
  const points = data.map((d, i) => `${scaleX(i)},${scaleY(d.value)}`).join(" ");

  // Y-axis ticks (every 0.5%)
  const yTicks = [];
  for (let v = minY; v <= maxY; v += 0.5) yTicks.push(v);

  // X-axis labels (every ~3 months)
  const xLabels = [];
  const step = Math.max(1, Math.floor(data.length / 8));
  for (let i = 0; i < data.length; i += step) {
    const d = new Date(data[i].date + "T12:00:00");
    xLabels.push({ i, label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) });
  }

  const handleMouse = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * width;
    if (x < PAD.left || x > width - PAD.right) { setHover(null); return; }
    const idx = Math.round(((x - PAD.left) / plotW) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHover(clamped);
  };

  return (
    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 18, position: "relative" }}>
      <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, letterSpacing: 1.5, marginBottom: 8 }}>
        MORTGAGE RATE TREND (2 YEAR)
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height }}
        onMouseMove={handleMouse}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines */}
        {yTicks.map(v => (
          <line key={v} x1={PAD.left} y1={scaleY(v)} x2={width - PAD.right} y2={scaleY(v)}
            stroke={colors.border} strokeWidth={0.5} />
        ))}

        {/* Y-axis labels */}
        {yTicks.map(v => (
          <text key={`lbl-${v}`} x={PAD.left - 6} y={scaleY(v) + 3}
            fill={colors.dim} fontSize={10} textAnchor="end" fontFamily="monospace">
            {v.toFixed(1)}%
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={scaleX(i)} y={height - 6}
            fill={colors.dim} fontSize={9} textAnchor="middle" fontFamily="monospace">
            {label}
          </text>
        ))}

        {/* Current rate reference line */}
        {currentRate > 0 && (
          <>
            <line
              x1={PAD.left} y1={scaleY(currentRate)} x2={width - PAD.right} y2={scaleY(currentRate)}
              stroke={colors.green} strokeWidth={1} strokeDasharray="4,4"
            />
            <text x={width - PAD.right + 4} y={scaleY(currentRate) + 3}
              fill={colors.green} fontSize={10} fontFamily="monospace">
              {currentRate.toFixed(2)}%
            </text>
          </>
        )}

        {/* Rate polyline */}
        <polyline points={points} fill="none" stroke={colors.blue} strokeWidth={1.5} />

        {/* Hover indicator */}
        {hover != null && data[hover] && (
          <>
            <circle cx={scaleX(hover)} cy={scaleY(data[hover].value)} r={4} fill={colors.blue} />
            <line x1={scaleX(hover)} y1={PAD.top} x2={scaleX(hover)} y2={height - PAD.bottom}
              stroke={colors.blue} strokeWidth={0.5} strokeDasharray="2,2" />
          </>
        )}
      </svg>

      {/* Hover tooltip */}
      {hover != null && data[hover] && (
        <div style={{
          position: "absolute", top: 12, right: 18,
          background: colors.bgButton, border: `1px solid ${colors.border}`,
          borderRadius: 4, padding: "4px 8px", fontSize: 12,
        }}>
          <span style={{ color: colors.dim }}>{data[hover].date}</span>
          <span style={{ marginLeft: 8, fontWeight: 600, color: colors.blue }}>{data[hover].value.toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}
