import ELK, { type ElkNode, type ElkExtendedEdge } from "elkjs/lib/elk.bundled.js";
import type { ArchNode, ArchEdge, DiagramNode, ArchNodeData, DatabaseSchemaNodeData } from "@/lib/types";
import { getShapeDef } from "@/lib/types";

const elk = new ELK();

const DEFAULT_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "60",
  "elk.spacing.edgeNode": "40",
  "elk.layered.spacing.nodeNodeBetweenLayers": "80",
  "elk.layered.spacing.edgeNodeBetweenLayers": "40",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
};

export async function autoLayout(
  nodes: DiagramNode[],
  edges: ArchEdge[]
): Promise<DiagramNode[]> {
  if (nodes.length === 0) return nodes;

  const elkNodes: ElkNode[] = nodes.map((node) => {
    if (node.type === "databaseSchemaNode") {
      const schema = (node.data as DatabaseSchemaNodeData).schema ?? [];
      const height = Math.max(80, 40 + schema.length * 24);
      return {
        id: node.id,
        width: 240,
        height,
      };
    }
    const shapeDef = getShapeDef((node.data as ArchNodeData).shapeType);
    return {
      id: node.id,
      width: shapeDef.defaultWidth,
      height: shapeDef.defaultHeight,
    };
  });

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph: ElkNode = {
    id: "root",
    layoutOptions: DEFAULT_LAYOUT_OPTIONS,
    children: elkNodes,
    edges: elkEdges,
  };

  const layouted = await elk.layout(graph);

  return nodes.map((node) => {
    const elkNode = layouted.children?.find((n) => n.id === node.id);
    if (elkNode) {
      return {
        ...node,
        position: {
          x: elkNode.x ?? node.position.x,
          y: elkNode.y ?? node.position.y,
        },
      };
    }
    return node;
  });
}
