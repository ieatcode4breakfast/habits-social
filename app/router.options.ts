import type { RouterConfig } from '@nuxt/schema';

export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    // Back/forward navigation: restore the browser's saved scroll position
    if (savedPosition) {
      return new Promise((resolve) => {
        // Wait for keepalive component to re-activate and render before restoring
        setTimeout(() => resolve(savedPosition), 80);
      });
    }

    // Hash links
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }

    // Default: scroll to top for new navigations
    return { top: 0 };
  },
};
