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
  const hasValidRoute =
    route &&
    route.points.length >= 2 &&
    pointsMatch(route.points[0]!, { x: props.sourceX, y: props.sourceY }) &&
    pointsMatch(route.points[route.points.length - 1]!, { x: props.targetX, y: props.targetY });

  if (hasValidRoute && route) {
    const labelPoint = midpointAlongPath(route.points);
    return (
      <BaseEdge
        path={buildRoundedPath(route.points)}
        label={label}
        labelX={labelPoint?.x}
        labelY={labelPoint?.y}
        labelStyle={props.labelStyle}
        labelShowBg={props.labelShowBg ?? true}
        labelBgStyle={props.labelBgStyle}
        labelBgPadding={props.labelBgPadding}
        labelBgBorderRadius={props.labelBgBorderRadius}
        interactionWidth={props.interactionWidth}
        style={props.style}
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
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={props.labelStyle}
      labelShowBg={props.labelShowBg}
      labelBgStyle={props.labelBgStyle}
      labelBgPadding={props.labelBgPadding}
      labelBgBorderRadius={props.labelBgBorderRadius}
      interactionWidth={props.interactionWidth}
      style={props.style}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
    />
  );
}

export default memo(SmartSmoothStepEdge);
