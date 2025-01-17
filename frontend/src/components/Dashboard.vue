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
        <strong class="w-28 inline-block text-right mr-3">Name</strong>
        <span class="text-primary">{{ selectedTodo?.doingName }}</span>
      </p>
      <p>
        <strong class="w-28 inline-block text-right mr-3">Description</strong>
        <span class="text-primary">{{ selectedTodo?.doingDescription }}</span>
      </p>
      <p>
        <strong class="w-28 inline-block text-right mr-3">Effort</strong>
        <span class="text-primary"
          >{{ selectedTodo?.doingEffort }} minutes</span
        >
      </p>
      <p>
        <strong class="w-28 inline-block text-right mr-3">Interval</strong>
        <span class="text-primary"
          >{{ selectedTodo?.doingIntervalValue }} -
          {{ selectedTodo?.doingIntervalUnit }} ({{
            selectedTodo?.doingRepeatsPerWeek
          }}x)</span
        >
      </p>
      <p>
        <strong class="w-28 inline-block text-right mr-3">User</strong>
        <span class="text-primary">{{ selectedTodo?.username }}</span>
      </p>
      <p>
        <strong class="w-28 inline-block text-right mr-3">Repetition</strong>
        <span class="text-primary"
          >{{ selectedTodo?.calcCounterCurrent }}/{{
            selectedTodo?.calcCounterTotal
          }}</span
        >
      </p>
      <p>
        <strong class="w-28 inline-block text-right mr-3">Status</strong>
        <span class="text-primary">{{
          selectedTodo?.completed ? 'Completed' : 'Pending'
        }}</span>
      </p>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import SelectButton from 'primevue/selectbutton';
import Dialog from 'primevue/dialog';
import { useToast } from 'primevue/usetoast';
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

const filteredTodos = computed(() => {
  if (currentFilter.value === 'all') {
    return todos.value;
  }
  return todos.value.filter((todo) =>
    currentFilter.value === 'pending' ? !todo.completed : todo.completed,
  );
});

onMounted(async () => {
  await fetchTodos();
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

const updateTodoStatus = async (todo: any) => {
  try {
    await updateApi(`/assignments/${todo.assignmentId}`, {
      status: todo.completed ? 'completed' : 'pending',
    });
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

const openDetailsModal = () => {
  detailsModalVisible.value = true;
};
</script>
