<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="modelValue" class="fixed inset-0 z-[150] flex items-center justify-center sm:p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/95 backdrop-blur-xl" @click="handleClose"></div>
        
        <!-- Modal Card -->
        <div class="relative w-full h-full sm:h-auto max-w-xl bg-zinc-925 sm:border border-zinc-800 sm:rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col overflow-hidden v-motion-slide-top">
          <!-- Header -->
          <div class="flex items-start justify-between mb-6 shrink-0 pt-8 sm:pt-0">
            <div>
              <h2 class="text-2xl font-bold text-white tracking-tight leading-tight">Choose Avatar</h2>
            </div>
            <button 
              @click="generateAvatars"
              class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold whitespace-nowrap bg-zinc-900 border border-zinc-800/50"
            >
              <RefreshCw class="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          <!-- Preview & Info -->
          <div class="flex items-center gap-4 bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 mb-6 shrink-0">
            <UserAvatar 
              :src="selectedAvatar" 
              container-class="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-inner flex-shrink-0"
              icon-class="w-8 h-8 text-zinc-600"
            />
            <div class="min-w-0">
              <span class="text-sm font-bold text-white block">Currently Selected</span>
            </div>
          </div>

          <!-- Selection Grid -->
          <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar sm:max-h-[45vh]">
            <div class="grid grid-cols-4 sm:grid-cols-5 gap-4 auto-rows-max">
              <!-- Clear/Default Option -->
              <button 
                @click="selectedAvatar = ''"
                class="w-full aspect-square min-w-0 min-h-0 rounded-full bg-zinc-950 border-2 flex flex-col items-center justify-center hover:border-zinc-500 transition-all cursor-pointer group relative overflow-hidden"
                :class="selectedAvatar === '' ? 'border-white bg-zinc-900 ring-2 ring-white/10' : 'border-zinc-850'"
              >
                <div class="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <UserIcon class="w-5 h-5 text-zinc-500" />
                </div>
                <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Default</span>
              </button>

              <!-- Dynamic Avatars -->
              <button
                v-for="(avatar, index) in suggestedAvatars" 
                :key="index"
                @click="selectedAvatar = avatar"
                class="w-full aspect-square min-w-0 min-h-0 rounded-full bg-zinc-950 border-2 transition-all cursor-pointer group relative overflow-hidden"
                :class="selectedAvatar === avatar ? 'border-white bg-zinc-900 ring-2 ring-white/10' : 'border-zinc-850 hover:border-zinc-500'"
              >
                <UserAvatar 
                  :src="avatar"
                  container-class="w-full h-full !rounded-full border-0"
                  img-class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  icon-class="w-6 h-6 text-zinc-700"
                  @error="handleAvatarError"
                />
              </button>
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="mt-auto sm:mt-8 pt-6 sm:pt-0 flex flex-col sm:flex-row items-center gap-3 shrink-0 pb-8 sm:pb-0">
            <button 
              @click="handleClose"
              class="w-full sm:w-1/3 py-4 bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 font-bold rounded-2xl transition-all cursor-pointer text-center"
            >
              Skip for now
            </button>
            <button 
              @click="saveAvatar"
              :disabled="saving"
              class="w-full sm:w-2/3 py-4 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-bold rounded-2xl transition-all cursor-pointer shadow-lg shadow-white/5 flex items-center justify-center gap-2"
            >
              <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
              {{ saving ? 'Saving Avatar...' : 'Save and Continue' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { User as UserIcon, RefreshCw, Loader2 } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue']);

const { fetchUser } = useAuth();
const { showToast } = useToast();

const selectedAvatar = ref('');
const suggestedAvatars = ref<string[]>([]);
const avatarLoadError = ref(false);
const saving = ref(false);

const generateAvatars = () => {
  avatarLoadError.value = false;
  const styles = ['avataaars', 'big-smile', 'bottts-neutral', 'notionists-neutral'];
  const bgColors = [
    'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 
    'f1f4f9', 'e2e8f0', 'fce7f3', 'ffedd5', 'dcfce7'
  ];
  
  const newAvatars = [];
  for (let i = 0; i < 11; i++) {
    const style = styles[Math.floor(Math.random() * styles.length)];
    const seed = Math.random().toString(36).substring(7);
    const bg = bgColors[Math.floor(Math.random() * bgColors.length)];
    newAvatars.push(`https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundColor=${bg}`);
  }
  suggestedAvatars.value = newAvatars;
};

const handleClose = () => {
  emit('update:modelValue', false);
};

const saveAvatar = async () => {
  saving.value = true;
  try {
    await $fetch('/api/users/me', {
      method: 'PUT',
      body: {
        photoUrl: selectedAvatar.value
      }
    });
    await fetchUser();
    showToast('Avatar saved successfully!', 'completed');
    handleClose();
  } catch (err: any) {
    showToast(err.data?.message || 'Failed to save avatar', 'failed');
  } finally {
    saving.value = false;
  }
};

const handleAvatarError = () => {
  if (!avatarLoadError.value) {
    avatarLoadError.value = true;
    showToast('Failed to load some avatars. Please check your connection.', 'failed');
  }
};

// Generate list on open
watch(() => props.modelValue, (open) => {
  if (open) {
    selectedAvatar.value = '';
    generateAvatars();
  }
});

useModalHistory(computed(() => props.modelValue), handleClose);
</script>
