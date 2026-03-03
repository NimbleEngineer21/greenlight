import { colors, styles } from "../theme.js";
import { fmt } from "../lib/calculations.js";

const labelSt = styles.label;

/**
 * Itemized cost breakdown table with overrides and paid tracking.
 * @param {{ items, overrides, paid, onOverride, onTogglePaid, price, title }} props
 */
export default function CostBreakdown({ items, overrides, paid, onOverride, onTogglePaid, price, title }) {
  const paidTotal = items.filter(i => i.isPaid).reduce((s, i) => s + i.amount, 0);
  const unpaidTotal = items.filter(i => !i.isPaid).reduce((s, i) => s + i.amount, 0);
  return (
    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 18 }}>
      <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 12, letterSpacing: 1.5 }}>
        {title || "COST BREAKDOWN"}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
            <th style={{ ...labelSt, padding: "6px 8px", textAlign: "left", width: 24 }}></th>
            <th style={{ ...labelSt, padding: "6px 8px", textAlign: "left" }}>Item</th>
            <th style={{ ...labelSt, padding: "6px 8px", textAlign: "right", width: 120 }}>Amount</th>
            <th style={{ ...labelSt, padding: "6px 8px", textAlign: "right", width: 120 }}>Override</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const override = overrides[item.key];
            const isPaid = paid[item.key];
            return (
              <tr key={item.key} style={{
                borderBottom: `1px solid #0e1620`,
                background: i % 2 ? colors.bgAlt : "transparent",
                opacity: isPaid ? 0.5 : 1,
              }}>
                <td style={{ padding: "5px 8px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!isPaid}
                    onChange={() => onTogglePaid(item.key)}
                    title="Mark as paid"
                    style={{ accentColor: colors.green, cursor: "pointer" }}
                  />
                </td>
                <td style={{
                  padding: "5px 8px",
                  textDecoration: isPaid ? "line-through" : "none",
                  color: isPaid ? colors.dim : colors.text,
                }}>
                  {item.label}
                  {item.isPercent && !override && price > 0 && (
                    <span style={{ fontSize: 11, color: colors.dim, marginLeft: 6 }}>
                      ({(item.amount / price * 100).toFixed(2)}%)
                    </span>
                  )}
                </td>
                <td style={{
                  textAlign: "right", padding: "5px 8px",
                  color: isPaid ? colors.dim : item.isOverridden ? colors.blue : colors.text,
                  fontWeight: item.isOverridden ? 600 : 400,
                  textDecoration: isPaid ? "line-through" : "none",
                }}>
                  {fmt(item.amount)}
                </td>
                <td style={{ textAlign: "right", padding: "5px 4px" }}>
                  <input
                    type="number"
                    step="1"
                    value={override ?? ""}
                    onChange={e => {
                      const val = e.target.value;
                      onOverride(item.key, val === "" ? null : parseFloat(val));
                    }}
                    placeholder="—"
                    style={{ ...styles.input, width: 100, textAlign: "right", padding: "4px 8px", fontSize: 13 }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {paidTotal > 0 && (
            <tr style={{ borderTop: `1px solid ${colors.border}` }}>
              <td colSpan={2} style={{ padding: "6px 8px", fontSize: 12, color: colors.dim }}>
                PAID
                <span style={{ color: colors.green, marginLeft: 6 }}>&#10003;</span>
              </td>
              <td style={{ textAlign: "right", padding: "6px 8px", color: colors.dim, fontSize: 14 }}>
                {fmt(paidTotal)}
              </td>
              <td />
            </tr>
          )}
          <tr style={{ borderTop: `2px solid ${colors.border}` }}>
            <td colSpan={2} style={{ padding: "8px", fontWeight: 700, fontSize: 12 }}>
              {paidTotal > 0 ? "REMAINING" : "TOTAL"}
            </td>
            <td style={{ textAlign: "right", padding: "8px", fontWeight: 700, color: colors.green, fontSize: 15 }}>
              {fmt(unpaidTotal)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      <div style={{ fontSize: 11, color: colors.dim, marginTop: 8 }}>
        Typical ranges shown. Override any item with a custom amount. Check the box to mark as paid.
      </div>
    </div>
  );
}
