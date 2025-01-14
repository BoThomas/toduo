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
      (data) => {
        return data.completed ? 'line-through  text-gray-400' : '';
      }
    "
    removableSort
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import SelectButton from 'primevue/selectbutton';
import { useToast } from 'primevue/usetoast';
import { readAPI, updateApi } from '@/services/apiService';

type Todo = {
  assignmentId: number;
  doingName: string;
  doingDescription: string;
  doingEffort: number;
  doingRepeatsPerWeek: number;
  calcCounterCurrent: number;
  calcCounterTotal: number;
  completed: boolean;
};

const toast = useToast();
const todos = ref<Todo[]>([]);
const currentFilter = ref('pending');
const filterOptions = ['pending', 'completed', 'all'];

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
</script>
