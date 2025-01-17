<template>
  <h2>This Week's Todos</h2>
  <div class="flex justify-end mb-2">
    <SelectButton
      v-model="currentFilter"
      :options="filterOptions"
      :allowEmpty="false"
    />
  </div>
  <DataTable
    :value="filteredTodos"
    dataKey="assignmentId"
    responsiveLayout="scroll"
    size="small"
    :rowClass="
      (data: any) => {
        return data.completed ? 'line-through  text-gray-400' : '';
      }
    "
    removableSort
    contextMenu
    v-model:contextMenuSelection="selectedTodo"
    @contextmenu.prevent="openDetailsModal"
    class="select-none"
  >
    <Column>
      <template #body="slotProps">
        <Button
          icon="pi pi-bars"
          @click="
            selectedTodo = slotProps.data;
            openDetailsModal();
          "
          variant="text"
          class="p-button-rounded p-button-primary p-button-sm"
        />
      </template>
    </Column>
    <Column header="Name" sortable sortField="doingName">
      <template #body="slotProps">
        {{ slotProps.data.doingName }}
        <span v-if="slotProps.data.doingRepeatsPerWeek > 1">
          ({{ slotProps.data.calcCounterCurrent }}/{{
            slotProps.data.calcCounterTotal
          }})
        </span>
      </template>
    </Column>
    <Column
      field="doingDescription"
      header="Description"
      sortable
      :class="{ 'hidden sm:table-cell': true }"
    ></Column>
    <Column field="doingEffort" header="Effort (min)" sortable></Column>
    <Column header="Done" sortable sortField="completed">
      <template #body="slotProps">
        <Checkbox
          v-model="slotProps.data.completed"
          @change="updateTodoStatus(slotProps.data)"
          :binary="true"
        />
      </template>
    </Column>
  </DataTable>

  <Dialog
    v-model:visible="detailsModalVisible"
    @hide="selectedTodo = null"
    header="Todo Details"
    class="mx-4"
  >
    <div class="grid grid-cols-1 gap-2">
      <p>
        <strong class="w-20 inline-block text-right mr-3">Name</strong>
        <span class="text-primary">{{ selectedTodo?.doingName }}</span>
      </p>
      <p>
        <strong class="w-20 inline-block text-right mr-3">Description</strong>
        <span class="text-primary">{{
          selectedTodo?.doingDescription || '-'
        }}</span>
      </p>
      <p>
        <strong class="w-20 inline-block text-right mr-3">Effort</strong>
        <span class="text-primary"
          >{{ selectedTodo?.doingEffort }} minutes</span
        >
      </p>
      <p>
        <strong class="w-20 inline-block text-right mr-3">Interval</strong>
        <span class="text-primary"
          >{{ selectedTodo?.doingIntervalValue }} -
          {{ selectedTodo?.doingIntervalUnit }} ({{
            selectedTodo?.doingRepeatsPerWeek
          }}x)</span
        >
      </p>
      <p>
        <strong class="w-20 inline-block text-right mr-3">User</strong>
        <span class="text-primary">{{ selectedTodo?.username }}</span>
      </p>
      <p>
        <strong class="w-20 inline-block text-right mr-3">Repetition</strong>
        <span class="text-primary"
          >{{ selectedTodo?.calcCounterCurrent }}/{{
            selectedTodo?.calcCounterTotal
          }}</span
        >
      </p>
      <p>
        <strong class="w-20 inline-block text-right mr-3">Status</strong>
        <span class="text-primary">{{
          selectedTodo?.completed ? 'Completed' : 'Pending'
        }}</span>
      </p>
    </div>
    <div class="mt-4 flex flex-col gap-3 max-w-64 mx-auto">
      <div class="flex gap-2 mt-4">
        <InputGroup>
          <Select
            v-model="selectedUserId"
            :options="users"
            optionLabel="username"
            optionValue="id"
            placeholder="Select user"
          />
          <Button label="Assign" @click="confirmReassign" />
        </InputGroup>
      </div>
      <div class="text-center">
        <Button
          label="don't need to do this"
          icon="pi pi-trash"
          class="w-full"
          :disabled="selectedTodo?.doingIntervalUnit === 'once'"
          @click="confirmStatusChange('skipped')"
        />
        <small
          v-if="selectedTodo?.doingIntervalUnit === 'once'"
          class="text-gray-500"
          >One-time doings cannot be skipped</small
        >
      </div>
      <div class="text-center">
        <Button
          :disabled="selectedTodo?.doingIntervalUnit === 'weekly'"
          label="will do this next week"
          icon="pi pi-calendar-clock"
          class="w-full"
          @click="confirmStatusChange('postponed')"
        />
        <small
          v-if="selectedTodo?.doingIntervalUnit === 'weekly'"
          class="text-gray-500"
          >Weekly doings cannot be postponed</small
        >
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import InputGroup from 'primevue/inputgroup';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { readAPI, updateApi } from '@/services/apiService';

type Todo = {
  assignmentId: number;
  status: string;
  doingId: number;
  doingName: string;
  doingDescription: string;
  doingEffort: number;
  doingIntervalUnit: string;
  doingIntervalValue: number;
  doingRepeatsPerWeek: number;
  userId: number;
  username: string;
  calcCounterCurrent: number;
  calcCounterTotal: number;
  completed: boolean;
};

const toast = useToast();
const todos = ref<Todo[]>([]);
const currentFilter = ref('pending');
const filterOptions = ['pending', 'completed', 'all'];

// details modal
const detailsModalVisible = ref(false);
const selectedTodo = ref<Todo | null>(null);
const confirm = useConfirm();
const users = ref([]);
const selectedUserId = ref();

watch(selectedTodo, (todo) => {
  if (todo) {
    selectedUserId.value = todo.userId;
  }
});

const filteredTodos = computed(() => {
  if (currentFilter.value === 'all') {
    return todos.value;
  }
  return todos.value.filter((todo) =>
    currentFilter.value === 'pending' ? !todo.completed : todo.completed,
  );
});

onMounted(async () => {
  await Promise.all([fetchTodos(), fetchUsers()]);
});

const fetchTodos = async () => {
  try {
    const response = await readAPI('/todos?status=pending,completed');
    response.forEach((todo: any) => {
      todo.completed = todo.status === 'completed';
    });
    todos.value = response;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load weekly todos',
      life: 3000,
    });
  }
};

const fetchUsers = async () => {
  try {
    users.value = await readAPI('/users');
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load users',
      life: 3000,
    });
  }
};

const confirmStatusChange = (status: string) => {
  if (!selectedTodo.value) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Data of selected todo could not be found',
      life: 3000,
    });
    return;
  }
  confirm.require({
    header: 'Confirm Status Change',
    message: `Are you sure you want to mark this todo as ${status}?`,
    defaultFocus: 'reject',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    accept: async () => {
      if (selectedTodo.value) {
        await updateTodoStatus({ ...selectedTodo.value }, status);
      }
    },
  });
};

const updateTodoStatus = async (todo: Todo, status?: string) => {
  try {
    console.log(status);
    await updateApi(`/assignments/${todo.assignmentId}`, {
      status: status || (todo.completed ? 'completed' : 'pending'),
    });
    detailsModalVisible.value = false;
    await fetchTodos();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not update todo status',
      life: 3000,
    });
  }
};

const confirmReassign = () => {
  confirm.require({
    header: 'Confirm Reassignment',
    message: 'Are you sure you want to reassign this todo?',
    defaultFocus: 'reject',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    accept: async () => {
      await reassignTodo();
    },
  });
};

const reassignTodo = async () => {
  if (selectedTodo.value === null || selectedUserId.value === null) {
    return;
  }
  try {
    await updateApi(`/assignments/${selectedTodo.value.assignmentId}`, {
      assignedUserId: selectedUserId.value,
      status: selectedTodo.value.status,
    });
    detailsModalVisible.value = false;
    await fetchTodos();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not update assignment',
      life: 3000,
    });
  }
};

const openDetailsModal = () => {
  detailsModalVisible.value = true;
};
</script>
