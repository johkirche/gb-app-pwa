<template>
    <Button variant="ghost" size="icon" aria-label="Zurück" @click="goBack">
        <ChevronLeft class="!size-6" aria-hidden="true" />
    </Button>
</template>

<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next';

import { useBackNav } from '@/composables/useBackNav';

import { Button } from '@/components/ui/button';

const props = withDefaults(defineProps<{ defaultHref?: string }>(), {
    defaultHref: '/tabs/lieder',
});

const { goBack } = useBackNav(props.defaultHref);
</script>
