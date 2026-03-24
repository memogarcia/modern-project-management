import type {
  ArchNodeData,
  DatabaseSchemaNodeData,
  DiagramNode,
  TextNodeData,
} from "@/lib/types";
import { getShapeDef } from "@/lib/types";

export type NodeSize = {
  width: number;
  height: number;
};

export type NodeRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeDisplayText(value: string | undefined): string {
  return String(value ?? "").replace(/\\n/g, "\n").trim();
}

function estimateWrappedLines(text: string, maxCharsPerLine: number): number {
  const normalized = normalizeDisplayText(text);
  if (!normalized) return 0;

  return normalized.split("\n").reduce((count, line) => {
    const trimmed = line.trim();
    if (!trimmed) return count + 1;
    return count + Math.max(1, Math.ceil(trimmed.length / maxCharsPerLine));
  }, 0);
}

function estimateLongestWrappedLine(text: string, maxCharsPerLine: number): number {
  const normalized = normalizeDisplayText(text);
  if (!normalized) return 0;

  return normalized
    .split("\n")
    .reduce((longest, line) => Math.max(longest, Math.min(maxCharsPerLine, line.trim().length)), 0);
}

function estimateArchNodeSize(node: DiagramNode): NodeSize {
  const data = node.data as ArchNodeData;
  const shapeDef = getShapeDef(data.shapeType);
  const label = normalizeDisplayText(data.label);
  const description = normalizeDisplayText(data.description);

  const labelLines = Math.max(1, estimateWrappedLines(label, 22));
  const descriptionLines = estimateWrappedLines(description, 30);
  const labelWidth = Math.max(9, estimateLongestWrappedLine(label, 22)) * 7.6;
  const descriptionWidth = Math.max(0, estimateLongestWrappedLine(description, 30)) * 6.2;
  const textWidth = Math.max(labelWidth, descriptionWidth, shapeDef.defaultWidth - 96);

  const width = clamp(
    Math.max(shapeDef.defaultWidth, 80 + textWidth),
    shapeDef.defaultWidth,
    460
  );
  const height = Math.max(
    shapeDef.defaultHeight,
    28 + labelLines * 20 + (descriptionLines > 0 ? 8 + descriptionLines * 15 : 0)
  );

  return {
    width,
    height,
  };
}

function estimateDatabaseSchemaNodeSize(node: DiagramNode): NodeSize {
  const data = node.data as DatabaseSchemaNodeData;
  const schema = data.schema ?? [];
  const tableWidth = Math.max(12, normalizeDisplayText(data.label).length) * 7.8;
  const longestColumnName = schema.reduce((max, column) => Math.max(max, column.name.length), 8);
  const longestColumnType = schema.reduce((max, column) => Math.max(max, column.type.length), 6);
  const badgeAllowance = schema.some((column) => column.constraint) ? 42 : 18;
  const rowWidth = badgeAllowance + longestColumnName * 6.9 + longestColumnType * 6.4 + 92;

  return {
    width: clamp(Math.max(240, 40 + tableWidth, rowWidth), 240, 620),
    height: Math.max(88, 58 + schema.length * 33),
  };
}

function estimateTextNodeSize(node: DiagramNode): NodeSize {
  const data = node.data as TextNodeData;
  const fontSize = typeof data.fontSize === "number" && Number.isFinite(data.fontSize) ? data.fontSize : 14;
  const text = normalizeDisplayText(data.text);
  const lines = Math.max(1, estimateWrappedLines(text, 40));
  const longest = Math.max(4, estimateLongestWrappedLine(text, 40));

  return {
    width: clamp(Math.max(80, longest * (fontSize * 0.58) + 18), 80, 520),
    height: Math.max(32, lines * (fontSize * 1.55) + 12),
  };
}

export function estimateNodeSize(node: DiagramNode): NodeSize {
  const explicitW = typeof node.width === "number" ? node.width : undefined;
  const explicitH = typeof node.height === "number" ? node.height : undefined;
  const measuredW = typeof node.measured?.width === "number" ? node.measured.width : undefined;
  const measuredH = typeof node.measured?.height === "number" ? node.measured.height : undefined;

  if (typeof explicitW === "number" && typeof explicitH === "number") {
    return { width: explicitW, height: explicitH };
  }

  if (typeof measuredW === "number" && typeof measuredH === "number") {
    return { width: measuredW, height: measuredH };
  }

  if (node.type === "databaseSchemaNode") {
    return estimateDatabaseSchemaNodeSize(node);
  }

  if (node.type === "groupNode") {
    const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
    const width =
      typeof style.width === "number" && Number.isFinite(style.width) ? style.width : 400;
    const height =
      typeof style.height === "number" && Number.isFinite(style.height) ? style.height : 300;
    return { width, height };
  }

  if (node.type === "textNode") {
    return estimateTextNodeSize(node);
  }

  return estimateArchNodeSize(node);
}

export function getNodeRect(
  node: DiagramNode,
  position: { x: number; y: number } = node.position
): NodeRect {
  const { width, height } = estimateNodeSize(node);

  return {
    left: position.x,
    top: position.y,
    right: position.x + width,
    bottom: position.y + height,
    width,
    height,
    centerX: position.x + width / 2,
    centerY: position.y + height / 2,
  };
}
