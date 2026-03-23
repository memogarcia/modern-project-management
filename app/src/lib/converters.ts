import type { ArchEdge, DiagramNode } from "@/lib/types";
import {
  flowToMermaid as sharedFlowToMermaid,
  MermaidParseError,
  type MermaidDiagnostic,
  type MermaidSubgraph,
  mermaidToFlow as sharedMermaidToFlow,
} from "@planview/mermaid";

export { MermaidParseError, type MermaidDiagnostic, type MermaidSubgraph };

export function flowToMermaid(nodes: DiagramNode[], edges: ArchEdge[]): string {
  return sharedFlowToMermaid(nodes as unknown as never[], edges as unknown as never[]);
}

export function mermaidToFlow(
  mermaid: string,
  existingNodes?: DiagramNode[],
  existingEdges?: ArchEdge[]
): {
  nodes: DiagramNode[];
  edges: ArchEdge[];
  subgraphs: MermaidSubgraph[];
  diagnostics: MermaidDiagnostic[];
} {
  const result = sharedMermaidToFlow(mermaid, {
    nodes: (existingNodes ?? []) as unknown as never[],
    edges: (existingEdges ?? []) as unknown as never[],
  });

  return {
    nodes: result.nodes as unknown as DiagramNode[],
    edges: result.edges as unknown as ArchEdge[],
    subgraphs: result.subgraphs,
    diagnostics: result.diagnostics,
  };
}
