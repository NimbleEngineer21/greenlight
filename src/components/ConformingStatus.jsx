import { useMemo } from "react";
import { colors, styles } from "../theme.js";
import { fmt } from "../lib/calculations.js";
import { detectJumbo, suggestConformingDown, calcJumboImpact, calcEffectiveRate } from "../lib/loanLimits.js";
import { YEAR } from "../data/conformingLimits.js";


/**
 * Conforming Loan Status card — shows whether the loan is conforming or jumbo,
 * with rate impact analysis and a suggestion to increase down payment.
 */
export default function ConformingStatus({
  zipCode, loanAmount, homePrice, currentDownPercent,
  baseRate, termYears, jumboSpread, zipInfo,
  onZipChange, onSpreadChange, onApplySuggestion,
}) {
  const hasZip = zipCode && zipCode.length === 5;

  const jumbo = useMemo(
    () => hasZip ? detectJumbo(loanAmount, zipCode, !!zipInfo) : null,
    [hasZip, loanAmount, zipCode, zipInfo],
  );

  const suggestion = useMemo(
    () => jumbo?.isJumbo ? suggestConformingDown(homePrice, jumbo.conformingLimit, currentDownPercent) : null,
    [jumbo, homePrice, currentDownPercent],
  );

  const impact = useMemo(
    () => jumbo?.isJumbo ? calcJumboImpact(loanAmount, baseRate, termYears, jumboSpread) : null,
    [jumbo, loanAmount, baseRate, termYears, jumboSpread],
  );

  const effectiveRate = jumbo?.isJumbo
    ? calcEffectiveRate(baseRate, true, jumboSpread)
    : baseRate;

  const locationLabel = zipInfo
    ? `${zipInfo.city}, ${zipInfo.county} Co., ${zipInfo.state}`
    : hasZip ? "Looking up..." : null;

  return (
    <div style={{ ...styles.card, marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: colors.dim, fontWeight: 600, marginBottom: 10, letterSpacing: 1.5 }}>
        CONFORMING LOAN STATUS
        <span style={{ fontWeight: 400, marginLeft: 8 }}>({YEAR} FHFA Limits)</span>
      </div>

      {/* Zip Code Input + Location */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: hasZip ? 14 : 0 }}>
        <div style={{ width: 120 }}>
          <div style={styles.labelCompact}>Zip Code</div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="e.g. 32301"
            value={zipCode || ""}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 5);
              onZipChange(val);
            }}
            style={{ ...styles.input, width: 120 }}
          />
        </div>
        {locationLabel && (
          <div style={{ fontSize: 13, color: colors.text, paddingBottom: 8 }}>
            {locationLabel}
          </div>
        )}
        {hasZip && !zipInfo && zipCode.length === 5 && (
          <div style={{ fontSize: 12, color: colors.amber, paddingBottom: 8 }}>
            Zip not found in database
          </div>
        )}
      </div>

      {/* Status display */}
      {hasZip && jumbo && (
        <>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
            marginBottom: jumbo.isJumbo ? 14 : 0,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={styles.labelCompact}>Conforming Limit</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
                {fmt(jumbo.conformingLimit)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={styles.labelCompact}>Your Loan</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: jumbo.isJumbo ? colors.amber : colors.green }}>
                {fmt(loanAmount)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={styles.labelCompact}>Status</div>
              <div style={{
                fontSize: 14, fontWeight: 700,
                color: jumbo.isJumbo ? colors.amber : colors.green,
              }}>
                {jumbo.isJumbo ? "JUMBO" : "CONFORMING"}
              </div>
            </div>
          </div>

          {/* Jumbo details */}
          {jumbo.isJumbo && (
            <div style={{
              background: "rgba(245, 158, 11, 0.06)",
              borderLeft: `3px solid ${colors.amber}`,
              borderRadius: 6, padding: 14,
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={styles.labelCompact}>Overage</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.amber }}>
                    {fmt(jumbo.overage)}
                  </div>
                </div>
                <div>
                  <div style={styles.labelCompact}>Jumbo Premium</div>
                  <input
                    type="number" step="0.125" min="0" max="2"
                    value={jumboSpread}
                    onChange={e => onSpreadChange(parseFloat(e.target.value) || 0)}
                    style={{ ...styles.input, width: 80, padding: "4px 8px", fontSize: 13 }}
                  />
                  <div style={{ fontSize: 10, color: colors.dim, marginTop: 1 }}>% above conforming</div>
                </div>
                <div>
                  <div style={styles.labelCompact}>Effective Rate</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {effectiveRate.toFixed(3)}%
                    <span style={{ color: colors.amber, fontSize: 11, marginLeft: 4 }}>
                      (+{jumboSpread.toFixed(3)}%)
                    </span>
                  </div>
                </div>
                {impact && (
                  <div>
                    <div style={styles.labelCompact}>Monthly Impact</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.red }}>
                      +{fmt(impact.monthlyDiff)}/mo
                    </div>
                    <div style={{ fontSize: 10, color: colors.dim }}>
                      {fmt(impact.lifetimeDiff)} over life
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestion to increase down payment */}
              {suggestion && (
                <div style={{
                  background: colors.card, border: `1px solid ${colors.border}`,
                  borderRadius: 6, padding: 12, marginTop: 8,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ fontSize: 13, color: colors.text }}>
                    Increase down payment to{" "}
                    <span style={{ color: colors.green, fontWeight: 600 }}>
                      {suggestion.requiredDownPercent.toFixed(1)}%
                    </span>
                    {" "}({fmt(suggestion.requiredDownAmount)}) to stay conforming.
                    <span style={{ color: colors.dim, marginLeft: 8 }}>
                      +{fmt(suggestion.additionalDown)} more needed
                    </span>
                  </div>
                  <button
                    onClick={() => onApplySuggestion(suggestion.requiredDownPercent)}
                    style={{
                      ...styles.btn, fontSize: 11, padding: "5px 12px",
                      color: colors.green, borderColor: colors.greenDim,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
