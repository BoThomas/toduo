<template>
  <Toast />
  <ConfirmDialog class="max-w-lg m-5" />
  <div class="app-container">
    <header>
      <div class="absolute cursor-pointer" style="top: 0.8rem; left: 1.2rem">
        <span class="text-2xl text-primary" @click="toggleDarkMode">
          <span v-if="isDarkMode" class="pi pi-sun"></span>
          <span v-else class="pi pi-moon"></span>
        </span>
      </div>
      <div
        class="flex items-center text-primary justify-between flex-col sm:flex-row"
      >
        <div class="flex-1"></div>
        <div class="flex items-center gap-1">
          <img
            src="@/assets/logo.png"
            alt="ToDuo Logo"
            class="h-16 w-16 mb-2"
          />
          <h1>ToDuo</h1>
        </div>
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
              <span class="pi pi-sign-out"></span>
              <span>logout</span>
            </a>
          </div>
        </div>
      </div>
      <div v-if="isLoading">Loading...</div>
      <div
        v-else-if="isAuthenticated"
        class="sm:flex sm:flex-col sm:items-center sm:my-2 mt-6 mb-2"
      >
        <Menubar :model="items" breakpoint="0px" class="menubar" />
      </div>
    </header>
    <main v-if="!isLoading && isAuthenticated" class="py-2 sm:px-8 px-4 mb-10">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth0 } from '@auth0/auth0-vue';
import { useToast } from 'primevue/usetoast';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Menubar from 'primevue/menubar';
import { readAPI } from '@/services/apiService';
import PullToRefresh from 'pulltorefreshjs';

const router = useRouter();
const auth0 = useAuth0();
const toast = useToast();

const isLoading = computed(() => auth0.isLoading.value);
const isAuthenticated = computed(() => auth0.isAuthenticated.value);
const user = computed(() => auth0.user.value?.nickname);

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

  PullToRefresh.init({
    mainElement: 'body',
    onRefresh() {
      window.location.reload();
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

const items = ref([
  {
    label: 'Dashboard',
    icon: 'pi pi-home',
    command: () => {
      router.push('/');
    },
    class: computed(() => (activeItem.value === '/' ? 'active-menu-item' : '')),
  },
  {
    label: 'Doings',
    icon: 'pi pi-list',
    command: () => {
      router.push('/doings');
    },
    class: computed(() =>
      activeItem.value === '/doings' ? 'active-menu-item' : '',
    ),
  },
  {
    label: 'Duo',
    icon: 'pi pi-users',
    command: () => {
      router.push('/duo');
    },
    class: computed(() =>
      activeItem.value === '/duo' ? 'active-menu-item' : '',
    ),
  },
  {
    label: 'Reports',
    icon: 'pi pi-chart-bar',
    command: () => {
      router.push('/report');
    },
    class: computed(() =>
      activeItem.value === '/report' ? 'active-menu-item' : '',
    ),
  },
  {
    label: 'Settings',
    icon: 'pi pi-cog',
    command: () => {
      router.push('/settings');
      setActiveItem('/settings');
    },
    class: computed(() =>
      activeItem.value === '/settings' ? 'active-menu-item' : '',
    ),
  },
]);

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
.ptr--ptr {
  background-color: var(--p-primary-100);
}

.ptr--text,
.ptr--icon {
  color: var(--p-primary-500) !important;
}

.active-menu-item div {
  background-color: var(--p-primary-100) !important;
}

.menubar .p-menubar-root-list {
  margin: auto;
}

@media (max-width: 640px) {
  .menubar .p-menubar-root-list {
    flex-direction: column;
    margin: auto;
  }

  .menubar .p-menubar-root-list > li {
    width: 100%;
    text-align: center;
  }

  .menubar .p-menubar-root-list > li div {
    padding: 0.2rem 1.5rem;
  }
}
</style>
