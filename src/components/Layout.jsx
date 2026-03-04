import { NavLink, Outlet } from "react-router-dom";
import { colors, fonts } from "../theme.js";
import { track } from "../lib/analytics.js";
import DevImportBanner from "./DevImportBanner.jsx";

const CORE_NAV = [
  { to: "/", label: "Dashboard", icon: "◈" },
  { to: "/assets", label: "Assets", icon: "▤" },
  { to: "/import", label: "Import", icon: "↑" },
  { to: "/cash", label: "Cash", icon: "$" },
  { to: "/projections", label: "Projections", icon: "⟶" },
];

const HOME_PLANNING_NAV = [
  { to: "/purchase", label: "Purchase", icon: "⌂" },
  { to: "/loans", label: "Loans", icon: "%" },
  { to: "/compare", label: "Compare", icon: "↔" },
  { to: "/readiness", label: "Readiness", icon: "◎" },
];

const VEHICLE_PLANNING_NAV = [
  { to: "/purchase", label: "Purchase", icon: "⌂" },
  { to: "/loans", label: "Loans", icon: "%" },
  { to: "/compare", label: "Compare", icon: "↔" },
  { to: "/readiness", label: "Readiness", icon: "◎" },
];

const BOTTOM_NAV = [
  { to: "/settings", label: "Settings", icon: "⚙" },
];

function NavItem({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) => `gl-nav-link${isActive ? " gl-nav-active" : ""}`}
    >
      <span className="gl-nav-icon">{item.icon}</span>
      {item.label}
    </NavLink>
  );
}

export default function Layout({ sellDate, onSellDateChange, purchaseDate, onPurchaseDateChange, lastFetch, fetchErr, fetching, onRefresh, planningMode }) {
  const planningNav = planningMode === "home" ? HOME_PLANNING_NAV
    : planningMode === "vehicle" ? VEHICLE_PLANNING_NAV
    : null;

  return (
    <div className="gl-layout" style={{ fontFamily: fonts.mono, background: colors.bg, color: colors.text, height: "100vh", display: "flex", overflow: "hidden" }}>

      {/* Sidebar */}
      <nav className="gl-sidebar">
        <div className="gl-sidebar-brand">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: colors.green,
              boxShadow: `0 0 8px ${colors.green}`,
              animation: "gl-glow-pulse 3s cubic-bezier(0.4, 0, 0.2, 1) infinite",
            }} />
            <span style={{ fontSize: 17, fontWeight: 700, color: colors.green, letterSpacing: 3 }}>
              GREEN<span style={{ opacity: 0.55 }}>LIGHT</span>
            </span>
          </div>
          <div style={{
            fontSize: 12,
            color: colors.dim,
            marginTop: 5,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}>
            Financial Planning
          </div>
        </div>

        {/* Core navigation */}
        {CORE_NAV.map(item => <NavItem key={item.to} item={item} />)}

        {/* Planning mode navigation — conditionally rendered */}
        {planningNav && (
          <>
            <div className="gl-nav-divider" />
            {planningNav.map((item, i) => (
              <div key={item.to} className="gl-nav-planning" style={{ animationDelay: `${i * 50}ms` }}>
                <NavItem item={item} />
              </div>
            ))}
          </>
        )}

        {/* Push Settings to bottom */}
        <div className="gl-nav-spacer" />

        {planningNav && <div className="gl-nav-divider" />}
        {BOTTOM_NAV.map(item => <NavItem key={item.to} item={item} />)}

        {/* Ko-fi tip */}
        <a href="https://ko-fi.com/N4N31VDFAX" target="_blank" rel="noopener noreferrer"
          className="gl-kofi"
          onClick={() => track("kofi_click")}
          aria-label="Support GreenLight on Ko-fi"
          style={{ display: "block", padding: "8px 12px", marginTop: 4, opacity: 0.5, transition: "opacity 0.2s" }}>
          <img src="https://storage.ko-fi.com/cdn/kofi2.png?v=6" alt="Buy Me a Coffee"
            width={120} height={28} decoding="async" style={{ border: 0 }} />
        </a>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>

        {/* Top bar */}
        <header className="gl-header">
          <div style={{ fontSize: 13, color: colors.dim, display: "flex", alignItems: "center", gap: 8 }}>
            {lastFetch && (
              <>
                <span className="gl-dot gl-dot-green gl-dot-pulse" />
                <span style={{ color: colors.muted }}>{lastFetch.toLocaleTimeString()}</span>
              </>
            )}
            {fetchErr && <span style={{ marginLeft: 8, color: colors.amber }}>⚠ {fetchErr}</span>}
          </div>
          <div className="gl-header-right" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              className="gl-btn gl-btn-ghost gl-btn-sm gl-header-refresh"
              onClick={onRefresh}
              disabled={fetching}
            >
              {fetching ? "↻ ..." : "↻ Refresh"}
            </button>
            <div className="gl-header-divider" />
            {planningMode && (
              <div className="gl-date-field">
                <label className="gl-date-label">PURCHASE DATE</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={e => onPurchaseDateChange(e.target.value)}
                  className="gl-date-input"
                />
              </div>
            )}
            <div className="gl-date-field">
              <label className="gl-date-label">SELL DATE</label>
              <input
                type="date"
                value={sellDate}
                onChange={e => onSellDateChange(e.target.value)}
                className="gl-date-input"
              />
            </div>
          </div>
        </header>

        <DevImportBanner />

        {/* Page content */}
        <main className="gl-main">
          <div className="gl-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
