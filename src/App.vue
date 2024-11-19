<template>
  <div class="app-container">
    <header>
      <div class="title">
        <div class="left-section">
          <img src="@/assets/logo.png" alt="ToDuo Logo" class="logo" />
          <h1>ToDuo</h1>
        </div>
        <div v-if="isAuthenticated" class="center-section">
          <span>welcome {{ user }}!</span>
        </div>
        <div v-if="isAuthenticated" class="right-section">
          <a @click="logout" class="p-menuitem-link logout-link">
            <span class="pi pi-sign-out"></span>
            <span>logout</span>
          </a>
        </div>
      </div>
      <div v-if="isLoading">Loading...</div>
      <div v-else-if="isAuthenticated" class="navbar">
        <Menubar :model="items" breakpoint="0px" class="menubar" />
      </div>
    </header>
    <main v-if="!isLoading">
      <router-view v-if="isAuthenticated"></router-view>
      <Login v-else />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuth0 } from "@auth0/auth0-vue";
import Menubar from "primevue/menubar";
import Login from "./components/Login.vue";

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
      setActiveItem("Dashboard");
    },
    class: computed(() => (activeItem.value === "Dashboard" ? "active-menu-item" : "")),
  },
  {
    label: "The Doings",
    icon: "pi pi-list",
    command: () => {
      router.push("/doings");
      setActiveItem("The Doings");
    },
    class: computed(() => (activeItem.value === "The Doings" ? "active-menu-item" : "")),
  },
  {
    label: "The Duo",
    icon: "pi pi-users",
    command: () => {
      router.push("/duo");
      setActiveItem("The Duo");
    },
    class: computed(() => (activeItem.value === "The Duo" ? "active-menu-item" : "")),
  },
  {
    label: "Reports",
    icon: "pi pi-chart-bar",
    command: () => {
      router.push("/report");
      setActiveItem("Reports");
    },
    class: computed(() => (activeItem.value === "Reports" ? "active-menu-item" : "")),
  },
]);
</script>

<style>
main {
  padding: 0.5rem 3rem;
}

.left-section {
  display: flex;
  align-items: center;
}

.center-section {
  flex-grow: 1;
  text-align: center;
}

.right-section {
  display: flex;
  align-items: center;
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
  margin-right: 0.5rem;
}

.logout-container {
  display: flex;
  align-items: center;
}

.logout-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
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

@media (max-width: 600px) {
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
