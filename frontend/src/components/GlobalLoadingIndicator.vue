<template>
  <div v-if="loadingStore.isLoading" class="global-loading-indicator">
    <ProgressBar mode="indeterminate" style="height: 6px"></ProgressBar>
  </div>
</template>

<script setup lang="ts">
import { useLoadingStore } from '@/stores/loadingStore';
import ProgressBar from 'primevue/progressbar';

const loadingStore = useLoadingStore();
</script>

<style scoped>
.global-loading-indicator {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 9999; /* Ensure it's on top of other content */
}
</style>
