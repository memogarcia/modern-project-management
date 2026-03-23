"use client";

import { useAsyncResource } from "@/hooks/useAsyncResource";
import { listPatterns } from "@/lib/investigationStorage";
import type { KnowledgePattern } from "@/lib/types";

export function usePatterns() {
  return useAsyncResource<KnowledgePattern[]>(() => listPatterns(), [], []);
}
