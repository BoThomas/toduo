<template>
  <div class="login-container">
    <Button label="Login" @click="login" />
  </div>
</template>

<script setup>
import Button from "primevue/button";
import { useAuth0 } from "@auth0/auth0-vue";

const auth0 = useAuth0();

const login = () => {
  auth0.loginWithRedirect();
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
</style>
