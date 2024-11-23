<template>
  <div class="the-doings">
    <h2 class="mb-2">The Doings</h2>
    <Dialog
      v-model:visible="dialogVisible"
      header="Todo Details"
      :modal="true"
      :style="{ width: '50vw' }"
    >
      <div class="formgrid grid grid-cols-12 gap-4">
        <div class="field col-span-12">
          <label for="name">Name</label>
          <InputText
            id="name"
            v-model="currentTodo.name"
            required
            class="w-full"
          />
        </div>
        <div class="field col-span-12">
          <label for="description">Description</label>
          <Textarea
            id="description"
            v-model="currentTodo.description"
            required
            rows="3"
            class="w-full"
          />
        </div>
        <div class="field field col-span-12">
          <label for="repetition">Repetition</label>
          <Dropdown
            id="repetition"
            v-model="currentTodo.repetition"
            :options="repetitionOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select repetition"
            class="w-full"
          />
        </div>
        <div class="field field col-span-12 lg:col-span-6">
          <label for="effort">Effort (minutes)</label>
          <InputNumber
            id="effort"
            v-model="currentTodo.effort"
            required
            class="w-full"
          />
        </div>
        <div class="field col-span-12 lg:col-span-6">
          <label for="notice">Notice (optional)</label>
          <InputText id="notice" v-model="currentTodo.notice" class="w-full" />
        </div>
        <div class="field-checkbox col-span-12 mt-2">
          <Checkbox id="active" v-model="currentTodo.active" :binary="true" />
          <label for="active">Active</label>
        </div>
      </div>
      <template #footer>
        <Button
          label="Cancel"
          icon="pi pi-times"
          @click="closeDialog"
          class="p-button-text"
        />
        <Button label="Save" icon="pi pi-check" @click="saveTodo" autofocus />
      </template>
    </Dialog>

    <DataTable :value="todos" responsiveLayout="scroll">
      <Column field="name" header="Name"></Column>
      <Column field="description" header="Description"></Column>
      <Column field="repetition" header="Repetition"></Column>
      <Column field="effort" header="Effort (minutes)"></Column>
      <Column field="active" header="Active">
        <template #body="slotProps">
          <i
            :class="{
              'pi pi-check-circle': slotProps.data.active,
              'pi pi-times-circle': !slotProps.data.active,
            }"
          ></i>
        </template>
      </Column>
      <Column header="Actions">
        <template #body="slotProps">
          <Button
            icon="pi pi-pencil"
            @click="editTodo(slotProps.data)"
            class="p-button-rounded p-button-success m-1"
          />
          <Button
            icon="pi pi-trash"
            @click="deleteTodo(slotProps.data.id)"
            class="p-button-rounded p-button-danger m-1"
          />
        </template>
      </Column>
    </DataTable>

    <Button
      label="Add Todo"
      icon="pi pi-plus"
      @click="openNewTodoDialog"
      class="mt-4"
    />

    <h3 class="mt-10 mb-2">Assign Shitty Points</h3>
    <DataTable :value="todos" responsiveLayout="scroll">
      <Column field="name" header="Name"></Column>
      <Column field="shittyPoints" header="Shitty Points">
        <template #body="slotProps">
          <div class="shitty-points-container">
            <Button
              icon="pi pi-minus"
              @click="decreaseShittyPoints(slotProps.data)"
              class="p-button-rounded p-button-text"
            />
            <span>{{ slotProps.data.shittyPoints }}</span>
            <Button
              icon="pi pi-plus"
              @click="increaseShittyPoints(slotProps.data)"
              class="p-button-rounded p-button-text"
            />
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import Checkbox from 'primevue/checkbox';
import { mockApi } from '@/services/mockApi';

const todos = ref<any>([]);
const dialogVisible = ref(false);
const currentTodo = ref<any>({});
const repetitionOptions = [
  { label: 'Once', value: 'once' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

onMounted(async () => {
  await fetchTodos();
});

const fetchTodos = async () => {
  try {
    //   const response = await fetch("/api/todos", {
    //     headers: {
    //       Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //     },
    //   });
    //   todos.value = await response.json();
    todos.value = await mockApi.fetchTodos();
  } catch (error) {
    console.error('Error fetching todos:', error);
  }
};

const openNewTodoDialog = () => {
  currentTodo.value = {
    name: '',
    description: '',
    repetition: '',
    effort: 0,
    notice: '',
    active: true,
    shittyPoints: 0,
  };
  dialogVisible.value = true;
};

const editTodo = (todo: any) => {
  currentTodo.value = { ...todo };
  dialogVisible.value = true;
};

const closeDialog = () => {
  dialogVisible.value = false;
};

const saveTodo = async () => {
  try {
    // const method = currentTodo.value.id ? "PUT" : "POST";
    // const url = currentTodo.value.id ? `/api/todos/${currentTodo.value.id}` : "/api/todos";

    // await fetch(url, {
    //   method,
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    //   body: JSON.stringify(currentTodo.value),
    // });

    // await fetchTodos();
    // closeDialog();

    await mockApi.updateTodo(currentTodo.value);
    todos.value = await mockApi.fetchTodos();
  } catch (error) {
    console.error('Error saving todo:', error);
  }
};

const deleteTodo = async (id: number) => {
  if (confirm('Are you sure you want to delete this todo?')) {
    try {
      // await fetch(`/api/todos/${id}`, {
      //   method: "DELETE",
      //   headers: {
      //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      //   },
      // });
      // await fetchTodos();
      await mockApi.deleteTodo(id);
      todos.value = await mockApi.fetchTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  }
};

const updateShittyPoints = async (todo: any) => {
  try {
    // await fetch(`/api/todos/${todo.id}/shitty-points`, {
    //   method: "PATCH",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    //   body: JSON.stringify({ shittyPoints: todo.shittyPoints }),
    // });
    await mockApi.updateTodo(todo);
  } catch (error) {
    console.error('Error updating shitty points:', error);
  }
};

const increaseShittyPoints = async (todo: any) => {
  todo.shittyPoints += 1;
  await updateShittyPoints(todo);
};

const decreaseShittyPoints = async (todo: any) => {
  if (todo.shittyPoints > 0) {
    todo.shittyPoints -= 1;
    await updateShittyPoints(todo);
  }
};
</script>

<style>
.shitty-points-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
</style>
