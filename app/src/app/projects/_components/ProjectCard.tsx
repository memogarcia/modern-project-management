import { KanbanProjectMeta } from "@/lib/projectTypes";
import { Trash2, Layers, KanbanSquare, BarChart3, Calendar, Grid3X3, Timer, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ProjectCard({ 
  project, 
  onDelete 
}: { 
  project: KanbanProjectMeta & { taskCount?: number; epicCount?: number };
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  
  return (
    <Card 
      onClick={() => router.push(`/projects/${project.id}`)}
      className="group cursor-pointer hover:border-[var(--accent)]"
    >
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <div className="flex flex-col gap-1.5 overflow-hidden">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--accent)] shrink-0" />
            <CardTitle className="truncate">{project.name}</CardTitle>
          </div>
          {project.description && (
            <CardDescription className="truncate">{project.description}</CardDescription>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10"
          onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
          title="Delete project"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex gap-3 text-[11px] text-[var(--text-muted)] font-medium">
          {project.epicCount !== undefined && <span>{project.epicCount} epics</span>}
          {project.taskCount !== undefined && <span>{project.taskCount} tasks</span>}
        </div>
      </CardContent>

      <CardFooter className="pt-0 flex items-center justify-between">
        <div className="flex gap-1.5">
          {[
            { icon: KanbanSquare, label: "Kanban", color: "#3b82f6" },
            { icon: BarChart3, label: "Gantt", color: "#f59e0b" },
            { icon: Calendar, label: "Calendar", color: "#22c55e" },
            { icon: Grid3X3, label: "Matrix", color: "#8b5cf6" },
            { icon: Timer, label: "Sessions", color: "#06b6d4" },
            { icon: Share2, label: "Diagrams", color: "#ec4899" },
          ].map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              title={label}
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ backgroundColor: `${color}15`, color }}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
          ))}
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">
          Updated {new Date(project.updatedAt).toLocaleDateString()}
        </span>
      </CardFooter>
    </Card>
  );
}
