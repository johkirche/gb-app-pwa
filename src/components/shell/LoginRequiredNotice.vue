<template>
    <div class="flex items-start gap-3 rounded-lg border-l-4 border-gold bg-gold/10 px-4 py-3">
        <Info class="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
        <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{{ title }}</p>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
                <slot>{{ message }}</slot>
            </p>
            <Button variant="outline" size="sm" class="mt-3" @click="goToLogin">
                <LogIn aria-hidden="true" />
                Jetzt anmelden
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Info, LogIn } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';

/**
 * Says that one feature on this page needs an account — and only that feature.
 *
 * The counterpart to the router letting `access: 'library'` views open without a
 * session (see `src/router/index.ts`): the page stays, the reader keeps
 * everything that works offline, and the part that talks to Directus explains
 * itself here instead of failing at the tap or throwing the reader out.
 *
 * Deliberately worded around *when*, not *whether*: a session usually ends while
 * the device is offline, so "melden Sie sich an, sobald Sie wieder online sind"
 * is the honest instruction — telling someone in a train tunnel to sign in now
 * is not.
 */
withDefaults(
    defineProps<{
        /** What cannot be done, e.g. 'Synchronisieren ist nicht möglich'. */
        title?: string;
        /** Which feature needs the account, and what happens meanwhile. */
        message?: string;
    }>(),
    {
        title: 'Anmeldung erforderlich',
        message:
            'Für diese Funktion wird ein angemeldetes Konto benötigt. ' +
            'Bitte melden Sie sich an, sobald Sie wieder online sind.',
    },
);

const router = useRouter();

function goToLogin() {
    router.push('/login');
}
</script>
