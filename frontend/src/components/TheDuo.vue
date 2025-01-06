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
    <DataTable
      :value="weeklyTodos"
      responsiveLayout="scroll"
      removableSort
      v-model:filters="weeklyTodosFilters"
      :globalFilterFields="['doingName', 'username', 'status']"
    >
      <div class="flex justify-end gap-2 mb-2">
        <Button
          type="button"
          icon="pi pi-filter-slash"
          outlined
          @click="clearFilter()"
        />
        <IconField>
          <InputIcon>
            <i class="pi pi-search" />
          </InputIcon>
          <InputText
            v-model="weeklyTodosFilters['global'].value"
            placeholder="Keyword Search"
          />
        </IconField>
      </div>
      <Column header="Todo" sortable sortField="doingName">
        <template #body="slotProps">
          {{ slotProps.data.doingName }}
          <span v-if="slotProps.data.doingRepetition === 'daily'">
            ({{ slotProps.data.calcCounterCurrent }}/{{
              slotProps.data.calcCounterTotal
            }})
          </span>
        </template>
      </Column>
      <Column header="Assigned To" sortable sortField="username">
        <template #body="slotProps">
          <Select
            v-model="slotProps.data.username"
            :options="users.map((user: any) => user.username)"
            @change="updateAssignment(slotProps.data)"
          />
        </template>
      </Column>
      <Column header="Status" sortable sortField="status">
        <template #body="slotProps">
          <Select
            v-model="slotProps.data.status"
            :options="getStatusOptions(slotProps.data.doingRepetition)"
            @change="updateAssignment(slotProps.data)"
          />
        </template>
      </Column>
    </DataTable>

    <div class="mt-4 flex gap-3">
      <Button label="Trigger Reassignment" @click="confirmReassignment" />
      <Button
        :label="
          showStatusExplanation
            ? 'Hide Status Explanation'
            : 'Show Status Explanation'
        "
        @click="showStatusExplanation = !showStatusExplanation"
      />
      <Button
        :label="
          autoassignCronInfo?.running
            ? 'Stop Autoassign Cron'
            : 'Start Autoassign Cron'
        "
        @click="confirmCronControl"
      />
    </div>

    <div v-if="autoassignCronInfo?.name" class="mt-10">
      <p>The autoassign cron is currently running.</p>
      <p><strong>Cron Time:</strong> {{ autoassignCronInfo.cronTime }}</p>
      <p><strong>Next Dates:</strong></p>
      <ul class="list-disc pl-5">
        <li v-for="date in autoassignCronInfo.nextDates" :key="date">
          {{ new Date(date).toLocaleString() }}
        </li>
      </ul>
    </div>
    <div v-else class="mt-10">
      <p>The autoassign cron is currently stopped.</p>
    </div>

    <div v-if="showStatusExplanation" class="mt-10">
      <h3 class="mb-2">Status Explanation</h3>
      <ul class="list-disc pl-5">
        <li>
          <strong>Waiting:</strong> The task is waiting to be pending. Only for
          daily doings.
        </li>
        <li><strong>Pending:</strong> The task is open for completion.</li>
        <li>
          <strong>Completed:</strong> The task has been finished successfully.
        </li>
        <li>
          <strong>Skipped:</strong> The task will not be completed this
          iteration and is reassigned the next time it is due based on the
          repetition.
        </li>
        <li>
          <strong>Postponed:</strong> The task will not be completed this
          iteration but is reassigned the next week, regardless of the
          repetition. Not possible for daily and weekly doings.
        </li>
        <li>
          <strong>Failed:</strong> The task has been failed and will be
          reassigned the next week, regardless of the repetition. Can not be set
          manually.
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Slider from 'primevue/slider';
import Select from 'primevue/select';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { FilterMatchMode } from '@primevue/core/api';
import { readAPI, createAPI, updateApi } from '@/services/apiService';

const toast = useToast();
const confirm = useConfirm();
const autoassignCronInfo = ref<any>({});
const users = ref<any>([]);
const weeklyTodos = ref<any>([]);
const weeklyTodosFilters = ref<any>({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});
const showStatusExplanation = ref(false);
const STATUS_OPTIONS = [
  'waiting',
  'pending',
  'completed',
  'skipped',
  'postponed',
]; //TODO: move to type model

onMounted(async () => {
  await fetchUsers();
  await fetchThisWeeksTodos();
  await fetchAutoassignCronInfo();
});

const clearFilter = () => {
  weeklyTodosFilters.value.global.value = null;
};

const fetchAutoassignCronInfo = async () => {
  try {
    autoassignCronInfo.value = await readAPI('/doings/autoassign/cron');
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load autoassign cron info',
      life: 3000,
    });
  }
};

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

const confirmCronControl = async () => {
  confirm.require({
    header: `Are you sure you want to ${
      autoassignCronInfo.value.running ? 'stop' : 'start'
    } the autoassign cron?`,
    message: 'This only affects new future assignments.',
    defaultFocus: 'reject',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: autoassignCronInfo.value.running ? 'Stop' : 'Start',
    },
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      await controlAutoassignCron();
    },
  });
};

const controlAutoassignCron = async () => {
  try {
    if (autoassignCronInfo.value.running) {
      await updateApi('/doings/autoassign/cron', {
        enable: false,
      });
    } else {
      await updateApi('/doings/autoassign/cron', {
        enable: true,
      });
    }
    await fetchAutoassignCronInfo();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not control autoassign cron',
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
    await fetchThisWeeksTodos();
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
    await createAPI('/doings/autoassign', {
      reassign: true,
    });
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

const confirmReassignment = () => {
  confirm.require({
    header: 'Are you sure you want to reassign?',
    message: 'All current assignments will be lost and progress will be reset.',
    defaultFocus: 'reject',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: 'Reassign',
    },
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      await triggerReassignment();
    },
  });
};

// for daily and weekly todos, we don't want to show postponed status
// as it doesn't make sense because the todo will be reassigned the next day/week anyway
// only for daily todos is waiting status allowed
const getStatusOptions = (repetition: string) => {
  let options = [...STATUS_OPTIONS];
  if (repetition === 'daily' || repetition === 'weekly') {
    options = options.filter((option) => option !== 'postponed');
  }
  if (repetition !== 'daily') {
    options = options.filter((option) => option !== 'waiting');
  }
  return options;
};
</script>
