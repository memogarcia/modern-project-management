"use client";

import { useAsyncResource } from "@/hooks/useAsyncResource";
import { loadProjects } from "@/lib/ganttStorage";
import type { ProjectSummary } from "@/lib/ganttTypes";

export function useProjects() {
  return useAsyncResource<ProjectSummary[]>(() => loadProjects(), [], []);
}
