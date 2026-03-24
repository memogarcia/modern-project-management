"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import type { ArchEdge } from "@/lib/types";
import { readStoredEdgeRoute, type EdgeRoutePoint } from "@/lib/edgeRouting";

function pointsMatch(a: EdgeRoutePoint, b: EdgeRoutePoint): boolean {
  return Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
}

function buildRoundedPath(points: EdgeRoutePoint[], radius = 14): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;

    const inDx = Math.sign(current.x - previous.x);
    const inDy = Math.sign(current.y - previous.y);
    const outDx = Math.sign(next.x - current.x);
    const outDy = Math.sign(next.y - current.y);

    if ((inDx === outDx && inDy === outDy) || (inDx === 0 && inDy === 0) || (outDx === 0 && outDy === 0)) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }

    const prevDistance = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const nextDistance = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const cornerRadius = Math.min(radius, prevDistance / 2, nextDistance / 2);
    const before = {
      x: current.x - inDx * cornerRadius,
      y: current.y - inDy * cornerRadius,
    };
    const after = {
      x: current.x + outDx * cornerRadius,
      y: current.y + outDy * cornerRadius,
    };

    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }

  const last = points[points.length - 1]!;
  path += ` L ${last.x} ${last.y}`;
  return path;
}

function buildSmoothSplinePath(points: EdgeRoutePoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (points.length === 2) {
    const [start, end] = points;
    const dx = end!.x - start!.x;
    const dy = end!.y - start!.y;
    const controlOffset = Math.max(36, Math.min(120, Math.abs(dx) * 0.35 + Math.abs(dy) * 0.2));
    return `M ${start!.x} ${start!.y} C ${start!.x + Math.sign(dx || 1) * controlOffset} ${start!.y} ${end!.x - Math.sign(dx || 1) * controlOffset} ${end!.y} ${end!.x} ${end!.y}`;
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`;

  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;

    const cp1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6,
    };
    const cp2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6,
    };

    path += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;
  }

  return path;
}

function midpointAlongPath(points: EdgeRoutePoint[]): EdgeRoutePoint | null {
  if (points.length < 2) return null;

  let total = 0;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    total += Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
  }

  let remaining = total / 2;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const segment = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    if (remaining > segment) {
      remaining -= segment;
      continue;
    }

    const ratio = segment === 0 ? 0 : remaining / segment;
    return {
      x: previous.x + (current.x - previous.x) * ratio,
      y: previous.y + (current.y - previous.y) * ratio,
    };
  }

  return points[Math.floor(points.length / 2)] ?? null;
}

function SmartSmoothStepEdge(props: EdgeProps<ArchEdge>) {
  const route = readStoredEdgeRoute({
    id: props.id,
    source: props.source,
    target: props.target,
    data: props.data,
  } as ArchEdge);

  const label = props.label ?? (typeof props.data?.label === "string" ? props.data.label : undefined);
  const renderWarningLabel =
    typeof props.data?.renderWarningLabel === "string" ? props.data.renderWarningLabel : undefined;
  const renderWarningTone = props.data?.renderWarningTone === "info" ? "info" : "warning";
  const effectiveLabel = label ?? renderWarningLabel;
  const precisionStyle = {
    vectorEffect: "non-scaling-stroke",
    shapeRendering: "geometricPrecision",
  } as const;
  const effectiveStyle = renderWarningLabel
    ? {
        ...precisionStyle,
        ...(props.style ?? {}),
        stroke: renderWarningTone === "warning" ? "var(--warning)" : "var(--accent)",
        strokeDasharray: "6 4",
      }
    : {
        ...precisionStyle,
        ...(props.style ?? {}),
      };
  const effectiveLabelStyle = renderWarningLabel
    ? {
        ...(props.labelStyle ?? {}),
        fill: "var(--foreground)",
        fontWeight: 700,
      }
    : props.labelStyle;
  const effectiveLabelBgStyle = renderWarningLabel
    ? {
        ...(props.labelBgStyle ?? {}),
        fill:
          renderWarningTone === "warning"
            ? "color-mix(in srgb, var(--warning) 12%, var(--surface))"
            : "color-mix(in srgb, var(--accent) 10%, var(--surface))",
        stroke:
          renderWarningTone === "warning"
            ? "color-mix(in srgb, var(--warning) 34%, var(--border))"
            : "color-mix(in srgb, var(--accent) 30%, var(--border))",
      }
    : props.labelBgStyle;
  const hasValidRoute =
    route &&
    route.points.length >= 2 &&
    pointsMatch(route.points[0]!, { x: props.sourceX, y: props.sourceY }) &&
    pointsMatch(route.points[route.points.length - 1]!, { x: props.targetX, y: props.targetY });

  if (hasValidRoute && route) {
    const labelPoint = midpointAlongPath(route.points);
    return (
      <BaseEdge
        path={route.style === "curved" ? buildSmoothSplinePath(route.points) : buildRoundedPath(route.points)}
        label={effectiveLabel}
        labelX={labelPoint?.x}
        labelY={labelPoint?.y}
        labelStyle={effectiveLabelStyle}
        labelShowBg={props.labelShowBg ?? true}
        labelBgStyle={effectiveLabelBgStyle}
        labelBgPadding={props.labelBgPadding}
        labelBgBorderRadius={props.labelBgBorderRadius}
        interactionWidth={props.interactionWidth}
        style={effectiveStyle}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
      />
    );
  }

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: 16,
    offset: 24,
  });

  return (
    <BaseEdge
      path={path}
      label={effectiveLabel}
      labelX={labelX}
      labelY={labelY}
      labelStyle={effectiveLabelStyle}
      labelShowBg={props.labelShowBg ?? Boolean(renderWarningLabel)}
      labelBgStyle={effectiveLabelBgStyle}
      labelBgPadding={props.labelBgPadding}
      labelBgBorderRadius={props.labelBgBorderRadius}
      interactionWidth={props.interactionWidth}
      style={effectiveStyle}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
    />
  );
}

export default memo(SmartSmoothStepEdge);
