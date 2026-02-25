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
  type LucideIcon,
} from "lucide-react";
import type { FC } from "react";
import type { ShapeType } from "@/lib/types";
import { getShapeDef } from "@/lib/types";

// Map of Lucide icon names to components
const iconMap: Record<string, LucideIcon> = {
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

interface ShapeIconProps extends Omit<LucideProps, 'ref'> {
  type: ShapeType;
}

export default function ShapeIcon({ type, size = 16, ...props }: ShapeIconProps) {
  const shapeDef = getShapeDef(type);
  const Icon = iconMap[shapeDef.lucideIcon];

  if (Icon) {
    return <Icon size={size} {...props} />;
  }

  // Fallback to emoji
  return (
    <span
      style={{
        fontSize: typeof size === 'number' ? size : 16,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {shapeDef.icon}
    </span>
  );
}
