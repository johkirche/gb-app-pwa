import { type VariantProps, cva } from 'class-variance-authority';

export { default as Spinner } from './Spinner.vue';

export const spinnerVariants = cva('animate-spin', {
    variants: {
        size: {
            sm: 'size-4',
            default: 'size-5',
            lg: 'size-8',
        },
    },
    defaultVariants: {
        size: 'default',
    },
});

export type SpinnerVariants = VariantProps<typeof spinnerVariants>;
