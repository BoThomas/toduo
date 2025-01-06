<template>
  <h2 class="mb-2">The Doings</h2>
  <Dialog
    v-model:visible="dialogVisible"
    header="Todo Details"
    :modal="true"
    class="w-full mx-5 max-w-2xl"
  >
    <Form
      v-slot="$form"
      :initialValues="currentDoing"
      :resolver="resolver"
      @submit="saveDoing"
      class="formgrid grid grid-cols-12 gap-4"
    >
      <div class="field col-span-12">
        <label for="name">Name</label>
        <InputText id="name" name="name" class="w-full" />
        <Message
          v-if="$form.name?.invalid"
          severity="error"
          size="small"
          variant="simple"
          >{{ $form.name.error?.message }}</Message
        >
      </div>
      <div class="field col-span-12">
        <label for="description">Description</label>
        <Textarea id="description" name="description" rows="3" class="w-full" />
      </div>
      <div
        :class="[
          'field',
          $form.repetition && $form.repetition.value === 'daily'
            ? 'col-span-12 sm:col-span-6'
            : 'col-span-12',
        ]"
      >
        <label for="repetition">Repetition</label>
        <Select
          id="repetition"
          name="repetition"
          :options="repetitionOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select repetition"
          class="w-full"
        />
        <Message
          v-if="$form.repetition?.invalid"
          severity="error"
          size="small"
          variant="simple"
          >{{ $form.repetition.error?.message }}</Message
        >
      </div>
      <div
        class="field col-span-12 sm:col-span-6"
        v-if="$form.repetition && $form.repetition.value === 'daily'"
      >
        <label for="days_per_week">Days per Week</label>
        <Select
          id="days_per_week"
          name="days_per_week"
          :options="[2, 3, 4, 5, 6, 7]"
          class="w-full"
        />
        <Message
          v-if="$form.days_per_week?.invalid"
          severity="error"
          size="small"
          variant="simple"
          >{{ $form.days_per_week.error?.message }}
        </Message>
      </div>
      <div class="field col-span-12 sm:col-span-6">
        <label for="effort_in_minutes">Effort (minutes)</label>
        <InputNumber
          id="effort_in_minutes"
          name="effort_in_minutes"
          class="w-full"
        />
        <Message
          v-if="$form.effort_in_minutes?.invalid"
          severity="error"
          size="small"
          variant="simple"
          >{{ $form.effort_in_minutes.error?.message }}</Message
        >
      </div>
      <div class="field col-span-12 sm:col-span-6">
        <label for="notice">Notice (optional)</label>
        <InputText id="notice" name="notice" class="w-full" />
      </div>
      <div class="field-checkbox col-span-12 mt-2 flex gap-1">
        <Checkbox id="is_active" name="is_active" :binary="true" />
        <label for="is_active">Active</label>
      </div>
      <div class="col-span-12 flex justify-end gap-2">
        <Button
          label="Cancel"
          icon="pi pi-times"
          @click="closeDialog"
          class="p-button-text"
        />
        <Button label="Save" icon="pi pi-check" type="submit" />
      </div>
    </Form>
  </Dialog>

  <DataTable
    :value="doings"
    responsiveLayout="scroll"
    removableSort
    size="small"
    paginator
    :rows="10"
    :rowsPerPageOptions="[5, 10, 20, 50]"
    v-model:filters="doingsFilters"
    :globalFilterFields="[
      'name',
      'description',
      'repetition',
      'effort_in_minutes',
    ]"
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
          v-model="doingsFilters['global'].value"
          placeholder="Keyword Search"
        />
      </IconField>
    </div>
    <Column field="name" header="Name" sortable></Column>
    <Column field="description" header="Description" sortable></Column>
    <Column header="Repetition" sortable sortField="repetition">
      <template #body="slotProps">
        {{ slotProps.data.repetition }}
        <span v-if="slotProps.data.days_per_week">
          ({{ slotProps.data.days_per_week }}x)
        </span>
      </template>
    </Column>
    <Column
      field="effort_in_minutes"
      header="Effort (minutes)"
      sortable
    ></Column>
    <Column header="Active" sortable sortField="is_active">
      <template #body="slotProps">
        <i
          :class="{
            'pi pi-check-circle text-green-500': slotProps.data.is_active,
            'pi pi-times-circle text-red-500': !slotProps.data.is_active,
          }"
        ></i>
      </template>
    </Column>
    <Column>
      <template #body="slotProps">
        <div class="flex gap-2">
          <Button
            icon="pi pi-pencil"
            @click="editDoing(slotProps.data)"
            class="p-button-rounded p-button-success"
          />
          <Button
            icon="pi pi-trash"
            @click="deleteDoing(slotProps.data.id)"
            class="p-button-rounded p-button-danger"
          />
        </div>
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
  <DataTable
    :value="shittyPoints"
    responsiveLayout="scroll"
    removableSort
    paginator
    :rows="10"
    :rowsPerPageOptions="[5, 10, 20, 50]"
    size="small"
  >
    <Column field="name" header="Name" sortable></Column>
    <Column
      header="Shitty Points"
      sortable
      sortField="points"
      headerStyle="display: flex; justify-content: center;"
    >
      <template #body="slotProps">
        <div class="shitty-points-container">
          <Button
            icon="pi pi-minus"
            @click="updateShittyPoints(slotProps.data, -1)"
            class="p-button-rounded p-button-text"
          />
          <span>{{ slotProps.data.points }}</span>
          <Button
            icon="pi pi-plus"
            @click="updateShittyPoints(slotProps.data, 1)"
            class="p-button-rounded p-button-text"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Form } from '@primevue/forms';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import InputNumber from 'primevue/inputnumber';
import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { FilterMatchMode } from '@primevue/core/api';
import {
  readAPI,
  createAPI,
  updateApi,
  deleteApi,
} from '@/services/apiService';

const toast = useToast();
const confirm = useConfirm();
const doings = ref<any>([]);
const doingsFilters = ref<any>({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});
const shittyPoints = ref<any>([]);
const dialogVisible = ref(false);
const currentDoing = ref<any>({});
const repetitionOptions = [
  { label: 'Once', value: 'once' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

const clearFilter = () => {
  doingsFilters.value.global.value = null;
};

const resolver = ({ values }: any) => {
  const errors: any = {};

  if (!values.name) {
    errors.name = [{ message: 'required' }];
  }

  if (!values.repetition) {
    errors.repetition = [{ message: 'required' }];
  }

  if (values.repetition === 'daily' && !values.days_per_week) {
    errors.days_per_week = [{ message: 'required' }];
  }

  if (!values.effort_in_minutes) {
    errors.effort_in_minutes = [{ message: 'required' }];
  }

  return {
    errors,
  };
};

onMounted(async () => {
  await fetchDoingsAndShittyPoints();
});

const fetchDoings = async () => {
  try {
    const doingsData = await readAPI('/doings');
    doings.value = doingsData;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load doings',
      life: 3000,
    });
  }
};

const fetchShittyPoints = async () => {
  try {
    const shittyPointsData = await readAPI('/shittypoints');
    shittyPoints.value = shittyPointsData;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load shitty points',
      life: 3000,
    });
  }
};

const fetchDoingsAndShittyPoints = async () => {
  await Promise.all([fetchDoings(), fetchShittyPoints()]);
};

const openNewTodoDialog = () => {
  currentDoing.value = {
    name: '',
    description: '',
    repetition: '',
    effort_in_minutes: undefined,
    notice: '',
    is_active: true,
  };
  dialogVisible.value = true;
};

const editDoing = (todo: any) => {
  currentDoing.value = { ...todo };
  dialogVisible.value = true;
};

const closeDialog = () => {
  dialogVisible.value = false;
};

const saveDoing = async (formData: any) => {
  if (!formData.valid) {
    return;
  }
  try {
    const currentDoingId = currentDoing.value.id;

    // update currentDoing with form data
    currentDoing.value = {
      name: formData.states.name.value,
      description: formData.states.description.value,
      repetition: formData.states.repetition.value,
      days_per_week:
        formData.states.days_per_week?.value &&
        formData.states.repetition.value === 'daily'
          ? parseInt(formData.states.days_per_week.value)
          : undefined,
      effort_in_minutes: formData.states.effort_in_minutes.value,
      notice: formData.states.notice.value,
      is_active: formData.states.is_active.value,
    };
    let response;
    if (currentDoingId) {
      response = await updateApi(
        `/doings/${currentDoingId}`,
        currentDoing.value,
      );
    } else {
      response = await createAPI('/doings', currentDoing.value);
    }
    closeDialog();
    await fetchDoingsAndShittyPoints();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Doing could not be saved',
      life: 3000,
    });
    // TODO: show error in form
  }
};

const deleteDoing = async (id: number) => {
  confirm.require({
    header: 'Are you sure you want to delete this doing?',
    message:
      'All shitty-points and assignments regarding this doing will be lost. This action cannot be undone.',
    defaultFocus: 'reject',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: 'Delete',
    },
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      try {
        await deleteApi(`/doings/${id}`);
        await fetchDoingsAndShittyPoints();
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error Message',
          detail: 'Doing could not be deleted',
          life: 3000,
        });
      }
    },
  });
};

const updateShittyPoints = async (shittypoints: any, amount: number) => {
  try {
    let result;
    if (shittypoints.id) {
      result = await updateApi(`/shittypoints/${shittypoints.id}`, {
        points: shittypoints.points + amount,
      });
    } else {
      const newId = await createAPI('/shittypoints', {
        doing_id: shittypoints.doing_id,
        points: shittypoints.points + amount,
      });
      shittypoints.id = newId;
    }
    await fetchShittyPoints();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Shitty points could not be updated',
      life: 3000,
    });
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
