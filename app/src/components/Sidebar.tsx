"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Share2, BarChart, Calendar, Moon, Sun, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const storageKey = "archdiagram.sidebar.collapsed";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const sidebarWidth = collapsed ? 64 : 260;
  const headerPadding = collapsed ? "0 12px" : "0 20px";

  const navItems = [
    { name: "Workspace", href: "/", icon: LayoutDashboard },
    { name: "Diagrams", href: "/diagrams", icon: Share2 },
    { name: "Gantt Charts", href: "/gantt", icon: BarChart },
    { name: "Calendar", href: "/calendar", icon: Calendar },
  ];

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <aside
      style={{
        width: sidebarWidth,
        background: "var(--panel-bg)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        zIndex: 50,
        transition: "width 0.15s ease",
      }}
    >
      {/* Logo / Header */}
      <div
        style={{
          height: 60,
          padding: headerPadding,
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid var(--border)",
          justifyContent: "flex-start",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title={collapsed ? "ArchDiagram" : undefined}
          >
            <Share2 size={16} strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", color: "var(--foreground)" }}>
              Workspace
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={toggleLabel}
          title={toggleLabel}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface)";
            e.currentTarget.style.color = "var(--foreground)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <ToggleIcon size={18} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, padding: collapsed ? "16px 8px" : "20px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {!collapsed && (
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 8px", marginBottom: 8 }}>
            Menu
          </div>
        )}
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: collapsed ? "10px 10px" : "8px 12px",
                borderRadius: 8,
                textDecoration: "none",
                color: isActive ? "var(--foreground)" : "var(--text-muted)",
                background: isActive ? "var(--surface-hover)" : "transparent",
                fontWeight: isActive ? 600 : 500,
                fontSize: 14,
                transition: "all 0.15s ease",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
              title={collapsed ? item.name : undefined}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--surface)";
                  e.currentTarget.style.color = "var(--foreground)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                }
              }}
            >
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? "var(--accent)" : "inherit" }} />
              {!collapsed && item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Settings */}
      <div style={{ padding: "16px 12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          onClick={toggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            fontWeight: 500,
            fontSize: 14,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface)";
            e.currentTarget.style.color = "var(--foreground)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
          aria-label={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
          title={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && (theme === "dark" ? "Light Mode" : "Dark Mode")}
        </button>
      </div>
    </aside>
  );
}
