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
          <Select
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
          <label for="effort_in_minutes">Effort (minutes)</label>
          <InputNumber
            id="effort_in_minutes"
            v-model="currentTodo.effort_in_minutes"
            required
            class="w-full"
          />
        </div>
        <div class="field col-span-12 lg:col-span-6">
          <label for="notice">Notice (optional)</label>
          <InputText id="notice" v-model="currentTodo.notice" class="w-full" />
        </div>
        <div class="field-checkbox col-span-12 mt-2 flex gap-1">
          <Checkbox
            id="is_active"
            v-model="currentTodo.is_active"
            :binary="true"
          />
          <label for="is_active">Active</label>
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
      <Column field="effort_in_minutes" header="Effort (minutes)"></Column>
      <Column field="is_active" header="Active">
        <template #body="slotProps">
          <i
            :class="{
              'pi pi-check-circle text-green-500': slotProps.data.is_active,
              'pi pi-times-circle text-red-500': !slotProps.data.is_active,
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
    <DataTable :value="shittyPoints" responsiveLayout="scroll">
      <Column field="name" header="Name"></Column>
      <Column field="points" header="Shitty Points">
        <template #body="slotProps">
          <div class="shitty-points-container">
            <Button
              icon="pi pi-minus"
              @click="decreaseShittyPoints(slotProps.data)"
              class="p-button-rounded p-button-text"
            />
            <span>{{ slotProps.data.points }}</span>
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
import Select from 'primevue/select';
import InputNumber from 'primevue/inputnumber';
import Checkbox from 'primevue/checkbox';
import {
  readAPI,
  createAPI,
  updateApi,
  deleteApi,
} from '@/services/apiService';

const todos = ref<any>([]);
const shittyPoints = ref<any>([]);
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
  await Promise.all([fetchTodos(), fetchShittyPoints()]);
});

const fetchTodos = async () => {
  try {
    todos.value = await readAPI('/doings');
  } catch (error) {
    // TODO: negative toast
  }
};

const openNewTodoDialog = () => {
  currentTodo.value = {
    name: '',
    description: '',
    repetition: '',
    effort_in_minutes: 0,
    notice: '',
    is_active: true,
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
    const currentTodoId = currentTodo.value.id;
    let response;
    if (currentTodoId) {
      response = await updateApi(`/doings/${currentTodoId}`, currentTodo.value);
    } else {
      response = await createAPI('/doings', currentTodo.value);
    }
    closeDialog();
    await fetchTodos();
  } catch (error) {
    // TODO: show error in form
  }
};

const deleteTodo = async (id: number) => {
  if (confirm('Are you sure you want to delete this todo?')) {
    try {
      await deleteApi(`/doings/${id}`);
      await fetchTodos();
    } catch (error) {
      // TODO: negative toast
    }
  }
};

const fetchShittyPoints = async () => {
  try {
    shittyPoints.value = await readAPI('/shittypoints');
  } catch (error) {
    // TODO: negative toast
  }
};

const updateShittyPoints = async (shittypoints: any) => {
  try {
    let result;
    if (shittypoints.id) {
      result = await updateApi(`/shittypoints/${shittypoints.id}`, {
        points: shittypoints.points,
      });
    } else {
      const newId = await createAPI('/shittypoints', {
        doing_id: shittypoints.doing_id,
        points: shittypoints.points,
      });
      shittypoints.id = newId;
      console.log(`New shitty points created with id: ${newId}`);
    }
  } catch (error) {
    // TODO: negative toast
  }
};

const increaseShittyPoints = async (shittypoints: any) => {
  shittypoints.points += 1;
  await updateShittyPoints(shittypoints);
};

const decreaseShittyPoints = async (shittypoints: any) => {
  if (shittypoints.points > 0) {
    shittypoints.points -= 1;
    await updateShittyPoints(shittypoints);
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
