<template>
  <div class="dashboard">
    <h2>Welcome, {{ username }}</h2>
    <h3 class="mb-2">This Week's Todos</h3>
    <DataTable
      :value="thisWeeksTodos"
      responsiveLayout="scroll"
      :rowClass="
        (data) => {
          return data.completed ? 'line-through  text-gray-400' : '';
        }
      "
    >
      <Column field="doing.name" header="Name"></Column>
      <Column field="doing.description" header="Description"></Column>
      <Column
        field="doing.effort_in_minutes"
        header="Effort (minutes)"
      ></Column>
      <Column header="Completed">
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
import { readAPI, updateApi } from '@/services/apiService';

const username = ref('');
const thisWeeksTodos = ref([]);

onMounted(async () => {
  username.value = localStorage.getItem('username') || '';
  await fetchThisWeeksTodos();
});

const fetchThisWeeksTodos = async () => {
  try {
    const response = await readAPI('/todos/this-week');
    response.forEach((todo: any) => {
      todo.completed = todo.status === 'completed';
    });
    thisWeeksTodos.value = response;
  } catch (error) {
    console.error('Error fetching weekly todos:', error);
  }
};

const updateTodoStatus = async (todo: any) => {
  try {
    await updateApi(`/todos/${todo.id}`, {
      completed: todo.completed,
    });
  } catch (error) {
    console.error('Error updating todo status:', error);
  }
};
</script>
