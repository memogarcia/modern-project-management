import { z } from "zod";
import { parseSearchParams } from "@/lib/api";
import { buildQueryString } from "@/lib/request";
import { SAFE_ENTITY_ID_RE, searchQuerySchema } from "@planview/validation";

const optionalSafeIdSchema = z
  .string()
  .trim()
  .regex(SAFE_ENTITY_ID_RE, "IDs must use only letters, numbers, underscores, and hyphens.")
  .optional();

export const investigationListQuerySchema = z.object({
  diagramId: optionalSafeIdSchema,
  nodeId: optionalSafeIdSchema,
  edgeId: optionalSafeIdSchema,
  q: z.string().trim().min(1).max(256).optional(),
});

export type InvestigationListQuery = z.infer<typeof investigationListQuerySchema>;
export type SearchMemoryQuery = z.input<typeof searchQuerySchema>;
export type InvestigationListFilters = InvestigationListQuery;
export type TroubleshootingMemoryQuery = SearchMemoryQuery;

export function buildInvestigationListQuery(filters?: InvestigationListQuery): string {
  return buildQueryString({
    diagramId: filters?.diagramId,
    nodeId: filters?.nodeId,
    edgeId: filters?.edgeId,
    q: filters?.q,
  });
}

export function parseInvestigationListQuery(request: Request): InvestigationListQuery {
  return parseSearchParams(request, investigationListQuerySchema, (searchParams) => ({
    diagramId: searchParams.get("diagramId") ?? undefined,
    nodeId: searchParams.get("nodeId") ?? undefined,
    edgeId: searchParams.get("edgeId") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  }));
}

export function buildSearchMemoryQuery(query: SearchMemoryQuery): string {
  return buildQueryString({
    q: query.q,
    diagramId: query.diagramId,
    nodeId: query.nodeId,
    edgeId: query.edgeId,
    limit: query.limit,
  });
}

export const buildTroubleshootingMemoryQuery = buildSearchMemoryQuery;

export function parseSearchMemoryQuery(request: Request) {
  return parseSearchParams(request, searchQuerySchema, (searchParams) => ({
    q: searchParams.get("q") ?? "",
    diagramId: searchParams.get("diagramId") ?? undefined,
    nodeId: searchParams.get("nodeId") ?? undefined,
    edgeId: searchParams.get("edgeId") ?? undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  }));
}

export const parseTroubleshootingMemoryQuery = parseSearchMemoryQuery;
