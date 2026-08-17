<template>
    <AlertDialogTrigger v-bind="forwardedProps">
        <slot />
    </AlertDialogTrigger>
</template>

<script setup lang="ts">
import { AlertDialogTrigger, type AlertDialogTriggerProps, useForwardProps } from 'reka-ui';

const props = defineProps<AlertDialogTriggerProps>();

const forwardedProps = useForwardProps(props);
</script>
