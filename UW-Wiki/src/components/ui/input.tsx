import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-border bg-transparent px-3 py-1 text-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-foreground/40",
        "focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground/20",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
