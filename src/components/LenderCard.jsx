import { colors, styles, SIGNAL_COLORS } from "../theme.js";
import { fmt } from "../lib/calculations.js";

const labelSt = styles.label;

/**
 * Single lender summary card for comparison page.
 * @param {{ lender, isBest, onEdit, onRemove }} props
 */
export default function LenderCard({ lender, isBest, onEdit, onRemove }) {
  const signalColor = SIGNAL_COLORS[lender.buyDown?.signal] || colors.dim;

  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${isBest ? colors.green : colors.border}`,
      borderTop: isBest ? `3px solid ${colors.green}` : `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.textBright }}>
          {lender.name || "Unnamed Lender"}
        </div>
        {isBest && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: colors.green,
            background: colors.greenGlow, padding: "2px 8px", borderRadius: 4,
            letterSpacing: 1, textTransform: "uppercase",
          }}>
            Best Value
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={labelSt}>Rate</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.blue }}>
            {lender.adjustedRate?.toFixed(3)}%
          </div>
          {(lender.points || 0) > 0 && (
            <div style={{ fontSize: 11, color: colors.dim }}>
              {lender.ratePercent}% - {lender.points} pts
            </div>
          )}
        </div>
        <div>
          <div style={labelSt}>Monthly P&I</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(lender.monthlyPI)}</div>
        </div>
        <div>
          <div style={labelSt}>Upfront Cost</div>
          <div style={{ fontSize: 14, color: lender.upfrontCost > 0 ? colors.text : colors.green }}>
            {fmt(lender.upfrontCost)}
          </div>
        </div>
        <div>
          <div style={labelSt}>Total @ 10yr</div>
          <div style={{ fontSize: 14 }}>{fmt(lender.totalAt10yr)}</div>
        </div>
      </div>

      {/* Points break-even */}
      {(lender.points || 0) > 0 && lender.breakEven && (
        <div style={{
          background: colors.bgAlt, borderRadius: 6, padding: 10, marginBottom: 12,
          borderLeft: `3px solid ${signalColor}`,
        }}>
          <div style={{ fontSize: 11, color: colors.dim, marginBottom: 4 }}>POINTS ANALYSIS</div>
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <div>
              <span style={{ color: colors.dim }}>Cost: </span>
              <span>{fmt(lender.pointsCost)}</span>
            </div>
            <div>
              <span style={{ color: colors.dim }}>Savings: </span>
              <span>{fmt(lender.breakEven.monthlySavings)}/mo</span>
            </div>
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            <span style={{ color: colors.dim }}>Break-even: </span>
            <span>
              {lender.breakEven.adjustedMonths === Infinity
                ? "Never"
                : `${lender.breakEven.adjustedMonths} mo (${(lender.breakEven.adjustedMonths / 12).toFixed(1)} yr)`}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: signalColor, marginTop: 4 }}>
            {lender.buyDown?.label}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEdit} style={{ ...styles.btn, fontSize: 12, padding: "4px 10px" }}>Edit</button>
        <button onClick={onRemove} style={{ ...styles.btn, fontSize: 12, padding: "4px 10px", color: colors.red }}>Remove</button>
      </div>
    </div>
  );
}
