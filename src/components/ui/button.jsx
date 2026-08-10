import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

const buttonVariants = cva(
	'ag-cut-sm inline-flex items-center justify-center text-sm font-bold uppercase tracking-[0.08em] ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default:
          'border border-[#fff1a6]/30 bg-[linear-gradient(118deg,var(--layout-accent)_0%,#ffe457_100%)] text-[#070707] shadow-[0_18px_36px_-24px_var(--layout-accent)] hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0',
				destructive:
          'bg-red-600 text-white hover:-translate-y-0.5 hover:bg-red-500 active:translate-y-0',
				outline:
          'border border-[var(--layout-border)] bg-[var(--layout-surface)] text-[var(--layout-text)] hover:-translate-y-0.5 hover:border-[var(--layout-accent)] hover:bg-[var(--layout-surface-2)] active:translate-y-0',
				secondary:
          'bg-[var(--layout-surface-2)] text-[var(--layout-text)] hover:-translate-y-0.5 hover:bg-[var(--layout-border)] active:translate-y-0',
				ghost: 'text-[var(--layout-text)] hover:bg-[var(--layout-surface-2)]',
				link: 'text-[var(--layout-text)] underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-4 py-2',
				sm: 'h-9 px-3',
				lg: 'h-11 px-8',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';
	return (
		<Comp
			className={cn(buttonVariants({ variant, size, className }))}
			ref={ref}
			{...props}
		/>
	);
});
Button.displayName = 'Button';

export { Button, buttonVariants };
