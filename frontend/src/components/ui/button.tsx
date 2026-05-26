import { ButtonHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:   'bg-gradient-primary text-white shadow-glow-sm hover:shadow-glow hover:opacity-90 border border-primary/30',
  secondary: 'bg-card text-foreground border border-border hover:bg-card-hover hover:border-border-light',
  ghost:     'bg-transparent text-muted-light hover:text-foreground hover:bg-card border border-transparent',
  outline:   'bg-transparent text-primary-light border border-primary/40 hover:bg-primary/10 hover:border-primary/60',
  danger:    'bg-danger/10 text-red-300 border border-danger/30 hover:bg-danger/20 hover:border-danger/50',
  success:   'bg-success/10 text-green-300 border border-success/30 hover:bg-success/20 hover:border-success/50',
};

const sizes: Record<Size, string> = {
  xs: 'px-2 py-1 text-[11px] gap-1',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
};

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={twMerge(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
