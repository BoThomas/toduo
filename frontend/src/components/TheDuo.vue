<template>
  <div class="the-duo">
    <h2 class="mb-2">The Duo</h2>
    <h3 class="mb-4">User Participation</h3>
    <div
      v-for="user in users"
      :key="user.id"
      class="field"
      style="user-select: none"
    >
      <label :for="user.id" class="m-0">{{ user.username }}</label>
      <div class="flex items-center">
        <Slider
          v-model="user.participation_percent"
          :disabled="
            user.locked ||
            (users.filter((u: any) => !u.locked).length === 1 && !user.locked)
          "
          @change="updateParticipationLive(user.id)"
          @slideend="updateParticipation"
          style="flex: 1; margin-right: 10px"
        />
        <Button
          :icon="`pi ${user.locked ? 'pi-lock' : 'pi-unlock'}`"
          @click="toggleLock(user.id)"
          :class="{ 'p-button-secondary': user.locked }"
          class="p-button-rounded p-button-text"
        />
        <span class="w-12">{{ user.participation_percent }}%</span>
      </div>
    </div>

    <h3 class="mt-8 mb-3">This Week's Assignments</h3>
    <DataTable :value="weeklyTodos" responsiveLayout="scroll">
      <Column field="doingName" header="Todo"></Column>
      <Column field="assignedUser" header="Assigned To">
        <template #body="slotProps">
          <Select
            v-model="slotProps.data.username"
            :options="users.map((user: any) => user.username)"
            @change="updateAssignment(slotProps.data)"
          />
        </template>
      </Column>
      <Column field="status" header="Status">
        <template #body="slotProps">
          <Select
            v-model="slotProps.data.status"
            :options="statusOptions"
            @change="updateAssignment(slotProps.data)"
          />
        </template>
      </Column>
    </DataTable>

    <Button
      label="Trigger Reassignment"
      @click="triggerReassignment"
      class="mt-4"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Slider from 'primevue/slider';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import {
  readAPI,
  createAPI,
  updateApi,
  deleteApi,
} from '@/services/apiService';
import { mockApi } from '@/services/mockApi';

const toast = useToast();
const users = ref<any>([]);
const weeklyTodos = ref<any>([]);
const statusOptions = [
  'waiting',
  'pending',
  'completed',
  'skipped',
  'postponed',
];

onMounted(async () => {
  await fetchUsers();
  await fetchThisWeeksTodos();
});

const fetchUsers = async () => {
  try {
    users.value = await readAPI('/users');
    users.value.forEach((user: any) => (user.locked = false)); // Initialize locked property
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load users',
      life: 3000,
    });
  }
};

const fetchThisWeeksTodos = async () => {
  try {
    weeklyTodos.value = await readAPI('/todos/this-week?allUsers=true');
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load weekly assignments',
      life: 3000,
    });
  }
};

const toggleLock = (userId: number) => {
  const user = users.value.find((user: any) => user.id === userId);
  if (user) {
    user.locked = !user.locked;
  }
};

const updateParticipationLive = async (changedUserId: number) => {
  const totalParticipation = users.value.reduce(
    (sum: number, user: any) => sum + user.participation_percent,
    0,
  );
  const excess = totalParticipation - 100;

  if (excess !== 0) {
    const otherUsers = users.value.filter(
      (user: any) => user.id !== changedUserId && !user.locked,
    );
    if (otherUsers.length === 0) {
      const changedUser = users.value.find(
        (user: any) => user.id === changedUserId,
      );
      if (changedUser) {
        changedUser.participation_percent -= excess;
      }
    } else {
      const adjustment = Math.round(excess / otherUsers.length);
      otherUsers.forEach((user: any) => {
        user.participation_percent = Math.max(
          0,
          Math.round(user.participation_percent - adjustment),
        );
      });
    }
  }
};

const updateParticipation = async () => {
  try {
    const usersParticipation = users.value.map((user: any) => ({
      id: user.id,
      participation_percent: user.participation_percent,
    }));

    await updateApi('/users/participation', usersParticipation);
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not update participation',
      life: 3000,
    });
  }
};

// for updating the user and status of the assignment
const updateAssignment = async (assignment: any) => {
  // as the select component returns the username, we need to find the user id
  const user = users.value.find((u: any) => u.username === assignment.username);
  try {
    await updateApi(`/assignments/${assignment.assignmentId}`, {
      assignedUserId: user.id,
      status: assignment.status,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not update assignment',
      life: 3000,
    });
  }
};

const triggerReassignment = async () => {
  try {
    // await fetch("/api/assignments/reassign", {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    // });
    await mockApi.triggerReassignment();
    await fetchThisWeeksTodos();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Error during reassignment',
      life: 3000,
    });
  }
};
</script>
