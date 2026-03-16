import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  compact?: boolean
}

function EmptyState({ icon, title, description, action, compact, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center text-[var(--text-muted)]",
        compact ? "py-5 px-3" : "py-16 px-6",
        className
      )}
      {...props}
    >
      {icon && (
        <div className={cn("mb-3 opacity-30", compact ? "[&>svg]:h-8 [&>svg]:w-8" : "[&>svg]:h-10 [&>svg]:w-10")}>
          {icon}
        </div>
      )}
      <div className={cn("font-semibold", compact ? "text-xs" : "text-sm mb-1")}>{title}</div>
      {description && (
        <div className={cn("max-w-xs", compact ? "text-[11px]" : "text-[13px] leading-relaxed")}>{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
