import { KanbanProjectMeta } from "@/lib/projectTypes";
import { MoreVertical, GitBranch, LayoutGrid } from "lucide-react";
import { useRouter } from "next/navigation";

export function ProjectCard({ 
  project, 
  onDelete 
}: { 
  project: KanbanProjectMeta & { taskCount?: number; epicCount?: number; color?: string; icon?: string };
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  
  // Deterministic color based on id if not provided
  const colors = ["#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#06B6D4"];
  const color = project.color || colors[project.id.charCodeAt(0) % colors.length] || colors[0];
  const icon = project.icon || "📂";

  return (
    <div 
      onClick={() => router.push(`/projects/${project.id}`)}
      className="group relative rounded-xl border border-border/40 bg-card p-4 hover:border-border/70 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center text-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive"
          title="Delete project"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="text-sm font-semibold text-foreground truncate">{project.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {project.description || "No description provided."}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <LayoutGrid className="h-3 w-3" />
          {project.epicCount || 0}
        </span>
        <span className="flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          {project.taskCount || 0}
        </span>
        <span className="ml-auto">
          {new Date(project.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
