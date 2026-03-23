import type { Node, Edge } from "@xyflow/react";
import type {
  ArtifactReference,
  DiagramDocument as SharedDiagramDocument,
  DiagramEdgeMetadata,
  DiagramLinkReference,
  DiagramNodeMetadata,
  DiagramSummary as SharedDiagramSummary,
  KnowledgePattern,
  SessionCommand,
  SessionComment,
  SessionTimelineEntry,
  TroubleshootingSearchHit,
  TroubleshootingSession,
} from "@planview/domain";
import { NODE_SHAPE_TYPES, type NodeShapeType } from "@planview/domain";

// ─── Shape Types (extensible registry) ───────────────────────────────
export type ShapeType = NodeShapeType;

export interface ShapeDefinition {
  type: ShapeType;
  label: string;
  icon: string; // emoji fallback
  lucideIcon: string; // lucide icon name (e.g. "Cog", "Database")
  defaultWidth: number;
  defaultHeight: number;
  color: string;
  darkColor: string; // background color for dark mode
  borderColor: string;
  description: string;
  mermaidShape: "rect" | "cylinder" | "stadium" | "hexagon" | "circle" | "diamond" | "trapezoid";
}

// ─── Shape Registry ──────────────────────────────────────────────────
export const SHAPE_REGISTRY: Record<ShapeType, ShapeDefinition> = {
  service: {
    type: "service",
    label: "Service",
    icon: "⚙️",
    lucideIcon: "Cog",
    defaultWidth: 180,
    defaultHeight: 70,
    color: "#e3f2fd",
    darkColor: "#1e3a5f",
    borderColor: "#2196f3",
    description: "Application service or microservice",
    mermaidShape: "rect",
  },
  database: {
    type: "database",
    label: "Database",
    icon: "🗄️",
    lucideIcon: "Database",
    defaultWidth: 160,
    defaultHeight: 80,
    color: "#e8f5e9",
    darkColor: "#1b3a26",
    borderColor: "#4caf50",
    description: "Database or data store",
    mermaidShape: "cylinder",
  },
  gateway: {
    type: "gateway",
    label: "Gateway / LB",
    icon: "🔀",
    lucideIcon: "Network",
    defaultWidth: 180,
    defaultHeight: 70,
    color: "#f3e5f5",
    darkColor: "#3b1f4a",
    borderColor: "#9c27b0",
    description: "Load balancer, API gateway, or reverse proxy",
    mermaidShape: "stadium",
  },
  queue: {
    type: "queue",
    label: "Queue / Broker",
    icon: "📨",
    lucideIcon: "MailPlus",
    defaultWidth: 180,
    defaultHeight: 70,
    color: "#fff8e1",
    darkColor: "#4a2f10",
    borderColor: "#ff9800",
    description: "Message queue or event broker",
    mermaidShape: "hexagon",
  },
  client: {
    type: "client",
    label: "Client",
    icon: "🖥️",
    lucideIcon: "Monitor",
    defaultWidth: 160,
    defaultHeight: 70,
    color: "#e0f7fa",
    darkColor: "#0f3038",
    borderColor: "#00bcd4",
    description: "Browser, mobile, or desktop client",
    mermaidShape: "stadium",
  },
  cloud: {
    type: "cloud",
    label: "Cloud / Region",
    icon: "☁️",
    lucideIcon: "Cloud",
    defaultWidth: 200,
    defaultHeight: 80,
    color: "#f8fafc",
    darkColor: "#1e293b",
    borderColor: "#64748b",
    description: "Cloud provider, network, or region boundary",
    mermaidShape: "rect",
  },
  cache: {
    type: "cache",
    label: "Cache",
    icon: "⚡",
    lucideIcon: "Zap",
    defaultWidth: 160,
    defaultHeight: 70,
    color: "#ffebee",
    darkColor: "#3b1414",
    borderColor: "#f44336",
    description: "In-memory cache (Redis, Memcached)",
    mermaidShape: "diamond",
  },
  storage: {
    type: "storage",
    label: "Storage",
    icon: "📦",
    lucideIcon: "HardDrive",
    defaultWidth: 160,
    defaultHeight: 70,
    color: "#f9fbe7",
    darkColor: "#2a3510",
    borderColor: "#cddc39",
    description: "Object storage, file system, or blob storage",
    mermaidShape: "cylinder",
  },
  function: {
    type: "function",
    label: "Function",
    icon: "λ",
    lucideIcon: "Code",
    defaultWidth: 160,
    defaultHeight: 70,
    color: "#e8eaf6",
    darkColor: "#1a1f3f",
    borderColor: "#3f51b5",
    description: "Serverless function or lambda",
    mermaidShape: "trapezoid",
  },
  container: {
    type: "container",
    label: "Container",
    icon: "🐳",
    lucideIcon: "Container",
    defaultWidth: 160,
    defaultHeight: 70,
    color: "#e1f5fe",
    darkColor: "#0c2f4a",
    borderColor: "#03a9f4",
    description: "Docker container or pod",
    mermaidShape: "rect",
  },
  custom: {
    type: "custom",
    label: "Custom",
    icon: "🔧",
    lucideIcon: "Wrench",
    defaultWidth: 180,
    defaultHeight: 70,
    color: "#f5f5f5",
    darkColor: "#2a2a2a",
    borderColor: "#9e9e9e",
    description: "Custom component",
    mermaidShape: "rect",
  },
};

// ─── Node Data ───────────────────────────────────────────────────────
export interface ArchNodeData {
  label: string;
  shapeType: ShapeType;
  description?: string;
  icon?: string;
  metadata?: DiagramNodeMetadata;
  // Custom style overrides
  color?: string;        // background color override
  borderColor?: string;  // border color override
  animated?: boolean;    // pulse animation
  [key: string]: unknown;
}

// ─── Group Node Data ─────────────────────────────────────────────────
export interface GroupNodeData {
  label: string;
  color?: string;        // background color
  borderColor?: string;  // border color
  [key: string]: unknown;
}

// ─── Database Schema Node ────────────────────────────────────────────
export interface SchemaColumn {
  name: string;
  type: string;
  constraint?: "primary" | "foreign" | "unique" | "nullable";
}

export interface DatabaseSchemaNodeData {
  label: string;           // table name
  schema: SchemaColumn[];  // columns
  [key: string]: unknown;
}

// ─── Text Node Data ────────────────────────────────────────────────
export interface TextNodeData {
  text: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  [key: string]: unknown;
}

export type ArchNode = Node<ArchNodeData, "archNode">;
export type DatabaseSchemaNode = Node<DatabaseSchemaNodeData, "databaseSchemaNode">;
export type GroupNode = Node<GroupNodeData, "groupNode">;
export type TextNode = Node<TextNodeData, "textNode">;
export type DiagramNode = ArchNode | DatabaseSchemaNode | GroupNode | TextNode;

export type ArchEdge = Edge & {
  data?: {
    label?: string;
    protocol?: string;
    metadata?: DiagramEdgeMetadata;
    // Custom style overrides
    strokeColor?: string;
    strokeWidth?: number;
    [key: string]: unknown;
  };
};

// ─── Diagram Model ──────────────────────────────────────────────────
export type DiagramMeta = SharedDiagramSummary;

export interface Diagram extends Omit<SharedDiagramDocument, "nodes" | "edges"> {
  nodes: DiagramNode[];
  edges: ArchEdge[];
}

export type {
  ArtifactReference,
  DiagramEdgeMetadata,
  DiagramLinkReference,
  DiagramNodeMetadata,
  KnowledgePattern,
  SessionCommand,
  SessionComment,
  SessionTimelineEntry,
  TroubleshootingSearchHit,
  TroubleshootingSession,
};

// ─── Helpers ─────────────────────────────────────────────────────────
export function getShapeDef(type: ShapeType): ShapeDefinition {
  return SHAPE_REGISTRY[type] ?? SHAPE_REGISTRY.custom;
}

export function getAllShapeTypes(): ShapeType[] {
  return [...NODE_SHAPE_TYPES];
}

/**
 * Returns a contrasting text color (dark or white) based on background luminance.
 * Works for hex colors (#rrggbb), rgb(), and rgba() formats.
 */
export function getContrastTextColor(bg: string): string {
  let r = 0, g = 0, b = 0;
  if (bg.startsWith("#")) {
    const hex = bg.replace("#", "");
    const full = hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex;
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else {
    const match = bg.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      r = parseInt(match[1], 10);
      g = parseInt(match[2], 10);
      b = parseInt(match[3], 10);
    }
  }
  // W3C relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1a1a2e" : "#ffffff";
}
