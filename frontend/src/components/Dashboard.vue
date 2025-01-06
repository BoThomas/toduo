<template>
  <div class="dashboard">
    <h2>Welcome, {{ username }}</h2>
    <h3 class="mb-2">This Week's Todos</h3>
    <DataTable
      :value="todos"
      responsiveLayout="scroll"
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
          <span v-if="slotProps.data.doingRepetition === 'daily'">
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import { useToast } from 'primevue/usetoast';
import { readAPI, updateApi } from '@/services/apiService';

const toast = useToast();
const username = ref('');
const todos = ref([]);

onMounted(async () => {
  username.value = localStorage.getItem('username') || '';
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
