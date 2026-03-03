import { Component } from "react";
import { colors, fonts } from "../theme.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        fontFamily: fonts.mono, background: colors.bg, color: colors.text,
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          background: colors.card, border: `1px solid ${colors.red}`, borderRadius: 8,
          padding: 24, maxWidth: 500, textAlign: "center",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.red, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 11, color: colors.dim, marginBottom: 16 }}>{this.state.error.message}</div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              background: colors.bgButton, border: `1px solid ${colors.border}`, color: colors.blue,
              padding: "8px 16px", borderRadius: 4, fontFamily: fonts.mono, fontSize: 11, cursor: "pointer",
            }}
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
