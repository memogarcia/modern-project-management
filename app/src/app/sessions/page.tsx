"use client";

export default function SessionsPage() {
  return (
    <div style={{ flex: 1, background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column", padding: 32, overflowY: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, color: "var(--foreground)" }}>Sessions</h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 40, marginTop: 0 }}>Track focus sessions, link your work, and stay in flow with a Pomodoro timer.</p>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--panel-bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 48 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--surface-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 20 }}>⏱</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", marginBottom: 8, letterSpacing: "-0.02em" }}>No sessions yet</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", maxWidth: 420, lineHeight: 1.6, marginBottom: 28 }}>
          Create a session to group tasks, attach diagrams and links, and start a Pomodoro timer for focused work.
        </p>
        <button
          style={{ padding: "10px 24px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "opacity 0.15s ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          + New Session
        </button>
      </div>
    </div>
  );
}
