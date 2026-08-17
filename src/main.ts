import { createApp } from 'vue';

// Transitional: IonicVue stays installed while views are migrated wave by wave
// to Reka UI; it is removed together with the last Ionic view. Its CSS now
// lives in theme/main.css inside a demoted cascade layer.
import { IonicVue } from '@ionic/vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import { useAppUpdate } from './composables/useAppUpdate';
import { usePWA } from './composables/usePWA';
import { longPressDirective } from './directives/longPress';
import router from './router';
/* Design system: Tailwind v4 + tokens + fonts (+ layered Ionic CSS during migration) */
import './theme/main.css';
/* Legacy tokens + utility classes still used by un-migrated views */
import './theme/variables.css';

const pinia = createPinia();

// Initialize PWA listeners early to capture beforeinstallprompt event
const { initPWAListeners } = usePWA();
initPWAListeners();

// One consistent look on every device: without an explicit mode, Ionic renders
// Material on Android/desktop and iOS style on Apple devices — the congregation
// would see two different apps.
const app = createApp(App).use(IonicVue, { mode: 'ios' }).use(pinia).use(router);

// Register custom directives
app.directive('long-press', longPressDirective);

router.isReady().then(() => {
    app.mount('#app');
    // Register the service worker and show an update toast when a new version is
    // deployed. Runs after mount so the vue-sonner <Toaster /> in App.vue is
    // already listening when the (async) update/offline events fire.
    const { initUpdatePrompt } = useAppUpdate();
    initUpdatePrompt();
});
