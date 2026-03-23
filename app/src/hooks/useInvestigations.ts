"use client";

import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { InvestigationListFilters } from "@/lib/investigationQueries";
import { listInvestigations } from "@/lib/investigationStorage";
import type { TroubleshootingSession } from "@/lib/types";

export function useInvestigations(filters?: InvestigationListFilters) {
  return useAsyncResource<TroubleshootingSession[]>(
    () => listInvestigations(filters),
    [filters?.diagramId, filters?.nodeId, filters?.edgeId, filters?.q],
    []
  );
}
