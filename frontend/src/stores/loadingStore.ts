import { defineStore } from 'pinia';

export const useLoadingStore = defineStore('loading', {
  state: () => ({
    isLoading: false,
    activeRequests: 0,
  }),
  actions: {
    startLoading() {
      this.activeRequests++;
      this.isLoading = true;
    },
    stopLoading() {
      this.activeRequests--;
      if (this.activeRequests <= 0) {
        this.activeRequests = 0; // Ensure it doesn't go negative
        this.isLoading = false;
      }
    },
  },
});
