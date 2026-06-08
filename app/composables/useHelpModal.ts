import { useState } from '#app';

export const useHelpModal = () => {
  const isOpen = useState('helpModalIsOpen', () => false);
  const activePath = useState('helpModalActivePath', () => '/help-center/welcome');

  const open = (path?: string) => {
    if (path) activePath.value = path;
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
