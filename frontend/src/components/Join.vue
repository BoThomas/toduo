<template>
  <div class="flex flex-col items-center justify-center mt-4">
    <h2 class="text-2xl font-bold mb-4">Join with Invitation Code</h2>
    <InputText
      v-model="inviteCode"
      placeholder="Enter your invite code"
      class="mb-4"
    />
    <Button label="Join" @click="join" class="mb-4" />
    <p v-if="message" :class="messageClass">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { createAPI } from '@/services/apiService';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

const inviteCode = ref('');
const message = ref('');
const messageClass = ref('');
const auth0 = useAuth0();

const join = async () => {
  const username = auth0.user.value?.nickname;
  if (!username) {
    message.value = 'You must be logged in to join';
    messageClass.value = 'text-red-500';
    return;
  }
  try {
    await createAPI('/users/join', {
      invitation_code: inviteCode.value,
      username,
    });
    message.value = 'Successfully joined, you can now use the app!';
    messageClass.value = 'text-green-500';
  } catch (error: any) {
    message.value = error.message;
    messageClass.value = 'text-red-500';
  }
};
</script>
