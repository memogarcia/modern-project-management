"use client";

import { useAsyncResource } from "@/hooks/useAsyncResource";
import { loadDiagrams } from "@/lib/storage";
import type { DiagramMeta } from "@/lib/types";

export function useDiagrams() {
  return useAsyncResource<DiagramMeta[]>(() => loadDiagrams(), [], []);
}
