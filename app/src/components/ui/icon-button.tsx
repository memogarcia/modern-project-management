import * as React from "react"
import { cn } from "@/lib/utils"

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Hover color variant */
  hoverVariant?: "default" | "danger"
  /** Size of the button */
  size?: "sm" | "default"
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, hoverVariant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-[var(--text-muted)] transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]",
          size === "sm" && "h-6 w-6",
          size === "default" && "h-8 w-8",
          hoverVariant === "default" &&
            "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] hover:border-[var(--border)]",
          hoverVariant === "danger" &&
            "hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] hover:border-[var(--danger)]/40",
          className
        )}
        {...props}
      />
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton }
export type { IconButtonProps }
