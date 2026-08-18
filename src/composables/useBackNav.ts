import { useRouter } from 'vue-router';

/**
 * Hand-rolled IonBackButton semantics: pop the history if the app has one,
 * otherwise replace with the given default route (deep links, fresh PWA
 * launches). `replace` keeps the dead entry out of the history stack.
 */
export function useBackNav(defaultHref = '/tabs/lieder') {
    const router = useRouter();

    function goBack() {
        if (window.history.state?.back) {
            router.back();
        } else {
            router.replace(defaultHref);
        }
    }

    return { goBack };
}
