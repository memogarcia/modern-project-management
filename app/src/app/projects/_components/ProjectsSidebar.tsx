import { Plus } from "lucide-react";
import { KanbanProjectMeta } from "@/lib/projectTypes";
import { useTranslation } from "@/lib/i18n";

export function ProjectsSidebar({ 
  projects,
  onCreateClick
}: { 
  projects: KanbanProjectMeta[];
  onCreateClick: () => void;
}) {
  const { t } = useTranslation();
  const sortedProjects = [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <aside className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border/30 bg-background lg:overflow-y-auto shrink-0">
      <div className="p-5 lg:sticky lg:top-0 space-y-6">
        {/* Stats */}
        <section className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('projects.overview', { defaultValue: 'Overview' })}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-center">
              <p className="text-lg font-semibold text-foreground">{projects.length}</p>
              <p className="text-xs text-muted-foreground">{t('projects.title', { defaultValue: 'Projects' })}</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-center">
              <p className="text-lg font-semibold text-foreground">
                {projects.reduce((acc, p) => acc + ((p as any).taskCount || 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">{t('projects.tasks', { defaultValue: 'Tasks' })}</p>
            </div>
          </div>
        </section>

        <div className="border-t border-border/30" />

        {/* Recently active */}
        <section className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('projects.recentlyActive', { defaultValue: 'Recently Active' })}
          </h3>
          <div className="space-y-2">
            {sortedProjects.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <span className="text-sm">📂</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {sortedProjects.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No active projects</p>
            )}
          </div>
        </section>

        <div className="border-t border-border/30" />

        {/* Quick create */}
        <section>
          <button 
            onClick={onCreateClick}
            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors text-sm text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('projects.newProject', { defaultValue: 'New project' })}</span>
          </button>
        </section>
      </div>
    </aside>
  );
}
