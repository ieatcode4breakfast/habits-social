import { format, parseISO } from 'date-fns';

const STABLE_TODAY_STATE_KEY = 'stable-today-key';

export const useStableToday = () => {
  const todayKey = useState<string>(STABLE_TODAY_STATE_KEY, () => format(new Date(), 'yyyy-MM-dd'));
  const today = computed(() => parseISO(todayKey.value));

  const refreshToday = (): void => {
    todayKey.value = format(new Date(), 'yyyy-MM-dd');
  };

  onMounted(refreshToday);

  return {
    today,
    todayKey,
    refreshToday,
  };
};
