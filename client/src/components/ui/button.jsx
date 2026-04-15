import React from 'react';
import { cn } from '../../lib/utils.js';

const variants = {
  default:     'bg-primary text-primary-foreground hover:opacity-90',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
  outline:     'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground hover:border-primary/50',
  secondary:   'bg-secondary text-secondary-foreground hover:opacity-80',
  ghost:       'hover:bg-accent hover:text-accent-foreground',
  link:        'text-primary underline-offset-4 hover:underline',
};
const sizes = {
  default: 'h-10 px-4 py-2 text-sm',
  sm:      'h-8 px-3 text-xs rounded-md',
  lg:      'h-11 px-8 text-base rounded-md',
  icon:    'h-10 w-10',
};

export const Button = React.forwardRef(({ className, variant = 'default', size = 'default', ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      'active:scale-[0.97]',
      variants[variant], sizes[size], className
    )}
    {...props}
  />
));
Button.displayName = 'Button';
