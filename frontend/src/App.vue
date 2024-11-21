<template>
  <div class="app-container">
    <header>
      <div class="fixed cursor-pointer" style="top: 0.8rem; left: 1.2rem">
        <span
          class="text-2xl"
          style="color: var(--p-primary-color)"
          @click="toggleDarkMode"
        >
          <span v-if="isDarkMode" class="pi pi-sun"></span>
          <span v-else class="pi pi-moon"></span>
        </span>
      </div>
      <div
        class="flex align-items-center justify-content-between flex-column sm:flex-row"
        style="color: var(--p-primary-color)"
      >
        <div class="flex-1"></div>
        <div class="flex align-items-center gap-1">
          <img
            src="@/assets/logo.png"
            alt="ToDuo Logo"
            class="h-4rem w-4rem mb-2"
          />
          <h1>ToDuo</h1>
        </div>
        <div class="flex-1 justify-content-end">
          <div
            v-if="isAuthenticated"
            class="flex gap-1 flex-column align-items-center sm:align-items-end sm:mr-2"
          >
            <span>welcome {{ user }}!</span>
            <a
              @click="logout"
              class="logout-link p-menuitem-link flex align-items-center gap-2 cursor-pointer"
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
        class="sm:flex sm:flex-column sm:align-items-center sm:my-2 mt-4 mb-2"
      >
        <Menubar :model="items" breakpoint="0px" class="menubar" />
      </div>
    </header>
    <main v-if="!isLoading && isAuthenticated" class="py-2 sm:px-5 px-3">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth0 } from '@auth0/auth0-vue';
import Menubar from 'primevue/menubar';

const router = useRouter();
const auth0 = useAuth0();

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
});
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.classList.toggle('dark-mode', isDarkMode.value);
  localStorage.setItem('darkMode', isDarkMode.value);
};

const activeItem = ref('Dashboard');

const setActiveItem = (label) => {
  activeItem.value = label;
};

const items = ref([
  {
    label: 'Dashboard',
    icon: 'pi pi-home',
    command: () => {
      router.push('/');
      setActiveItem('/');
    },
    class: computed(() => (activeItem.value === '/' ? 'active-menu-item' : '')),
  },
  {
    label: 'The Doings',
    icon: 'pi pi-list',
    command: () => {
      router.push('/doings');
      setActiveItem('/doings');
    },
    class: computed(() =>
      activeItem.value === '/doings' ? 'active-menu-item' : '',
    ),
  },
  {
    label: 'The Duo',
    icon: 'pi pi-users',
    command: () => {
      router.push('/duo');
      setActiveItem('/duo');
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
      setActiveItem('/report');
    },
    class: computed(() =>
      activeItem.value === '/report' ? 'active-menu-item' : '',
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
        console.log('redirecting to', targetUrl);
        router.push(targetUrl);
        setActiveItem(targetUrl);
      }
    }
  }
});
</script>

<style>
.logout-link {
  color: var(--p-zinc-500);
  transition: color 0.3s;
}

.logout-link:hover {
  color: var(--p-primary-color);
}

.active-menu-item div {
  background-color: var(--p-primary-100) !important;
}

.menubar .p-menubar-root-list {
  margin: auto;
}

@media (max-width: 576px) {
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
