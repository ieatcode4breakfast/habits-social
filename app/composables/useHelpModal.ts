import { useState } from '#app';
import type { Ref } from 'vue';
import { DEFAULT_HELP_PATH, normalizeHelpPath } from '~/utils/helpCenter';

interface HelpModalState {
  isOpen: Ref<boolean>;
  activePath: Ref<string>;
  open: (path?: string) => void;
  close: () => void;
}

export const useHelpModal = (): HelpModalState => {
  const isOpen = useState<boolean>('help-modal-open', () => false);
  const activePath = useState<string>('help-modal-active-path', () => DEFAULT_HELP_PATH);

  const open = (path?: string) => {
    activePath.value = normalizeHelpPath(path).fullPath;
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
