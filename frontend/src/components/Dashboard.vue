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
      <Column header="Name">
        <template #body="slotProps">
          {{ slotProps.data.doingName }}
          <span v-if="slotProps.data.doingRepetition === 'daily'">
            ({{ slotProps.data.calcCounterCurrent }}/{{
              slotProps.data.calcCounterTotal
            }})
          </span>
        </template>
      </Column>
      <Column field="doingDescription" header="Description"></Column>
      <Column field="doingEffort" header="Effort (minutes)"></Column>
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
import { useToast } from 'primevue/usetoast';
import { readAPI, updateApi } from '@/services/apiService';

const toast = useToast();
const username = ref('');
const thisWeeksTodos = ref([]);

onMounted(async () => {
  username.value = localStorage.getItem('username') || '';
  await fetchThisWeeksTodos();
});

const fetchThisWeeksTodos = async () => {
  try {
    const response = await readAPI('/todos/this-week?status=pending,completed');
    response.forEach((todo: any) => {
      todo.completed = todo.status === 'completed';
    });
    thisWeeksTodos.value = response;
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
    await fetchThisWeeksTodos();
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
