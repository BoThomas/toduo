<template>
  <div class="app-container">
    <header>
      <h1>ToDuo</h1>
      <div v-if="isLoading">Loading...</div>
      <template v-else-if="isAuthenticated">
        <div>Hello, {{ user }}</div>
        <nav>
          <router-link to="/">Dashboard</router-link> | <router-link to="/doings">The Doings</router-link> | <router-link to="/duo">The Duo</router-link> | <router-link to="/report">Reports</router-link> |
          <a href="#" @click.prevent="logout">Logout</a>
        </nav>
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
</script>

<style scoped>
.app-container {
  font-family: Arial, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  margin-bottom: 20px;
}

nav {
  margin-top: 10px;
}

nav a {
  margin-right: 10px;
  text-decoration: none;
  color: #333;
}

nav a.router-link-active {
  font-weight: bold;
}
</style>
