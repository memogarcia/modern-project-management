export interface DiagramMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Diagram extends DiagramMeta {
  mermaidCode: string;
  nodes: unknown[];
  edges: unknown[];
}
