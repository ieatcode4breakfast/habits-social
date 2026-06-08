<template>
  <HelpCenterUI
    mode="page"
    :active-path="activePath"
    @close="returnToApp"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

definePageMeta({
  layout: false
});

const route = useRoute();
const activePath = computed(() => `${route.path}${route.hash}`);

const returnToApp = () => {
  void navigateTo('/', { replace: true });
};
</script>
