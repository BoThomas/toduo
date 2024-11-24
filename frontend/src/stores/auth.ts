import { defineStore } from 'pinia';
import { useAuth0 } from '@auth0/auth0-vue';

export const useAuthStore = defineStore('auth', () => {
  const auth0 = useAuth0();

  return {
    ...auth0,
  };
});
