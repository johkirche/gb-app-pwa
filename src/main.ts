import { createApp } from 'vue';

import { IonicVue } from '@ionic/vue';
/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/display.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/float-elements.css';
/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
import '@ionic/vue/css/palettes/dark.class.css';
/* @import '@ionic/vue/css/palettes/dark.system.css'; */
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/typography.css';
import { createPinia } from 'pinia';

import App from './App.vue';
import { useAppUpdate } from './composables/useAppUpdate';
import { usePWA } from './composables/usePWA';
import { longPressDirective } from './directives/longPress';
import router from './router';
/* Theme variables */
import './theme/variables.css';

const pinia = createPinia();

// Initialize PWA listeners early to capture beforeinstallprompt event
const { initPWAListeners } = usePWA();
initPWAListeners();

// Register the service worker and show an update toast when a new version is deployed
const { initUpdatePrompt } = useAppUpdate();
initUpdatePrompt();

const app = createApp(App).use(IonicVue).use(pinia).use(router);

// Register custom directives
app.directive('long-press', longPressDirective);

router.isReady().then(() => {
    app.mount('#app');
});
