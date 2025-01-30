<template>
  <h2 class="mb-2">The Doings</h2>
  <Dialog
    v-model:visible="doingDialogVisible"
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
        <InputText
          id="name"
          name="name"
          placeholder="e.g. do the dishes"
          class="w-full"
        />
        <Message
          v-if="$form.name?.invalid"
          severity="error"
          size="small"
          variant="simple"
          >{{ $form.name.error?.message }}</Message
        >
      </div>
      <div class="field col-span-12">
        <label for="description">Description (optional)</label>
        <Textarea
          id="description"
          name="description"
          rows="3"
          placeholder="e.g. dry them afterwards"
          class="w-full"
        />
      </div>
      <div class="field col-span-12 sm:col-span-6">
        <label for="interval_value">Interval Value</label>
        <InputNumber
          id="interval_value"
          name="interval_value"
          placeholder="e.g. every 2"
          :min="1"
          class="w-full"
          :showButtons="true"
          prefix="every "
        />
        <Message
          v-if="$form.interval_value?.invalid"
          severity="error"
          size="small"
          variant="simple"
          >{{ $form.interval_value.error?.message }}</Message
        >
      </div>
      <div class="field col-span-12 sm:col-span-6">
        <label for="interval_unit">Interval Unit</label>
        <Select
          id="interval_unit"
          name="interval_unit"
          :options="intervalUnitOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select..."
          class="w-full"
        />
        <Message
          v-if="$form.interval_unit?.invalid"
          severity="error"
          size="small"
          variant="simple"
          >{{ $form.interval_unit.error?.message }}</Message
        >
      </div>
      <div class="field col-span-12 sm:col-span-6">
        <label for="repeats_per_week">Repeats per Week</label>
        <Select
          id="repeats_per_week"
          name="repeats_per_week"
          :options="[1, 2, 3, 4, 5, 6, 7]"
          class="w-full"
        />
        <Message
          v-if="$form.repeats_per_week?.invalid"
          severity="error"
          size="small"
          variant="simple"
          >{{ $form.repeats_per_week.error?.message }}
        </Message>
      </div>
      <div class="field col-span-12 sm:col-span-6">
        <label for="effort_in_minutes">Effort (in minutes)</label>
        <InputNumber
          id="effort_in_minutes"
          name="effort_in_minutes"
          placeholder="e.g. 30"
          :min="1"
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
      <div class="field col-span-12 mt-2">
        <label for="static_user">Allways done by (optional)</label>
        <Select
          id="static_user"
          name="static_user"
          :options="users.map((user: any) => user.username)"
          placeholder="Select User"
          class="w-full"
          showClear
        />
      </div>
      <div class="field col-span-12">
        <label for="notice">Notice (optional)</label>
        <InputText
          id="notice"
          name="notice"
          placeholder="e.g. use the blue sponge"
          class="w-full"
        />
      </div>
      <div class="field-checkbox col-span-12 mt-2 flex gap-1">
        <Checkbox id="is_active" name="is_active" :binary="true" />
        <label for="is_active">Active</label>
      </div>
      <div class="col-span-12 flex justify-end gap-2">
        <Button
          label="Cancel"
          icon="pi pi-times"
          @click="doingDialogVisible = false"
          class="p-button-text"
        />
        <Button label="Save" icon="pi pi-check" type="submit" />
      </div>
    </Form>
  </Dialog>

  <Dialog
    v-model:visible="assignmentDialogVisible"
    :header="`Assign '${currentDoing.name}' to:`"
    :modal="true"
    class="w-full mx-5 max-w-2xl"
  >
    <Select
      v-model="assignmentSelectedUser"
      :options="users.map((user: any) => user.username)"
      placeholder="Select User"
      class="w-full"
    />
    <div class="flex justify-end gap-2 mt-4">
      <Button
        label="Cancel"
        icon="pi pi-times"
        @click="assignmentDialogVisible = false"
        class="p-button-text"
      />
      <Button label="Assign" icon="pi pi-check" @click="assignDoing()" />
    </div>
  </Dialog>

  <DataTable
    :value="doings"
    dataKey="id"
    responsiveLayout="scroll"
    removableSort
    size="small"
    paginator
    :rows="10"
    :rowsPerPageOptions="[5, 10, 20, 50]"
    v-model:filters="doingFilters"
    :globalFilterFields="[
      'name',
      'description',
      'interval_unit',
      'effort_in_minutes',
    ]"
  >
    <div class="flex justify-end gap-2 mb-2">
      <Button
        type="button"
        icon="pi pi-filter-slash"
        outlined
        @click="clearDoingsFilter()"
      />
      <IconField>
        <InputIcon>
          <i class="pi pi-search" />
        </InputIcon>
        <InputText
          v-model="doingFilters['global'].value"
          placeholder="Keyword Search"
        />
      </IconField>
    </div>
    <Column field="name" header="Name" sortable></Column>
    <Column field="description" header="Description" sortable></Column>
    <Column header="Interval" sortable sortField="interval_unit">
      <template #body="slotProps">
        <span v-if="slotProps.data.interval_value > 1">
          {{ slotProps.data.interval_value }} -
        </span>
        <span>{{ slotProps.data.interval_unit }}</span>
        <span v-if="slotProps.data.repeats_per_week > 1">
          ({{ slotProps.data.repeats_per_week }}x)
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
        <span v-if="slotProps.data.is_active">✅</span>
        <span v-else>❌</span>
      </template>
    </Column>
    <Column header="Done by" sortable sortField="static_user_id">
      <template #body="slotProps">
        {{
          users.find((user: any) => user.id === slotProps.data.static_user_id)
            ?.username || '🎲'
        }}
      </template>
    </Column>
    <Column>
      <template #body="slotProps">
        <div class="flex">
          <Button
            icon="pi pi-user-plus"
            @click="openAssignDoing(slotProps.data)"
            variant="text"
            class="p-button-rounded p-button-success"
          />
          <Button
            icon="pi pi-pencil"
            @click="openEditDoing(slotProps.data)"
            variant="text"
            class="p-button-rounded p-button-warn"
          />
          <Button
            icon="pi pi-trash"
            @click="deleteDoing(slotProps.data.id)"
            variant="text"
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

  <h3 class="mt-16 mb-3">This Week's Assignments</h3>
  <DataTable
    :value="assignments"
    dataKey="assignmentId"
    responsiveLayout="scroll"
    removableSort
    size="small"
    paginator
    :rows="10"
    :rowsPerPageOptions="[5, 10, 20, 50]"
    v-model:filters="assignmentFilters"
    :globalFilterFields="['doingName', 'username', 'status']"
  >
    <div class="flex justify-end gap-2 mb-2">
      <Button
        type="button"
        icon="pi pi-filter-slash"
        outlined
        @click="clearAssignmentFilter()"
      />
      <IconField>
        <InputIcon>
          <i class="pi pi-search" />
        </InputIcon>
        <InputText
          v-model="assignmentFilters['global'].value"
          placeholder="Keyword Search"
        />
      </IconField>
    </div>
    <Column header="Todo" sortable sortField="doingName">
      <template #body="slotProps">
        {{ slotProps.data.doingName }}
        <span v-if="slotProps.data.doingRepeatsPerWeek > 1">
          ({{ slotProps.data.calcCounterCurrent }}/{{
            slotProps.data.calcCounterTotal
          }})
        </span>
      </template>
    </Column>
    <Column header="Assigned To" sortable sortField="username">
      <template #body="slotProps">
        <Select
          v-model="slotProps.data.username"
          :options="users.map((user: any) => user.username)"
          @change="updateAssignment(slotProps.data)"
        />
      </template>
    </Column>
    <Column header="Status" sortable sortField="status">
      <template #body="slotProps">
        <Select
          v-model="slotProps.data.status"
          :options="
            getStatusOptions(
              slotProps.data.doingIntervalUnit,
              slotProps.data.doingRepeatsPerWeek,
            )
          "
          @change="updateAssignment(slotProps.data)"
        />
      </template>
    </Column>
    <Column>
      <template #body="slotProps">
        <Button
          icon="pi pi-trash"
          @click="
            confirmDeleteAssignment(
              slotProps.data.assignmentId,
              slotProps.data.doingName,
            )
          "
          variant="text"
          class="p-button-rounded p-button-danger"
        />
      </template>
    </Column>
  </DataTable>

  <div class="mt-4 flex flex-wrap gap-3">
    <Button
      :label="
        showStatusExplanation
          ? 'Hide Status Explanation'
          : 'Show Status Explanation'
      "
      :icon="showStatusExplanation ? 'pi pi-eye-slash' : 'pi pi-eye'"
      @click="showStatusExplanation = !showStatusExplanation"
      class="w-full sm:w-auto"
    />
  </div>

  <div v-if="showStatusExplanation" class="mt-10">
    <h3 class="mb-2">Status Explanation</h3>
    <ul class="list-disc pl-5">
      <li>
        <strong>Waiting:</strong> The task is waiting to be pending. Only for
        doings with more than one repeat per week.
      </li>
      <li><strong>Pending:</strong> The task is open for completion.</li>
      <li>
        <strong>Completed:</strong> The task has been finished successfully.
      </li>
      <li>
        <strong>Skipped:</strong> The task will not be completed this iteration
        and is reassigned the next time it is due based on the interval unit.
        Not possible for one-time doings.
      </li>
      <li>
        <strong>Postponed:</strong> The task will not be completed this
        iteration but is reassigned the next week, regardless of the interval
        unit. Not possible for weekly doings.
      </li>
      <li>
        <strong>Failed:</strong> The task has been failed and will be reassigned
        the next week, regardless of the interval unit. Can not be set manually.
      </li>
    </ul>
  </div>
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
const assignments = ref<any>([]);
const users = ref<any>([]);

const doingDialogVisible = ref(false);
const currentDoing = ref<any>({});

const assignmentDialogVisible = ref(false);
const assignmentSelectedUser = ref();

const intervalUnitOptions = [
  { label: 'once', value: 'once' },
  { label: 'week(s)', value: 'weekly' },
  { label: 'month(s)', value: 'monthly' },
];

const doingFilters = ref<any>({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});
const assignmentFilters = ref<any>({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});

const showStatusExplanation = ref(false);
const STATUS_OPTIONS = [
  'waiting',
  'pending',
  'completed',
  'skipped',
  'postponed',
]; //TODO: move to type model

const clearDoingsFilter = () => {
  doingFilters.value.global.value = null;
};

const clearAssignmentFilter = () => {
  assignmentFilters.value.global.value = null;
};

const resolver = ({ values }: any) => {
  const errors: any = {};

  if (!values.name) {
    errors.name = [{ message: 'required' }];
  }

  if (!values.interval_unit) {
    errors.interval_unit = [{ message: 'required' }];
  }

  if (!values.interval_value) {
    errors.interval_value = [{ message: 'required' }];
  }

  if (!values.repeats_per_week) {
    errors.repeats_per_week = [{ message: 'required' }];
  }

  if (!values.effort_in_minutes) {
    errors.effort_in_minutes = [{ message: 'required' }];
  }

  return {
    errors,
  };
};

onMounted(async () => {
  await Promise.all([fetchDoings(), fetchAssignments(), fetchUsers()]);
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

const fetchAssignments = async () => {
  try {
    assignments.value = await readAPI('/todos?allUsers=true');
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load assignments',
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

const openNewTodoDialog = () => {
  currentDoing.value = {
    name: '',
    description: '',
    interval_unit: 'weekly',
    interval_value: 1,
    repeats_per_week: 1,
    effort_in_minutes: undefined,
    static_user: null,
    notice: '',
    is_active: true,
  };
  doingDialogVisible.value = true;
};

const openAssignDoing = (doing: any) => {
  currentDoing.value = { ...doing };
  assignmentSelectedUser.value = null;
  assignmentDialogVisible.value = true;
};

const assignDoing = async () => {
  try {
    if (!assignmentSelectedUser.value) {
      toast.add({
        severity: 'warn',
        summary: 'Error Message',
        detail: 'Please select a user',
        life: 3000,
      });
      return;
    }
    await createAPI('/doings/assign', {
      doing_id: currentDoing.value.id,
      user_id: users.value.find(
        (user: any) => user.username === assignmentSelectedUser.value,
      ).id,
    });
    toast.add({
      severity: 'success',
      summary: 'Success Message',
      detail: 'Doing assigned successfully',
      life: 3000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: error,
      life: 3000,
    });
  }
  assignmentDialogVisible.value = false;
  await fetchAssignments();
};

const openEditDoing = (todo: any) => {
  currentDoing.value = {
    ...todo,
    static_user: todo.static_user_id
      ? users.value.find((user: any) => user.id === todo.static_user_id)
          .username
      : null,
  };
  doingDialogVisible.value = true;
};

const saveDoing = async (formData: any) => {
  if (!formData.valid) {
    return;
  }
  try {
    const currentDoingId = currentDoing.value.id;

    // update currentDoing with form data
    const updateDoingData = {
      name: formData.states.name.value,
      description: formData.states.description.value,
      interval_unit: formData.states.interval_unit.value,
      interval_value: formData.states.interval_value.value,
      repeats_per_week: formData.states.repeats_per_week.value,
      effort_in_minutes: formData.states.effort_in_minutes.value,
      static_user_id: users.value.find(
        (user: any) => user.username === formData.states.static_user.value,
      )?.id,
      notice: formData.states.notice.value,
      is_active: formData.states.is_active.value,
    };
    if (currentDoingId) {
      await updateApi(`/doings/${currentDoingId}`, updateDoingData);
    } else {
      await createAPI('/doings', updateDoingData);
    }
    doingDialogVisible.value = false;
    toast.add({
      severity: 'success',
      summary: 'Success Message',
      detail: 'Doing saved successfully',
      life: 3000,
    });
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: `Doing not saved: ${error.message}`,
      life: 3000,
    });
  } finally {
    await fetchDoings();
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
        await fetchDoings();
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

// for updating the user and status of the assignment
const updateAssignment = async (assignment: any) => {
  // as the select component returns the username, we need to find the user id
  const user = users.value.find((u: any) => u.username === assignment.username);
  try {
    await updateApi(`/assignments/${assignment.assignmentId}`, {
      assignedUserId: user.id,
      status: assignment.status,
    });
    await fetchAssignments();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not update assignment',
      life: 3000,
    });
  }
};

const confirmDeleteAssignment = (assignmentId: number, doingName: string) => {
  confirm.require({
    header: `Are you sure you want to delete the assignment for "${doingName}"?`,
    message:
      'This action cannot be undone. The doing will be reassigned to the next iteration.',
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
        await deleteApi(`/assignments/${assignmentId}`);
        await fetchAssignments();
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error Message',
          detail: 'Could not delete assignment',
          life: 3000,
        });
      }
    },
  });
};

// helper function to get the available status options based on the interval unit and repeats per week
const getStatusOptions = (interval_unit: string, repeats_per_week: number) => {
  let options = [...STATUS_OPTIONS];

  // for weekly todos, we don't want to show postponed status
  // as it doesn't make sense because the todo will be reassigned the next day/week anyway
  if (interval_unit === 'weekly') {
    options = options.filter((option) => option !== 'postponed');
  }

  // for once todos, we don't want to show skipped status
  if (interval_unit === 'once') {
    options = options.filter((option) => option !== 'skipped');
  }

  // only for repeated todos is waiting status allowed
  if (repeats_per_week <= 1) {
    options = options.filter((option) => option !== 'waiting');
  }
  return options;
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
