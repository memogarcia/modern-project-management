"use client";

import { useState } from "react";
import Link from "next/link";
import { Share2, Terminal, ChevronDown, Layers, BarChart3, CalendarDays, Grid3X3, Timer } from "lucide-react";

const mcpConfig = `{
  "mcpServers": {
    "archdiagram": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "DIAGRAMS_DIR": "/absolute/path/to/mcp-server/diagrams-data"
      }
    }
  }
}`;

const features = [
  { icon: Layers, label: "Kanban Boards" },
  { icon: BarChart3, label: "Gantt Timelines" },
  { icon: CalendarDays, label: "Calendar View" },
  { icon: Grid3X3, label: "Eisenhower Matrix" },
  { icon: Timer, label: "Focus Sessions" },
  { icon: Share2, label: "Architecture Diagrams" },
];

export default function Home() {
  const [mcpOpen, setMcpOpen] = useState(false);

  return (
    <div style={{ flex: 1, background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", overflowY: "auto" }}>
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16, background: "linear-gradient(135deg, var(--foreground) 0%, var(--text-muted) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Planview
        </h1>
        <p style={{ fontSize: 18, color: "var(--text-muted)", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>
          Plan, visualize, and focus — all from a single place.
        </p>
      </div>

      {/* Main Projects card */}
      <div style={{ width: "100%", maxWidth: 560, marginBottom: 80 }}>
        <Link href="/projects" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "var(--panel-bg)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 32,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              transition: "all 0.2s ease",
              boxShadow: "var(--card-shadow)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "var(--card-shadow-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "var(--card-shadow)";
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <Layers size={20} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Projects
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
              Everything you need to plan and ship — from task boards to architecture diagrams.
            </p>

            {/* Feature pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {features.map(({ icon: Icon, label }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 20,
                  background: "var(--surface)", border: "1px solid var(--border)",
                  fontSize: 12, fontWeight: 500, color: "var(--text-muted)",
                }}>
                  <Icon size={13} strokeWidth={2} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </Link>
      </div>

      {/* MCP section */}
      <div style={{ width: "100%", maxWidth: 800 }}>
        <button
          onClick={() => setMcpOpen((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: mcpOpen ? 24 : 0, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Terminal size={18} strokeWidth={2} color="var(--foreground)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>Connect via MCP</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>Control this workspace from Claude, Copilot, or any MCP-compatible AI.</p>
          </div>
          <ChevronDown
            size={18}
            color="var(--text-muted)"
            style={{ flexShrink: 0, transition: "transform 0.2s ease", transform: mcpOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {mcpOpen && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
          {/* Step 1 */}
          <div style={{ background: "var(--panel-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Step 1 — Build the server</div>
            <pre style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", fontFamily: "monospace", fontSize: 13, color: "var(--foreground)", margin: 0, overflowX: "auto", lineHeight: 1.6 }}>{`npm --prefix mcp-server install
npm --prefix mcp-server run build`}</pre>
          </div>

          {/* Step 2 */}
          <div style={{ background: "var(--panel-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Step 2 — Add to your AI config</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>Paste into <code style={{ background: "var(--surface)", padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>claude_desktop_config.json</code> or your MCP host config:</p>
            <pre style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: "var(--foreground)", margin: 0, overflowX: "auto", lineHeight: 1.6 }}>{mcpConfig}</pre>
          </div>

          {/* Step 3 */}
          <div style={{ background: "var(--panel-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Step 3 — Available tools</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["list_projects", "List all projects"],
                ["create_project", "Create a new project"],
                ["create_kanban_task", "Add a task to a project"],
                ["add_project_session", "Create a focus session"],
                ["create_diagram", "Create a diagram"],
                ["link_diagram_to_project", "Link a diagram to a project"],
              ].map(([name, desc]) => (
                <div key={name} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <code style={{ fontSize: 12, fontFamily: "monospace", color: "var(--foreground)", background: "var(--surface)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{name}</code>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}
