"use client";

import Link from "next/link";
import { Calendar, BarChart, Share2 } from "lucide-react";

export default function Home() {
  return (
    <div style={{ flex: 1, background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 60 }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16, background: "linear-gradient(135deg, var(--foreground) 0%, var(--text-muted) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Workspace
        </h1>
        <p style={{ fontSize: 18, color: "var(--text-muted)", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>
          Choose a tool to start planning, visualizing, and organizing your projects.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, width: "100%", maxWidth: 1000 }}>
        {/* Diagrams Card */}
        <Link href="/diagrams" style={{ textDecoration: "none" }}>
          <div style={{
            background: "var(--panel-bg)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 32,
            height: "100%",
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
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", color: "var(--accent-foreground)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <Share2 size={24} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "var(--foreground)", letterSpacing: "-0.02em" }}>Diagrams</h2>
            <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              Create and edit architecture diagrams, flowcharts, and database schemas with an intuitive node-based editor.
            </p>
          </div>
        </Link>

        {/* Gantt Card */}
        <Link href="/gantt" style={{ textDecoration: "none" }}>
          <div style={{
            background: "var(--panel-bg)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 32,
            height: "100%",
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
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", color: "var(--accent-foreground)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <BarChart size={24} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "var(--foreground)", letterSpacing: "-0.02em" }}>Gantt Charts</h2>
            <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              Plan your projects with interactive timelines, task dependencies, and progress tracking.
            </p>
          </div>
        </Link>

        {/* Calendar Card */}
        <Link href="/calendar" style={{ textDecoration: "none" }}>
          <div style={{
            background: "var(--panel-bg)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 32,
            height: "100%",
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
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", color: "var(--accent-foreground)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <Calendar size={24} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "var(--foreground)", letterSpacing: "-0.02em" }}>Calendar</h2>
            <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              View your tasks and deadlines in a familiar calendar format to manage your schedule effectively.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
