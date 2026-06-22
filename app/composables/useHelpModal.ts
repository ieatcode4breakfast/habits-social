import { useState } from '#app';
import type { Ref } from 'vue';
import { DEFAULT_HELP_PATH, normalizeHelpPath } from '~/utils/helpCenter';

interface HelpModalState {
  isOpen: Ref<boolean>;
  activePath: Ref<string>;
  open: (path?: string) => Promise<void>;
  close: () => void;
}

export const useHelpModal = (): HelpModalState => {
  const isOpen = useState<boolean>('help-modal-open', () => false);
  const activePath = useState<string>('help-modal-active-path', () => DEFAULT_HELP_PATH);

  const open = async (path?: string) => {
    activePath.value = normalizeHelpPath(path).fullPath;
    // ponytail: Android help is online-only via system in-app browser; supersedes roadmap Phase 7 step 6 (bundled help). Ceiling: no offline help on Android. Upgrade path: bundle articles in a later phase.
    const maybeGetter = (globalThis as { useRuntimeConfig?: unknown }).useRuntimeConfig;
    if (typeof maybeGetter === 'function') {
      try {
        const config: { public?: { build?: string } } = maybeGetter() as { public?: { build?: string } };
        if (config.public?.build === 'native') {
          // ponytail: dynamic import via array join avoids Vite 6 static analysis on an uninstalled module; Phase 5B installs it and this cast still works because Capacitor's Browser.open matches this shape.
          const modName = ['@capacitor', 'browser'].join('/')
          const { Browser } = await import(modName) as { Browser: { open: (opts: { url: string; presentationStyle: 'popover' | 'fullscreen' | 'page-sheet' }) => Promise<void> } };
          await Browser.open({
            url: `https://www.habitssocial.com${activePath.value}`,
            presentationStyle: 'popover',
          });
          return;
        }
      } catch {
        // fall through to web path
      }
    }
    isOpen.value = true;
  };

  const close = () => {
    isOpen.value = false;
  };

  return {
    isOpen,
    activePath,
    open,
    close
  };
};
