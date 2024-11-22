<template>
  <div class="dashboard">
    <h2>Welcome, {{ username }}</h2>
    <h3>This Week's Todos</h3>
    <DataTable :value="weeklyTodos" responsiveLayout="scroll">
      <Column field="name" header="Name"></Column>
      <Column field="description" header="Description"></Column>
      <Column field="effort" header="Effort (minutes)"></Column>
      <Column header="Status">
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
import { mockApi } from '@/services/mockApi';
import { fetchApi } from '@/services/apiService';
import { useAuth0 } from '@auth0/auth0-vue';

const auth0 = useAuth0();
const username = ref('');
const weeklyTodos = ref([]);

onMounted(async () => {
  username.value = localStorage.getItem('username') || '';
  await fetchWeeklyTodos();
});

const fetchWeeklyTodos = async () => {
  try {
    const response = await fetchApi(
      '/todos/weekly',
      await auth0.getAccessTokenSilently(),
    );
    weeklyTodos.value = await response;
    //weeklyTodos.value = await mockApi.fetchTodos();
  } catch (error) {
    console.error('Error fetching weekly todos:', error);
  }
};

const updateTodoStatus = async (todo: any) => {
  try {
    // await fetch(`/api/todos/${todo.id}`, {
    //   method: "PATCH",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    //   body: JSON.stringify({ completed: todo.completed }),
    // });
    await mockApi.updateTodo(todo);
  } catch (error) {
    console.error('Error updating todo status:', error);
  }
};
</script>
