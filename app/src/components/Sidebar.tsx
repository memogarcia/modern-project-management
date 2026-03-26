"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookMarked,
  CalendarRange,
  Component,
  Layers,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Share2,
  Sun,
  Terminal,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

const WORKSPACE_ITEMS = [
  { href: "/projects", label: "Projects", icon: CalendarRange },
  { href: "/diagrams", label: "Diagrams", icon: Share2 },
  { href: "/investigations", label: "Investigations", icon: Search },
  { href: "/patterns", label: "Patterns", icon: BookMarked },
  { href: "/design-system", label: "Design System", icon: Component },
  { href: "/mcp", label: "MCP", icon: Terminal },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const storageKey = "planview.sidebar.collapsed";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "1") {
        setCollapsed(true);
      }
    } catch {
      // Ignore localStorage failures in restricted environments.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      // Ignore localStorage failures in restricted environments.
    }
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "workspace-sidebar z-50 flex shrink-0 flex-col transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[56px] md:w-[64px]" : "w-[190px] md:w-[220px]"
      )}
    >
      <div className="flex items-start justify-between gap-1.5 px-1 pb-2 pt-1">
        {!collapsed ? (
          <Link href="/diagrams" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Layers size={15} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold tracking-[-0.02em] text-[var(--foreground)] md:text-sm">
                PlanView
              </div>
              <div className="truncate text-[11px] text-[var(--text-muted)]">
                Diagram workspace
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/diagrams" className="flex w-full items-center justify-center" title="PlanView">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Layers size={15} strokeWidth={2.2} />
            </div>
          </Link>
        )}

        <button
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150",
            collapsed
              ? "text-[var(--accent)]"
              : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          )}
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      <div className={cn("px-1", collapsed ? "pt-1" : "")}>
        {!collapsed && (
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
            Workspace
          </div>
        )}

        <nav className="flex flex-col gap-0.5">
          {WORKSPACE_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "group flex items-center rounded-md transition-all duration-150",
                  collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2 py-1.5",
                  isActive
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                )}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center transition-colors",
                    collapsed ? "h-8 w-8" : ""
                  )}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                </span>

                {!collapsed && (
                  <span className="truncate text-[13px]">{label}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 px-1 pb-2 pt-2">
        <button
          className={cn(
            "flex items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
            collapsed ? "mx-auto h-8 w-8 justify-center" : "h-8 w-8 justify-center"
          )}
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {!collapsed && (
          <div className="min-w-0">
            <div className="text-xs font-medium text-[var(--foreground)]">
              {theme === "dark" ? "Dark" : "Light"} mode
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 pb-2 pt-1 text-[11px] text-[var(--text-subtle)]">
          Ctrl/Cmd+L to auto-layout
        </div>
      )}
    </aside>
  );
}
