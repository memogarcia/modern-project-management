"use client";

import {
  Cog,
  Database,
  Network,
  MailPlus,
  Monitor,
  Cloud,
  Zap,
  HardDrive,
  Code,
  Container,
  Wrench,
  type LucideProps,
} from "lucide-react";
import type { FC } from "react";

const iconMap: Record<string, FC<LucideProps>> = {
  Cog,
  Database,
  Network,
  MailPlus,
  Monitor,
  Cloud,
  Zap,
  HardDrive,
  Code,
  Container,
  Wrench,
};

interface ShapeIconProps extends LucideProps {
  name: string;
  fallback?: string;
}

export default function ShapeIcon({ name, fallback, ...props }: ShapeIconProps) {
  const Icon = iconMap[name];
  if (Icon) {
    return <Icon {...props} />;
  }
  // Fallback to emoji text
  return <span style={{ fontSize: props.size ?? 16 }}>{fallback ?? "?"}</span>;
}
