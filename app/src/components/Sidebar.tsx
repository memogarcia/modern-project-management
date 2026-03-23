"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookMarked,
  Component,
  Layers,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Share2,
  Sparkles,
  Sun,
  Terminal,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

const WORKSPACE_ITEMS = [
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
        collapsed ? "w-[64px] md:w-[76px]" : "w-[216px] md:w-[248px]"
      )}
    >
      <div className="flex items-start justify-between gap-1.5 px-1 pb-3 pt-0.5 sm:px-1.5">
        {!collapsed ? (
          <Link href="/diagrams" className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_10px_20px_rgba(66,98,255,0.22)]">
              <Layers size={15} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold tracking-[-0.03em] text-[var(--foreground)] md:text-sm">
                PlanView
              </div>
              <div className="truncate text-[11px] text-[var(--text-muted)]">
                Diagram workspace
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/diagrams" className="flex w-full items-center justify-center" title="PlanView">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_10px_20px_rgba(66,98,255,0.22)]">
              <Layers size={15} strokeWidth={2.2} />
            </div>
          </Link>
        )}

        <button
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-[16px] border transition-all duration-150",
            collapsed
              ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)] text-[var(--accent)] shadow-[0_10px_20px_rgba(66,98,255,0.12)]"
              : "border-[color:color-mix(in_srgb,var(--surface)_20%,var(--panel-border))] bg-[color:color-mix(in_srgb,var(--surface)_90%,transparent)] text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          )}
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {!collapsed && (
        <div className="mx-1 mb-2.5 rounded-[18px] border border-[var(--panel-border)] bg-[color:color-mix(in_srgb,var(--surface)_86%,transparent)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            <Sparkles size={12} className="text-[var(--accent)]" />
            Focus mode
          </div>
          <div className="text-[12px] font-semibold tracking-[-0.02em] text-[var(--foreground)] md:text-[13px]">
            Whiteboard-first incident mapping
          </div>
          <p className="mt-1 text-[10px] leading-4.5 text-[var(--text-muted)] md:text-[11px]">
            Keep diagrams, evidence, and patterns in one canvas workflow.
          </p>
        </div>
      )}

      <div className={cn("px-2", collapsed ? "pt-2" : "")}>
        {!collapsed && (
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Workspace
          </div>
        )}

        <nav className="flex flex-col gap-1.5">
          {WORKSPACE_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "group flex items-center rounded-[18px] border transition-all duration-150",
                  collapsed ? "justify-center px-0 py-2" : "gap-2 px-2 py-2",
                  isActive
                    ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)] text-[var(--accent)] shadow-[0_12px_24px_rgba(66,98,255,0.12)]"
                    : "border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] transition-colors",
                    isActive
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "bg-[color:color-mix(in_srgb,var(--surface)_86%,transparent)] group-hover:bg-[var(--surface)]"
                  )}
                >
                  <Icon size={15} strokeWidth={2.1} />
                </span>

                {!collapsed && (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium md:text-[13px]">{label}</span>
                    {isActive && (
                      <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                        Open
                      </span>
                    )}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1" />

      {!collapsed && (
        <div className="mx-2 mb-2 rounded-[20px] border border-[var(--panel-border)] bg-[color:color-mix(in_srgb,var(--surface)_88%,transparent)] px-3.5 py-3">
          <div className="text-xs font-semibold text-[var(--foreground)]">Shared workspace</div>
          <div className="mt-1 text-[11px] leading-5 text-[var(--text-muted)] md:text-xs">
            Miro-style canvas controls on the left. Mermaid and investigations stay docked on the right.
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-2 pt-2">
        <button
          className={cn(
            "flex items-center rounded-[18px] border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
            collapsed ? "mx-auto h-9 w-9 justify-center" : "h-9 w-9 justify-center"
          )}
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {!collapsed && (
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[var(--foreground)]">
              {theme === "dark" ? "Dark canvas" : "Light canvas"}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Toggle workspace contrast
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 pb-2 pt-3 text-[11px] text-[var(--text-subtle)]">
          Ctrl/Cmd+L to auto-layout
        </div>
      )}
    </aside>
  );
}
