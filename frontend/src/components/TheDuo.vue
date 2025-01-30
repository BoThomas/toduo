<template>
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

  <h3 class="mt-10 mb-2">Assign Shitty Points</h3>
  <div class="mb-1" :class="{ 'text-red-500': availableShittyPoints < 0 }">
    Available: {{ availableShittyPoints }}
  </div>
  <DataTable
    :value="shittyPoints"
    dataKey="id"
    responsiveLayout="scroll"
    removableSort
    paginator
    :rows="10"
    :rowsPerPageOptions="[5, 10, 20, 50]"
    size="small"
  >
    <Column field="name" header="Name" sortable></Column>
    <Column
      header="Shitty Points"
      sortable
      sortField="points"
      headerStyle="display: flex; justify-content: center;"
    >
      <template #body="slotProps">
        <div class="shitty-points-container">
          <Button
            icon="pi pi-minus"
            @click="updateShittyPoints(slotProps.data, -1)"
            class="p-button-rounded p-button-text"
          />
          <span>{{ slotProps.data.points }}</span>
          <Button
            icon="pi pi-plus"
            @click="updateShittyPoints(slotProps.data, 1)"
            class="p-button-rounded p-button-text"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Slider from 'primevue/slider';
import Select from 'primevue/select';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { useToast } from 'primevue/usetoast';
import { FilterMatchMode } from '@primevue/core/api';
import { createAPI, readAPI, updateApi } from '@/services/apiService';

const toast = useToast();
const users = ref<any>([]);

const shittyPoints = ref<any>([]);
const availableShittyPoints = ref<any>();

onMounted(async () => {
  await Promise.all([
    fetchUsers(),
    fetchShittyPoints(),
    fetchAvailableShittyPoints(),
  ]);
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

const fetchAvailableShittyPoints = async () => {
  try {
    const availableShittyPointsData = await readAPI('/shittypoints/available');
    availableShittyPoints.value = availableShittyPointsData;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load available shitty points',
      life: 3000,
    });
  }
};

const fetchShittyPoints = async () => {
  try {
    const shittyPointsData = await readAPI('/shittypoints');
    shittyPoints.value = shittyPointsData;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load shitty points',
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
      const adjustment = Math.floor(excess / otherUsers.length);
      otherUsers.forEach((user: any) => {
        user.participation_percent = Math.max(
          0,
          Math.round(user.participation_percent - adjustment),
        );
      });

      // if the sum of participation is still not 100, adjust an unlocked user that is not the changed user
      const remainingExcess =
        users.value.reduce(
          (sum: number, user: any) => sum + user.participation_percent,
          0,
        ) - 100;
      if (remainingExcess === 0) {
        return;
      }
      const remainingUser = users.value.find(
        (user: any) =>
          user.id !== changedUserId &&
          !user.locked &&
          user.participation_percent > 0,
      );
      if (remainingUser) {
        remainingUser.participation_percent -= remainingExcess;
      }
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

const updateShittyPoints = async (shittypoints: any, amount: number) => {
  try {
    let result;
    if (shittypoints.id) {
      result = await updateApi(`/shittypoints/${shittypoints.id}`, {
        points: shittypoints.points + amount,
      });
    } else {
      const newId = await createAPI('/shittypoints', {
        doing_id: shittypoints.doing_id,
        points: shittypoints.points + amount,
      });
      shittypoints.id = newId;
    }
    Promise.all([fetchShittyPoints(), fetchAvailableShittyPoints()]);
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Shitty points could not be updated',
      life: 3000,
    }); // TODO: Add error message from API
  }
};
</script>
