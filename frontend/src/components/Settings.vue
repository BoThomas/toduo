<template>
  <h2>Settings</h2>

  <div class="mt-4 flex flex-wrap gap-3">
    <Button
      :label="
        autoassignCronInfo?.running
          ? 'Stop Autoassign Cron'
          : 'Start Autoassign Cron'
      "
      :icon="autoassignCronInfo?.running ? 'pi pi-stop' : 'pi pi-play'"
      @click="confirmCronControl"
      class="w-full sm:w-auto"
    />
    <Button
      label="Trigger Reassignment"
      @click="confirmReassignment(true)"
      icon="pi pi-refresh"
      class="w-full sm:w-auto"
    />
    <Button
      label="Trigger Assignment"
      @click="confirmReassignment(false)"
      icon="pi pi-reply"
      class="w-full sm:w-auto"
    />
    <Button
      label="Download Database"
      icon="pi pi-download"
      @click="downloadDatabase"
      class="w-full sm:w-auto"
    />
    <Button
      label="Upload Database"
      icon="pi pi-upload"
      @click="confirmDatabaseUpload"
      class="w-full sm:w-auto"
    />
    <Button
      label="Create or Roll API Key"
      icon="pi pi-key"
      @click="confirmCreateOrRollApiKey"
      class="w-full sm:w-auto"
    />
  </div>

  <div v-if="autoassignCronInfo?.name" class="mt-10">
    <p>The autoassign cron is currently running.</p>
    <p><strong>Cron Time:</strong> {{ autoassignCronInfo.cronTime }}</p>
    <p><strong>Cron Redable:</strong> {{ autoassignCronInfo.cronString }}</p>
    <p><strong>Next Dates:</strong></p>
    <ul class="list-disc pl-5">
      <li v-for="date in autoassignCronInfo.nextDates" :key="date">
        {{ new Date(date).toLocaleString() }}
      </li>
    </ul>
  </div>
  <div v-else class="mt-10">
    <p>The autoassign cron is currently stopped.</p>
  </div>

  <Dialog
    v-model:visible="cronTimeDialogVisible"
    header="Set Autoassign Cron Time and enable the Cron Job"
    :modal="true"
    class="w-full mx-5 max-w-2xl"
  >
    <div class="field">
      <label for="cronTime">Cron Time</label>
      <InputText
        id="cronTime"
        v-model="cronTime"
        placeholder="e.g. 0 23 * * 0"
        class="w-full"
      />
      <p class="mt-2 text-sm text-gray-600">{{ cronExplanation }}</p>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <Button
        label="Cancel"
        icon="pi pi-times"
        @click="cronTimeDialogVisible = false"
        class="p-button-text"
      />
      <Button label="Save" icon="pi pi-check" @click="saveCronTime" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { readAPI, createAPI, updateApi } from '@/services/apiService';
import cronstrue from 'cronstrue';

const toast = useToast();
const confirm = useConfirm();
const autoassignCronInfo = ref<any>({});

const cronTimeDialogVisible = ref(false);
const cronTime = ref();

onMounted(async () => {
  await fetchAutoassignCronInfo();
});

const fetchAutoassignCronInfo = async () => {
  try {
    const cronInfo = await readAPI('/doings/autoassign/cron');
    if (cronInfo.cronTime) {
      cronInfo.cronString = cronstrue.toString(cronInfo.cronTime, {
        use24HourTimeFormat: true,
      });
    }
    autoassignCronInfo.value = cronInfo;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not load autoassign cron info',
      life: 3000,
    });
  }
};

const confirmCronControl = async () => {
  if (autoassignCronInfo.value.running) {
    confirm.require({
      header: 'Are you sure you want to stop the autoassign cron?',
      message: 'This only affects new future assignments.',
      defaultFocus: 'reject',
      rejectProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: 'Stop',
      },
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        await controlAutoassignCron();
      },
    });
  } else {
    cronTime.value = autoassignCronInfo.value.cronTime ?? '0 23 * * 0';
    cronTimeDialogVisible.value = true;
  }
};

const cronExplanation = computed(() => {
  try {
    return cronstrue.toString(cronTime.value, { use24HourTimeFormat: true });
  } catch (error) {
    return 'Invalid cron time format';
  }
});

const isValidCronTime = (cronTime: string) => {
  const cronRegex =
    /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([1-9]|[12]\d|3[01])) (\*|([1-9]|1[0-2])) (\*|([0-6]))$/;
  return cronRegex.test(cronTime);
};

const saveCronTime = async () => {
  if (!isValidCronTime(cronTime.value)) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Invalid cron time format. Please enter a valid cron time.',
      life: 3000,
    });
    return;
  }
  cronTimeDialogVisible.value = false;
  await controlAutoassignCron();
};

const controlAutoassignCron = async () => {
  try {
    if (autoassignCronInfo.value.running) {
      await updateApi('/doings/autoassign/cron', {
        enable: false,
      });
    } else {
      await updateApi('/doings/autoassign/cron', {
        enable: true,
        cronTime: cronTime.value,
      });
    }
    await fetchAutoassignCronInfo();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not control autoassign cron',
      life: 3000,
    });
  }
};

const triggerReassignment = async (reassign: boolean) => {
  try {
    await createAPI('/doings/autoassign', {
      reassign,
    });
    toast.add({
      severity: 'success',
      summary: 'Success Message',
      detail: `${reassign ? 'Reassignment' : 'Evaluation and assignment'} successfull.`,
      life: 3000,
    });
  } catch (error) {
    console.error(error);
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Error during reassignment',
      life: 3000,
    });
  }
};

const confirmReassignment = (reassign: boolean) => {
  let header = '';
  let message = '';

  if (reassign) {
    header = 'Are you sure you want to reassign?';
    message =
      'All current assignments will be lost and progress will be reset.';
  } else {
    header = 'Are you sure you want to evaluate and assign?';
    message =
      'The current assignments will be evaluated and new ones will be assigned.';
  }

  confirm.require({
    header,
    message,
    defaultFocus: 'reject',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: reassign ? 'Reassign' : 'Evaluate and Assign',
    },
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      await triggerReassignment(reassign);
    },
  });
};

const downloadDatabase = async () => {
  try {
    const response = await readAPI('/database/download');
    const url = `data:application/octet-stream;base64,${response}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '').slice(0, 12)}-toduo-database.sqlite`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not download database',
      life: 3000,
    });
  }
};

const confirmDatabaseUpload = () => {
  confirm.require({
    header: 'Are you sure you want to upload a new database?',
    message: 'This will overwrite all current data.',
    defaultFocus: 'reject',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: 'Upload',
    },
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      await uploadDatabase();
    },
  });
};

const uploadDatabase = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.sqlite';
  input.onchange = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.sqlite')) {
      toast.add({
        severity: 'error',
        summary: 'Error Message',
        detail: 'Invalid file type. Please upload a .sqlite file.',
        life: 3000,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const base64 = e.target.result.split(',')[1];
      try {
        await updateApi('/database/upload', base64);
        toast.add({
          severity: 'success',
          summary: 'Success Message',
          detail: 'Database uploaded successfully',
          life: 3000,
        });
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Error Message',
          detail: 'Could not upload database',
          life: 3000,
        });
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

const confirmCreateOrRollApiKey = () => {
  confirm.require({
    header: 'Are you sure you want to create or roll the API key?',
    message: 'This will invalidate the current API key.',
    defaultFocus: 'reject',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: 'Create or Roll',
    },
    icon: 'pi pi-exclamation-triangle',
    accept: async () => {
      await createOrRollApiKey();
    },
  });
};

const createOrRollApiKey = async () => {
  try {
    const key = await readAPI('/apikey');
    toast.add({
      severity: 'success',
      summary: 'Success Message',
      detail: `API key created or rolled successfully. Copy it here, as it will not be shown again: ${key}`,
      life: 20000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error Message',
      detail: 'Could not create or roll API key',
      life: 3000,
    });
  }
};
</script>
