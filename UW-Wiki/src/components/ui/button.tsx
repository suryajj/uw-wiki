import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:opacity-90",
        destructive:
          "border border-[color:var(--color-destructive)] text-[color:var(--color-destructive)] hover:bg-[color:var(--color-destructive)] hover:text-background",
        outline:
          "border border-border bg-transparent text-foreground hover:border-foreground hover:bg-[color:var(--surface-2)]",
        secondary:
          "border border-border bg-transparent text-foreground hover:bg-[color:var(--surface-2)]",
        ghost:
          "text-muted-foreground hover:text-foreground hover:bg-[color:var(--surface-2)]",
        link: "text-foreground underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-full",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = Omit<React.ComponentProps<"button">, "loading"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * Show a spinner inside the button and disable interaction. The button
     * children stay visible alongside the spinner — no text swap needed.
     */
    loading?: boolean
  }

function Button(props: ButtonProps) {
  // Destructure custom props out so they NEVER reach the DOM. Note: when
  // `asChild` is true, Slot.Root forwards remaining props to the rendered
  // child — `loading` is a valid HTML attribute on <img> and <link>, so it's
  // critical we strip it here before forwarding.
  const {
    className,
    variant = "default",
    size = "default",
    asChild = false,
    loading: loadingProp,
    disabled,
    children,
    ...rest
  } = props
  const loading = loadingProp === true
  const Comp = asChild ? Slot.Root : "button"
  const isIconOnly = typeof size === "string" && size.startsWith("icon")
  const showChildren = !(loading && isIconOnly)

  // When asChild is true, Slot.Root requires EXACTLY one React child — it
  // uses React.Children.only internally. So we must pass `children` through
  // as a single element and NOT inject our spinner alongside it. asChild is
  // typically used for navigation links where loading state doesn't apply.
  const content = asChild ? (
    children
  ) : (
    <>
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {showChildren ? children : null}
    </>
  )

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...rest}
    >
      {content}
    </Comp>
  )
}

export { Button, buttonVariants }
