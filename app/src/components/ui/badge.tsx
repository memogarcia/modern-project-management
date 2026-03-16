import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string
  variant?: "subtle" | "outline"
  size?: "sm" | "default"
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, color, variant = "subtle", size = "default", style, ...props }, ref) => {
    const colorStyles: React.CSSProperties = color
      ? {
          ...(variant === "subtle"
            ? { backgroundColor: `${color}18`, color }
            : { borderColor: `${color}40`, color }),
          ...style,
        }
      : { ...style }

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded font-semibold leading-none whitespace-nowrap",
          variant === "subtle" && "bg-[var(--surface-hover)] text-[var(--text-muted)]",
          variant === "outline" && "border bg-transparent text-[var(--text-muted)]",
          size === "sm" && "px-1.5 py-0.5 text-[10px]",
          size === "default" && "px-2 py-1 text-[11px]",
          className
        )}
        style={colorStyles}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
export type { BadgeProps }
