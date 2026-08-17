import { createApp } from 'vue';

import { createPinia } from 'pinia';

import App from './App.vue';
import { useAppUpdate } from './composables/useAppUpdate';
import { usePWA } from './composables/usePWA';
import { longPressDirective } from './directives/longPress';
import router from './router';
/* Design system: Tailwind v4 + tokens + fonts */
import './theme/main.css';

const pinia = createPinia();

// Initialize PWA listeners early to capture beforeinstallprompt event
const { initPWAListeners } = usePWA();
initPWAListeners();

const app = createApp(App).use(pinia).use(router);

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
