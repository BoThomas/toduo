import { ref } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';

export const usePermissions = () => {
  const auth0 = useAuth0();
  const hasSettingsPermission = ref(false);

  const checkSettingsPermission = async () => {
    try {
      const token = await auth0.getAccessTokenSilently();
      const payload = JSON.parse(atob(token.split('.')[1]));
      hasSettingsPermission.value =
        payload.permissions?.includes('settings') || false;
    } catch (error) {
      console.error('Error checking settings permission:', error);
      hasSettingsPermission.value = false;
    }
    return hasSettingsPermission.value;
  };

  return {
    hasSettingsPermission,
    checkSettingsPermission,
  };
};
