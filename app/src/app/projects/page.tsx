"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { KanbanProjectMeta } from "@/lib/projectTypes";
import { loadProjects } from "@/lib/projectStorage";
import { useProjectStore } from "@/store/projectStore";
import { Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<KanbanProjectMeta[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const initNewProject = useProjectStore((s) => s.initNewProject);

  useEffect(() => {
    loadProjects().then(setProjects);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setActionError(null);
    try {
      const id = await initNewProject(newName.trim(), newDesc.trim() || undefined);
      setShowCreate(false);
      router.push(`/projects/${id}?view=diagrams`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create project");
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      {/* Top header bar — aligned with sidebar header */}
      <div className="flex h-10 items-center border-b border-[var(--border)] px-4 shrink-0">
        <span className="text-sm font-semibold text-[var(--foreground)]">Systems</span>
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-lg font-bold tracking-tight">Systems</h1>
            <Button size="sm" onClick={() => {
              setNewName("");
              setNewDesc("");
              setActionError(null);
              setShowCreate(true);
            }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New
            </Button>
          </div>

          {actionError && (
            <div className="mb-4 rounded-lg border border-[var(--danger)] bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
              {actionError}
            </div>
          )}

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--text-muted)]">
              <Layers className="mb-4 h-10 w-10 opacity-20" />
              <div className="mb-2 text-sm font-medium">No projects yet</div>
              <div className="mb-6 max-w-sm text-xs">
                Create a system workspace to map architecture and retain troubleshooting memory.
              </div>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Project
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}?view=diagrams`)}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-bg)] px-4 py-3 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
                >
                  <Layers className="h-4 w-4 text-[var(--accent)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--foreground)] truncate">
                      {project.name}
                    </div>
                    {project.description && (
                      <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                        {project.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New System</DialogTitle>
            <DialogDescription>
              Create a system workspace for diagrams, investigations, and MCP context.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Q3 Roadmap"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Brief description…"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
