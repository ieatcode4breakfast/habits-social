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
      if (to.path !== from.path) {
        // Cross-page navigation: wait for async data (Nuxt Content) to render
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ el: to.hash, top: 80, behavior: 'smooth' });
          }, 300);
        });
      }
      // Same-page navigation: DOM is already rendered, scroll instantly
      return { el: to.hash, top: 80, behavior: 'smooth' };
    }

    // Default: scroll to top for new navigations
    return { top: 0 };
  },
};
