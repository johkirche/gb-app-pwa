<template>
    <AlertDialog :open="isOpen" @update:open="onOpenChange">
        <AlertDialogContent class="max-w-[calc(100%-2rem)] sm:max-w-sm">
            <AlertDialogHeader>
                <AlertDialogTitle>{{ current?.title }}</AlertDialogTitle>
                <AlertDialogDescription v-if="current?.message" class="whitespace-pre-line">
                    {{ current.message }}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel v-if="current?.cancelText !== null" @click="onCancel">
                    {{ current?.cancelText }}
                </AlertDialogCancel>
                <AlertDialogAction
                    :class="
                        current?.destructive
                            ? buttonVariants({ variant: 'destructive' })
                            : undefined
                    "
                    @click="onConfirm"
                >
                    {{ current?.confirmText }}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>

<script setup lang="ts">
import { useConfirmHost } from '@/composables/useConfirm';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

const { isOpen, current, onOpenChange, onConfirm, onCancel } = useConfirmHost();
</script>
