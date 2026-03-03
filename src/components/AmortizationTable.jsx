import { useState } from "react";
import { colors, styles } from "../theme.js";
import { fmt } from "../lib/calculations.js";

const labelSt = styles.label;

/**
 * Collapsible amortization schedule table.
 * @param {{ schedule, pmiDropoffMonth, monthlyPMI }} props
 */
export default function AmortizationTable({ schedule, pmiDropoffMonth, monthlyPMI }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!schedule?.length) return null;

  const INITIAL_ROWS = 24;
  const visible = showAll ? schedule : schedule.slice(0, INITIAL_ROWS);

  // Year subtotals
  const yearTotals = {};
  for (const row of schedule) {
    const yr = Math.ceil(row.month / 12);
    if (!yearTotals[yr]) yearTotals[yr] = { principal: 0, interest: 0, pmi: 0 };
    yearTotals[yr].principal += row.principalPart;
    yearTotals[yr].interest += row.interestPart;
    yearTotals[yr].pmi += (pmiDropoffMonth && row.month <= pmiDropoffMonth) ? (monthlyPMI || 0) : 0;
  }

  return (
    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 18 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ ...styles.btn, width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between" }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color: colors.dim, letterSpacing: 1.5 }}>
          AMORTIZATION SCHEDULE
        </span>
        <span style={{ color: colors.blue }}>{open ? "▾ Hide" : "▸ Show"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                {["Month", "Payment", "Principal", "Interest", "PMI", "Balance"].map(h => (
                  <th key={h} style={{ ...labelSt, padding: "6px 6px", textAlign: "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => {
                const hasPMI = pmiDropoffMonth && row.month <= pmiDropoffMonth;
                const isPMIDropoff = pmiDropoffMonth && row.month === pmiDropoffMonth;

                return [
                  <tr key={row.month} style={{
                    borderBottom: `1px solid #0e1620`,
                    background: isPMIDropoff ? colors.greenGlow : (i % 2 ? colors.bgAlt : "transparent"),
                  }}>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: colors.dim }}>{row.month}</td>
                    <td style={{ textAlign: "right", padding: "4px 6px" }}>{fmt(row.payment)}</td>
                    <td style={{ textAlign: "right", padding: "4px 6px", color: colors.blue }}>{fmt(row.principalPart)}</td>
                    <td style={{ textAlign: "right", padding: "4px 6px", color: colors.dim }}>{fmt(row.interestPart)}</td>
                    <td style={{ textAlign: "right", padding: "4px 6px", color: hasPMI ? colors.amber : colors.dim }}>
                      {hasPMI ? fmt(monthlyPMI) : "$0.00"}
                      {isPMIDropoff && <span style={{ color: colors.green, marginLeft: 4, fontSize: 11 }}>drops off</span>}
                    </td>
                    <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 500 }}>{fmt(row.balance)}</td>
                  </tr>,
                  // Year subtotal row after every 12 months
                  row.month % 12 === 0 && yearTotals[row.month / 12] ? (
                    <tr key={`yr-${row.month / 12}`} style={{
                      borderBottom: `2px solid ${colors.border}`,
                      background: colors.bgButton,
                    }}>
                      <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: 11, color: colors.dim }}>
                        Yr {row.month / 12}
                      </td>
                      <td />
                      <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600, fontSize: 12, color: colors.blue }}>
                        {fmt(yearTotals[row.month / 12].principal)}
                      </td>
                      <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600, fontSize: 12, color: colors.dim }}>
                        {fmt(yearTotals[row.month / 12].interest)}
                      </td>
                      <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600, fontSize: 12, color: colors.dim }}>
                        {yearTotals[row.month / 12].pmi > 0 ? fmt(yearTotals[row.month / 12].pmi) : ""}
                      </td>
                      <td />
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>

          {!showAll && schedule.length > INITIAL_ROWS && (
            <button
              onClick={() => setShowAll(true)}
              style={{ ...styles.btn, width: "100%", marginTop: 8, color: colors.blue, textAlign: "center" }}
            >
              Show All {schedule.length} Months
            </button>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={labelSt}>Total Principal</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.blue }}>
                {fmt(schedule.reduce((s, r) => s + r.principalPart, 0))}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={labelSt}>Total Interest</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.red }}>
                {fmt(schedule.reduce((s, r) => s + r.interestPart, 0))}
              </div>
            </div>
            {pmiDropoffMonth > 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={labelSt}>Total PMI</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.amber }}>
                  {fmt(pmiDropoffMonth * (monthlyPMI || 0))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
