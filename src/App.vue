<template>
  <div class="app-container">
    <header>
      <div class="dark-mode-toggle">
        <span class="icon" @click="toggleDarkMode">
          <span v-if="isDarkMode" class="pi pi-sun"></span>
          <span v-else class="pi pi-moon"></span>
        </span>
      </div>
      <div class="title">
        <div class="left-section"></div>
        <div class="center-section">
          <img src="@/assets/logo.png" alt="ToDuo Logo" class="logo" />
          <h1>ToDuo</h1>
        </div>
        <div class="right-section">
          <div v-if="isAuthenticated" class="welcome-logout">
            <span>welcome {{ user }}!</span>
            <a @click="logout" class="p-menuitem-link logout-link">
              <span class="pi pi-sign-out"></span>
              <span>logout</span>
            </a>
          </div>
        </div>
      </div>
      <div v-if="isLoading">Loading...</div>
      <div v-else-if="isAuthenticated" class="navbar">
        <Menubar :model="items" breakpoint="0px" class="menubar" />
      </div>
    </header>
    <main v-if="!isLoading && isAuthenticated">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth0 } from "@auth0/auth0-vue";
import Menubar from "primevue/menubar";

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

const isDarkMode = ref(localStorage.getItem("darkMode") === "true");
onMounted(() => {
  document.documentElement.classList.toggle("dark-mode", isDarkMode.value);
});
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.classList.toggle("dark-mode", isDarkMode.value);
  localStorage.setItem("darkMode", isDarkMode.value);
};

const activeItem = ref("Dashboard");

const setActiveItem = (label) => {
  activeItem.value = label;
};

const items = ref([
  {
    label: "Dashboard",
    icon: "pi pi-home",
    command: () => {
      router.push("/");
      setActiveItem("/");
    },
    class: computed(() => (activeItem.value === "/" ? "active-menu-item" : "")),
  },
  {
    label: "The Doings",
    icon: "pi pi-list",
    command: () => {
      router.push("/doings");
      setActiveItem("/doings");
    },
    class: computed(() => (activeItem.value === "/doings" ? "active-menu-item" : "")),
  },
  {
    label: "The Duo",
    icon: "pi pi-users",
    command: () => {
      router.push("/duo");
      setActiveItem("/duo");
    },
    class: computed(() => (activeItem.value === "/duo" ? "active-menu-item" : "")),
  },
  {
    label: "Reports",
    icon: "pi pi-chart-bar",
    command: () => {
      router.push("/report");
      setActiveItem("/report");
    },
    class: computed(() => (activeItem.value === "/report" ? "active-menu-item" : "")),
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
      localStorage.setItem("targetUrl", targetUrl);
      auth0.loginWithRedirect(); //{ appState });
    } else {
      // redirect to the target url after login
      const targetUrl = localStorage.getItem("targetUrl");
      if (targetUrl) {
        localStorage.removeItem("targetUrl");
        console.log("redirecting to", targetUrl);
        router.push(targetUrl);
        setActiveItem(targetUrl);
      }
    }
  }
});
</script>

<style>
main {
  padding: 0.5rem 3rem;
}

.left-section {
  flex: 1;
}

.center-section {
  display: flex;
  align-items: center;
}

.right-section {
  display: flex;
  justify-content: flex-end;
  flex: 1;
}

.title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  color: var(--p-primary-color);
  flex-wrap: wrap;
}

.logo {
  height: 3.5rem;
  width: 3.5rem;
  margin-bottom: 0.5rem;
}

.welcome-logout {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-right: 0.5rem;
}

.logout-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--p-zinc-500);
  transition: color 0.3s;
}

.logout-link:hover {
  color: var(--p-primary-color);
}

.navbar {
  margin: 1rem 0;
}

.active-menu-item div {
  background-color: var(--p-primary-100) !important;
}

.menubar .p-menubar-root-list {
  margin: auto;
}

.dark-mode-toggle {
  position: fixed;
  top: 1rem;
  left: 1rem;
  cursor: pointer;
}

.dark-mode-toggle .icon {
  font-size: 1.5rem;
  color: var(--p-primary-color);
}

@media (max-width: 600px) {
  main {
    padding: 0.5rem 1rem;
  }

  .title {
    flex-direction: column;
    align-items: center;
  }

  .center-section,
  .right-section {
    width: 100%;
    justify-content: center;
  }

  .center-section {
    text-align: center;
  }

  .right-section {
    margin-bottom: 1rem;
  }

  .welcome-logout {
    align-items: center;
    margin-right: 0;
  }

  .navbar {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .menubar {
    width: 100%;
  }

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
