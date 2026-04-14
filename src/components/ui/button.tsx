"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary CTA — gradient from primary → primary-container at 135deg, with glow
        default:
          "gradient-btn text-on-primary shadow-sm hover:shadow-primary-glow-lg hover:-translate-y-0.5",
        // Glassmorphic secondary
        glass:
          "glass-surface text-on-surface hover:bg-surface-container-lowest/80",
        outline:
          "bg-transparent text-on-surface-variant ring-1 ring-outline-variant/50 hover:bg-primary-container/20 hover:text-primary hover:ring-primary/30",
        secondary:
          "bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed-dim",
        ghost:
          "text-on-surface hover:bg-surface-container-low hover:text-primary aria-expanded:bg-surface-container-low",
        destructive:
          "bg-error-container/20 text-md-error hover:bg-error-container/30 focus-visible:ring-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-lg px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 rounded-xl px-6 text-base [&_svg:not([class*='size-'])]:size-5",
        xl: "h-14 gap-2 rounded-2xl px-8 text-base font-bold [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10 rounded-xl",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-12 rounded-xl",
        pill: "h-10 gap-1.5 rounded-full px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
