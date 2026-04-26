import { ref } from 'vue';

type ToastType = 'completed' | 'failed' | 'skipped' | 'cleared';

const isVisible = ref(false);
const message = ref('');
const type = ref<ToastType>('completed');
let timeout: any = null;

export const useToast = () => {
  const showToast = (text: string, toastType: ToastType = 'completed') => {
    if (timeout) clearTimeout(timeout);
    
    message.value = text;
    type.value = toastType;
    isVisible.value = true;

    timeout = setTimeout(() => {
      isVisible.value = false;
    }, 2000);
  };

  return {
    isVisible,
    message,
    type,
    showToast
  };
};
