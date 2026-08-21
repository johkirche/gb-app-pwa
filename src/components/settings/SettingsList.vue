<template>
    <!-- One block of settings rows: hairlines between them and a closing rule
         under the last, the way every section read before the tabs took over
         the headings. -->
    <section>
        <div class="divide-y divide-border">
            <slot />
        </div>
        <Separator />
    </section>
</template>

<script setup lang="ts">
import { Separator } from '@/components/ui/separator';
</script>
