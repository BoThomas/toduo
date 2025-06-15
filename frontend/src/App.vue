<template>
  <GlobalLoadingIndicator />
  <Toast />
  <ConfirmDialog class="max-w-lg m-5" />
  <div class="app-container">
    <header class="mb-6 sm:mb-0">
      <div
        class="absolute cursor-pointer z-20"
        style="top: 0.8rem; left: 1.2rem"
      >
        <span class="text-2xl text-primary" @click="toggleDarkMode">
          <span v-if="isDarkMode" class="pi pi-sun"></span>
          <span v-else class="pi pi-moon"></span>
        </span>
      </div>
      <div
        class="flex items-center text-primary justify-between flex-col sm:flex-row"
      >
        <div class="flex-1 sm:hidden">
          <!-- Hamburger Menu Button -->
          <Button
            icon="pi pi-bars"
            @click="isMobileNavOpen = !isMobileNavOpen"
            class="p-button-text text-primary text-2xl absolute"
            style="top: 0.5rem; right: 0.5rem; z-index: 1051"
          />
        </div>
        <div class="flex-1 hidden sm:block"></div>
        <!-- Spacer for larger screens -->
        <router-link
          to="/"
          class="flex items-center gap-1 cursor-pointer"
          @click="isMobileNavOpen = false"
        >
          <img
            src="@/assets/logo.png"
            alt="ToDuo Logo"
            class="h-16 w-16 mb-2"
          />
          <h1>ToDuo</h1>
        </router-link>
        <div class="flex-1 justify-end">
          <div
            v-if="isAuthenticated"
            class="flex gap-1 flex-col items-center sm:items-end sm:mr-2"
          >
            <span>welcome {{ user }}!</span>
            <a
              @click="logout"
              class="p-menuitem-link flex items-center gap-2 cursor-pointer text-gray-400 transition-colors duration-300 hover:text-primary"
            >
              <span class="pi pi-sign-out text-xs"></span>
              <span class="text-xs">logout</span>
            </a>
          </div>
        </div>
      </div>
      <div v-if="isLoading" class="flex h-80 justify-center items-center">
        <ProgressSpinner strokeWidth="3" />
      </div>
      <!-- Desktop Menubar -->
      <div
        v-else-if="isAuthenticated"
        class="hidden sm:flex sm:flex-col sm:items-center sm:my-2 mt-6 mb-2"
      >
        <Menubar :model="menuItems" breakpoint="0px" class="menubar" />
      </div>

      <!-- Mobile Sidebar -->
      <Sidebar
        v-if="isAuthenticated"
        v-model:visible="isMobileNavOpen"
        position="right"
        class="sm:hidden w-full max-w-xs"
      >
        <Menubar :model="menuItems" breakpoint="0px" class="menubar-mobile" />
      </Sidebar>
    </header>
    <main v-if="!isLoading && isAuthenticated" class="py-2 sm:px-8 px-4 mb-10">
      <router-view :key="changeThisIdToRerenderRouter"></router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner';
import { ref, watch, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth0 } from '@auth0/auth0-vue';
import { useToast } from 'primevue/usetoast';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Button from 'primevue/button';
import Sidebar from 'primevue/sidebar';
import Menubar from 'primevue/menubar';
import GlobalLoadingIndicator from '@/components/GlobalLoadingIndicator.vue';
import { readAPI } from '@/services/apiService';
import PullToRefresh from 'pulltorefreshjs';
import { usePermissions } from '@/composables/usePermissions';

const router = useRouter();
const auth0 = useAuth0();
const toast = useToast();
const { hasSettingsPermission, checkSettingsPermission } = usePermissions();
const isMobileNavOpen = ref(false);

const isLoading = computed(() => auth0.isLoading.value);
const isAuthenticated = computed(() => auth0.isAuthenticated.value);
const user = computed(
  () => auth0.user.value?.name ?? auth0.user.value?.nickname,
);
const changeThisIdToRerenderRouter = ref(0);

const logout = () => {
  auth0.logout({
    logoutParams: {
      returnTo: window.location.origin,
    },
  });
};

const isDarkMode = ref(localStorage.getItem('darkMode') === 'true');
onMounted(() => {
  document.documentElement.classList.toggle('dark-mode', isDarkMode.value);

  // add pull to refresh to every page
  PullToRefresh.init({
    mainElement: 'body',
    onRefresh() {
      changeThisIdToRerenderRouter.value++;
    },
  });
});
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.classList.toggle('dark-mode', isDarkMode.value);
  localStorage.setItem('darkMode', isDarkMode.value.toString());
};

const activeItem = ref('Dashboard');

const setActiveItem = (label: string) => {
  activeItem.value = label;
};

const menuItems = computed(() => {
  const items = [
    {
      label: 'Dashboard',
      icon: 'pi pi-home',
      command: () => {
        router.push('/');
        isMobileNavOpen.value = false;
      },
      class: activeItem.value === '/' ? 'active-menu-item' : '',
    },
    {
      label: 'Doings',
      icon: 'pi pi-list',
      command: () => {
        router.push('/doings');
        isMobileNavOpen.value = false;
      },
      class: activeItem.value === '/doings' ? 'active-menu-item' : '',
    },
    {
      label: 'Duo',
      icon: 'pi pi-users',
      command: () => {
        router.push('/duo');
        isMobileNavOpen.value = false;
      },
      class: activeItem.value === '/duo' ? 'active-menu-item' : '',
    },
    {
      label: 'Reports',
      icon: 'pi pi-chart-bar',
      command: () => {
        router.push('/report');
        isMobileNavOpen.value = false;
      },
      class: activeItem.value === '/report' ? 'active-menu-item' : '',
    },
  ];

  // Add Settings menu item only if user has permission
  if (hasSettingsPermission.value) {
    items.push({
      label: 'Settings',
      icon: 'pi pi-cog',
      command: () => {
        router.push('/settings');
        setActiveItem('/settings');
        isMobileNavOpen.value = false;
      },
      class: activeItem.value === '/settings' ? 'active-menu-item' : '',
    });
  }

  return items;
});

// Check settings permission when user is authenticated
watch(
  isAuthenticated,
  (authenticated) => {
    if (authenticated) {
      checkSettingsPermission();
    }
  },
  { immediate: true },
);

// auth
watch(isLoading, (nowLoading) => {
  if (!nowLoading) {
    if (!isAuthenticated.value) {
      // Try to login if not authenticated and not loading
      const targetUrl = window.location.pathname;
      //const appState = { target: targetUrl };
      // TODO: auth0 appState is not working
      // save the target url to local storage to redirect after login
      localStorage.setItem('targetUrl', targetUrl);
      auth0.loginWithRedirect(); //{ appState });
    } else {
      // redirect to the target url after login
      const targetUrl = localStorage.getItem('targetUrl');
      if (targetUrl) {
        localStorage.removeItem('targetUrl');
        router.push(targetUrl);
        setActiveItem(targetUrl);
      }
    }
  }
});

const checkShittyPointsMinus = async () => {
  try {
    const availableShittyPoints = await readAPI('/shittypoints/available');
    if (availableShittyPoints < 0) {
      toast.add({
        severity: 'warn',
        summary: 'Warning',
        detail:
          'Your shitty points are in the negative. Remove some shitty points or they will be removed automatically on the next assignment day.',
        life: 10000,
      });
      return;
    }
  } catch (error) {
    console.log('Error checking shitty points', error);
  }
};

// Before each route navigation
router.beforeEach((to, from, next) => {
  setActiveItem(to.path); // Set active menu item
  if (isAuthenticated.value) {
    checkShittyPointsMinus();
  }
  next();
});
</script>

<style>
/* Pull to refresh */
.ptr--ptr {
  background-color: var(--p-primary-100);
}

.ptr--text,
.ptr--icon {
  color: var(--p-primary-500) !important;
}

/* Progress Spinner */
.p-progressspinner-circle {
  stroke: var(--p-primary-500) !important;
}

/* Menubar */
.active-menu-item div {
  background-color: var(--p-primary-100) !important;
}

.menubar .p-menubar-root-list {
  margin: auto;
}

/* Styling for Menubar inside mobile Sidebar */
.menubar-mobile .p-menubar-root-list {
  flex-direction: column;
  width: 100%;
}

.menubar-mobile .p-menubar-root-list > li {
  width: 100%;
}

.menubar-mobile
  .p-menubar-root-list
  > li
  > .p-menuitem-content
  > .p-menuitem-link {
  justify-content: flex-start; /* Align items to the start */
  padding: 0.75rem 1rem;
}

.menubar-mobile .p-menuitem-text {
  margin-left: 0.5rem;
}
</style>
