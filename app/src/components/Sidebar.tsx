"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Layers,
  KanbanSquare,
  BarChart3,
  Calendar,
  Grid3X3,
  Timer,
  Share2,
  Terminal,
  FolderOpen,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { KanbanProjectMeta } from "@/lib/projectTypes";
import { loadProjects, deleteProject } from "@/lib/projectStorage";

const VIEW_ITEMS = [
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "gantt", label: "Gantt", icon: BarChart3 },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "matrix", label: "Matrix", icon: Grid3X3 },
  { key: "sessions", label: "Sessions", icon: Timer },
  { key: "diagrams", label: "Diagrams", icon: Share2 },
  { key: "mcp", label: "MCP", icon: Terminal },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();

  const storageKey = "planview.sidebar.collapsed";
  const [collapsed, setCollapsed] = useState(false);
  const [projects, setProjects] = useState<KanbanProjectMeta[]>([]);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Derive active project ID from URL
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch ? projectMatch[1] : null;
  const activeView = activeProjectId ? (searchParams.get("view") || "kanban") : null;

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

  // Load projects
  const refreshProjects = useCallback(async () => {
    const list = await loadProjects();
    setProjects(list);
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  // Auto-expand active project
  useEffect(() => {
    if (activeProjectId) {
      setExpandedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Delete this project and all its data?")) return;
    await deleteProject(id);
    await refreshProjects();
    if (activeProjectId === id) {
      router.push("/projects");
    }
  };

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 z-50 transition-[width] duration-200 ease-in-out border-r border-[var(--border)] bg-[var(--panel-bg)]",
        collapsed ? "w-12" : "w-56"
      )}
    >
      {/* Logo + collapse */}
      <div className="flex h-10 items-center border-b border-[var(--border)] px-3 justify-between">
        {!collapsed && (
          <Link href="/projects" className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Layers size={13} strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold tracking-tight text-[var(--foreground)] truncate">
              Planview
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/projects" className="flex items-center justify-center w-full" title="Planview">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Layers size={13} strokeWidth={2.5} />
            </div>
          </Link>
        )}
        {!collapsed && (
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={14} />
          </button>
        )}
      </div>

      {/* Collapsed: expand button */}
      {collapsed && (
        <div className="flex items-center justify-center py-2">
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={14} />
          </button>
        </div>
      )}

      {/* Projects list */}
      <div className="flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Projects
              </span>
              <Link
                href="/projects"
                className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                title="New project"
              >
                <Plus size={12} />
              </Link>
            </div>
          </div>
        )}

        <nav className={cn("flex flex-col gap-px", collapsed ? "px-1 pt-1" : "px-2")}>
          {projects.map((project) => {
            const isActive = activeProjectId === project.id;
            const isExpanded = expandedProjectId === project.id;

            return (
              <div key={project.id}>
                {/* Project row */}
                <div
                  className={cn(
                    "group flex items-center gap-1.5 rounded-md text-[13px] transition-colors cursor-pointer",
                    collapsed ? "justify-center p-1.5" : "px-2 py-1.5",
                    isActive
                      ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                  )}
                  onClick={() => {
                    if (collapsed) {
                      router.push(`/projects/${project.id}?view=kanban`);
                      return;
                    }
                    if (isExpanded) {
                      setExpandedProjectId(null);
                    } else {
                      setExpandedProjectId(project.id);
                      router.push(`/projects/${project.id}?view=kanban`);
                    }
                  }}
                  title={collapsed ? project.name : undefined}
                >
                  {!collapsed && (
                    <ChevronRight
                      size={12}
                      className={cn(
                        "shrink-0 text-[var(--text-muted)] transition-transform duration-150",
                        isExpanded && "rotate-90"
                      )}
                    />
                  )}
                  <FolderOpen
                    size={collapsed ? 16 : 14}
                    className={cn(
                      "shrink-0",
                      isActive ? "text-[var(--accent)]" : ""
                    )}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate font-medium">{project.name}</span>
                      <button
                        onClick={(e) => void handleDeleteProject(e, project.id)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[#ef444418] hover:text-[#ef4444] transition-all"
                        title="Delete project"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>

                {/* Sub-nav (expanded, not collapsed) */}
                {!collapsed && isExpanded && (
                  <div className="ml-4 mt-px mb-1 flex flex-col gap-px border-l border-[var(--border)] pl-2">
                    {VIEW_ITEMS.map(({ key, label, icon: Icon }) => {
                      const isViewActive = isActive && activeView === key;
                      return (
                        <Link
                          key={key}
                          href={`/projects/${project.id}?view=${key}`}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1 text-[12px] font-medium transition-colors",
                            isViewActive
                              ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                              : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                          )}
                        >
                          <Icon size={13} strokeWidth={isViewActive ? 2.5 : 2} />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {projects.length === 0 && !collapsed && (
            <div className="px-2 py-4 text-center text-[11px] text-[var(--text-muted)]">
              No projects yet
            </div>
          )}
        </nav>
      </div>

      {/* Footer */}
      <div className="flex items-center border-t border-[var(--border)] p-2 gap-1">
        <button
          className={cn(
            "flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors",
            collapsed ? "h-7 w-7 mx-auto" : "h-7 w-7"
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
