<template>
  <div class="space-y-4 flex flex-col items-center pb-2">
    <label v-if="label" class="text-xs font-bold text-zinc-500 uppercase tracking-widest">{{ label }}</label>
    
    <div class="flex flex-col items-center gap-4">
      <UserAvatar 
        :src="modelValue" 
        :container-class="avatarClass || 'w-24 h-24 rounded-3xl bg-black border-2 border-zinc-800 shadow-inner'"
        :icon-class="iconClass || 'w-10 h-10 text-zinc-800'"
      />

      <button 
        type="button" 
        @click="openAvatarModal"
        class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
      >
        <RefreshCw class="w-3.5 h-3.5" />
        Change Avatar
      </button>
    </div>

    <!-- Avatar Selection Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showAvatarModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-xl" @click="showAvatarModal = false"></div>
          
          <div class="relative w-full max-w-lg bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div class="flex items-start justify-between w-full sm:w-auto">
                <div>
                  <h2 class="text-2xl font-bold text-white leading-tight">Choose Avatar</h2>
                  <p class="text-zinc-500 text-sm">Pick a style that fits you</p>
                </div>
                <button @click="showAvatarModal = false" class="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer sm:hidden">
                  <XIcon class="w-5 h-5" />
                </button>
              </div>
              
              <div class="flex items-center gap-2">
                <button 
                  @click="generateAvatars"
                  class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer flex items-center gap-2 text-sm font-bold"
                >
                  <RefreshCw class="w-4 h-4" />
                  Refresh
                </button>
                <button @click="showAvatarModal = false" class="hidden sm:block p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer">
                  <XIcon class="w-5 h-5" />
                </button>
              </div>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <!-- Clear/Default Option -->
              <button 
                @click="selectAvatar('')"
                class="aspect-square rounded-2xl bg-zinc-950 border-2 border-zinc-800 flex flex-col items-center justify-center hover:border-white transition-all cursor-pointer group relative overflow-hidden"
              >
                <div class="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <UserIcon class="w-5 h-5 text-zinc-500" />
                </div>
                <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Default</span>
                <div class="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors"></div>
              </button>

              <UserAvatar 
                v-for="(avatar, index) in suggestedAvatars" 
                :key="index"
                :src="avatar"
                container-class="aspect-square rounded-2xl bg-zinc-950 border-2 border-zinc-800 hover:border-white transition-all cursor-pointer group relative"
                img-class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                @click="selectAvatar(avatar)"
                @error="handleAvatarError"
              />
            </div>

            <div class="mt-8">
              <button 
                @click="showAvatarModal = false"
                class="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { User as UserIcon, X as XIcon, RefreshCw } from 'lucide-vue-next';

const props = defineProps<{
  modelValue?: string | null;
  label?: string;
  avatarClass?: string;
  iconClass?: string;
}>();

const emit = defineEmits(['update:modelValue']);

const { showToast } = useToast();

const showAvatarModal = ref(false);
const avatarLoadError = ref(false);
const suggestedAvatars = ref<string[]>([]);

const generateAvatars = () => {
  avatarLoadError.value = false;
  const styles = ['avataaars', 'big-smile', 'bottts-neutral', 'notionists-neutral'];
  const bgColors = [
    'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 
    'f1f4f9', 'e2e8f0', 'fce7f3', 'ffedd5', 'dcfce7'
  ];
  
  const newAvatars = [];
  for (let i = 0; i < 12; i++) {
    const style = styles[Math.floor(Math.random() * styles.length)];
    const seed = Math.random().toString(36).substring(7);
    const bg = bgColors[Math.floor(Math.random() * bgColors.length)];
    newAvatars.push(`https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundColor=${bg}`);
  }
  suggestedAvatars.value = newAvatars;
};

const openAvatarModal = () => {
  generateAvatars();
  showAvatarModal.value = true;
};

const selectAvatar = (url: string) => {
  emit('update:modelValue', url);
  showAvatarModal.value = false;
};

const handleAvatarError = () => {
  if (!avatarLoadError.value) {
    avatarLoadError.value = true;
    showToast('Failed to load some avatars. Please check your connection.', 'failed');
  }
};

useModalHistory(showAvatarModal);
</script>
