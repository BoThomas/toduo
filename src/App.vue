<template>
  <div class="app-container">
    <header>
      <div class="title">
        <img src="@/assets/logo.png" alt="ToDuo Logo" class="logo" />
        <h1>ToDuo</h1>
      </div>
      <div v-if="isLoading">Loading...</div>
      <template v-else-if="isAuthenticated">
        <Menubar :model="items">
          <template #end>
            <a @click="logout" class="p-menuitem-link logout-link">
              <span class="pi pi-sign-out"></span>
              <span>logout '{{ user }}'</span>
            </a>
          </template>
        </Menubar>
      </template>
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

const items = ref([
  { label: "Dashboard", icon: "pi pi-home", command: () => router.push("/") },
  { label: "The Doings", icon: "pi pi-list", command: () => router.push("/doings") },
  { label: "The Duo", icon: "pi pi-users", command: () => router.push("/duo") },
  { label: "Reports", icon: "pi pi-chart-bar", command: () => router.push("/report") },
]);
</script>

<style>
.title {
  display: flex;
  align-items: center;
  color: var(--p-primary-color);
}

.logo {
  height: 3.5rem;
  width: 3.5rem;
  margin-right: 0.5rem;
}

.logout-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.3s;
}

.logout-link:hover {
  color: var(--p-primary-color);
}
</style>
