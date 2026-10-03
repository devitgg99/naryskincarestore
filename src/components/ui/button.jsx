import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-[#000080] text-white hover:bg-[#000066] shadow-xs font-semibold',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs font-semibold',
        outline:
          'border border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground font-medium',
        secondary:
          'bg-secondary text-secondary-foreground border border-border/70 shadow-xs hover:bg-muted font-medium',
        ghost: 'hover:bg-accent hover:text-accent-foreground text-foreground',
        link: 'text-[#000080] dark:text-blue-400 underline-offset-4 hover:underline font-medium',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8 text-base',
        icon: 'h-9 w-9 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
