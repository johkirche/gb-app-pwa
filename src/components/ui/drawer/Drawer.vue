<template>
    <DrawerRoot v-bind="forwarded">
        <slot />
    </DrawerRoot>
</template>

<script setup lang="ts">
import { useForwardPropsEmits } from 'reka-ui';
import { DrawerRoot, type DrawerRootEmits, type DrawerRootProps } from 'vaul-vue';

const props = withDefaults(defineProps<DrawerRootProps>(), {
    shouldScaleBackground: false,
});

const emits = defineEmits<DrawerRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>
