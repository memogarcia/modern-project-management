"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  Share2,
  BookMarked,
  Search,
  Terminal,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

const WORKSPACE_ITEMS = [
  { href: "/diagrams", label: "Diagrams", icon: Share2 },
  { href: "/investigations", label: "Investigations", icon: Search },
  { href: "/patterns", label: "Patterns", icon: BookMarked },
  { href: "/mcp", label: "MCP", icon: Terminal },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const storageKey = "planview.sidebar.collapsed";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "1") {
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
        "z-50 flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel-bg)] transition-[width] duration-200 ease-in-out",
        collapsed ? "w-12" : "w-56"
      )}
    >
      <div className="flex h-10 items-center justify-between border-b border-[var(--border)] px-3">
        {!collapsed ? (
          <Link href="/diagrams" className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Layers size={13} strokeWidth={2.5} />
            </div>
            <span className="truncate text-sm font-bold tracking-tight text-[var(--foreground)]">
              PlanView
            </span>
          </Link>
        ) : (
          <Link href="/diagrams" className="flex w-full items-center justify-center" title="PlanView">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Layers size={13} strokeWidth={2.5} />
            </div>
          </Link>
        )}

        {!collapsed && (
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={14} />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="flex items-center justify-center py-2">
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={14} />
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="border-b border-[var(--border)] px-2 py-2">
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Workspace
          </div>
          <nav className="flex flex-col gap-px">
            {WORKSPACE_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                  )}
                >
                  <Icon size={14} className={isActive ? "text-[var(--accent)]" : ""} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center border-t border-[var(--border)] p-2">
        <button
          className={cn(
            "flex items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
            collapsed ? "mx-auto h-7 w-7" : "h-7 w-7"
          )}
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </aside>
  );
}
