import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-primary-600 to-primary-500 text-primary-foreground shadow-md shadow-primary-500/20 hover:brightness-110 hover:shadow-lg hover:shadow-primary-500/25',
        destructive:
          'bg-gradient-to-r from-rose-600 to-rose-500 text-destructive-foreground shadow-sm hover:brightness-110 shadow-rose-500/15',
        outline:
          'border border-border/80 bg-card/60 backdrop-blur-xs shadow-xs hover:bg-accent hover:border-primary/40 hover:text-foreground',
        secondary:
          'bg-secondary/90 text-secondary-foreground shadow-xs hover:bg-secondary',
        ghost: 'hover:bg-accent/80 hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9.5 px-4 py-2',
        sm: 'h-8.5 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-8 text-base',
        icon: 'h-9 w-9 rounded-xl',
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
