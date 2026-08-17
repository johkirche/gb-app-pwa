import { type VariantProps, cva } from 'class-variance-authority';

export { default as Badge } from './Badge.vue';

export const badgeVariants = cva(
    'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-transparent px-2 py-0.5 text-xs font-medium [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground',
                secondary: 'bg-secondary text-secondary-foreground',
                destructive: 'bg-destructive text-destructive-foreground',
                outline: 'border-border bg-transparent text-foreground',
                gold: 'border-gold/40 bg-transparent text-gold',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
