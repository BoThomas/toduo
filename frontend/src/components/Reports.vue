<template>
  <div class="reports">
    <h2 class="mb-6">Reports</h2>
    <div v-if="pageLoading" class="p-4">
      <Skeleton width="100%" height="3rem" class="mb-4" />
      <!-- Tabs Skeleton -->

      <!-- Skeleton for Chart and DataTable (repeated for both tabs conceptually) -->
      <div>
        <Skeleton height="220px" class="mb-14" />
        <DataTable :value="skeletonItems" stripedRows>
          <Column header="" style="width: 25%"
            ><template #body><Skeleton width="100%"></Skeleton></template
          ></Column>
          <Column header="This Week" style="width: 25%"
            ><template #body><Skeleton width="100%"></Skeleton></template
          ></Column>
          <Column header="This Month" style="width: 25%"
            ><template #body><Skeleton width="100%"></Skeleton></template
          ></Column>
          <Column header="This Year" style="width: 25%"
            ><template #body><Skeleton width="100%"></Skeleton></template
          ></Column>
        </DataTable>
      </div>
    </div>
    <div v-else>
      <Tabs value="0">
        <TabList>
          <Tab value="0">Completed Todos</Tab>
          <Tab value="1">Worked Minutes</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="0">
            <Chart
              type="line"
              :data="completedTodosData"
              :options="chartOptions"
              style="height: 220px"
            />
            <DataTable :value="completedTodosCount" stripedRows class="mt-14">
              <Column field="username" header="" style="width: 25%" />
              <Column field="week" header="This Week" style="width: 25%" />
              <Column field="month" header="This Month" style="width: 25%" />
              <Column field="year" header="This Year" style="width: 25%" />
            </DataTable>
          </TabPanel>
          <TabPanel value="1">
            <Chart
              type="line"
              :data="completedTodoMinutesData"
              :options="chartOptions"
              style="height: 220px"
            />
            <DataTable
              :value="completedTodosMinutsSum"
              stripedRows
              class="mt-14"
            >
              <Column field="username" header="" style="width: 25%" />
              <Column header="This Week" style="width: 25%">
                <template #body="slotProps">
                  {{ slotProps.data.week }} ({{
                    Math.round(slotProps.data.week / 60)
                  }}h)
                </template>
              </Column>
              <Column header="This Month" style="width: 25%">
                <template #body="slotProps">
                  {{ slotProps.data.month }} ({{
                    Math.round(slotProps.data.month / 60)
                  }}h)
                </template>
              </Column>
              <Column header="This Year" style="width: 25%">
                <template #body="slotProps">
                  {{ slotProps.data.year }} ({{
                    Math.round(slotProps.data.year / 60)
                  }}h)
                </template>
              </Column>
            </DataTable>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Skeleton from 'primevue/skeleton';
import Chart from 'primevue/chart';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { readAPI } from '@/services/apiService';

const completedTodosData = ref<any>(null);
const completedTodoMinutesData = ref<any>(null);
const completedTodosCount = ref<any>(null);
const completedTodosMinutsSum = ref<any>(null);
const pageLoading = ref(true);
const skeletonItems = ref(Array(2).fill({})); // For DataTable skeleton

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      afterFit(scale: any) {
        scale.width = 42;
      },
    },
  },
};

type Dataset = {
  label: string;
  data: number[];
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
};

const colors: string[] = [
  'rgba(75, 192, 192, 0.2)',
  'rgba(153, 102, 255, 0.2)',
  'rgba(255, 159, 64, 0.2)',
  'rgba(255, 99, 132, 0.2)',
  'rgba(54, 162, 235, 0.2)',
  'rgba(255, 206, 86, 0.2)',
];
const borderColors: string[] = [
  'rgba(75, 192, 192, 1)',
  'rgba(153, 102, 255, 1)',
  'rgba(255, 159, 64, 1)',
  'rgba(255, 99, 132, 1)',
  'rgba(54, 162, 235, 1)',
  'rgba(255, 206, 86, 1)',
];

onMounted(async () => {
  pageLoading.value = true;
  try {
    await Promise.all([
      fetchCompletedTodos(),
      fetchCompletedTodoMinutes(),
      fetchCompletedTodosTotal(),
    ]);
  } catch (error) {
    console.error('Error during onMounted in Reports:', error);
  } finally {
    pageLoading.value = false;
  }
});

const fetchCompletedTodos = async () => {
  try {
    const data = await readAPI('/statistics/completed', {
      weeksToShow: 10,
      dataColumn: 'assignments',
    });
    completedTodosData.value = {
      labels: data.labels,
      datasets: data.datasets.map((dataset: Dataset, index: number) => ({
        ...dataset,
        backgroundColor: colors[index % colors.length],
        borderColor: borderColors[index % borderColors.length],
        borderWidth: 1,
        tension: 0.3,
      })),
    };
  } catch (error) {
    console.error('Error fetching completed todos:', error);
  }
};

const fetchCompletedTodoMinutes = async () => {
  try {
    const data = await readAPI('/statistics/completed', {
      weeksToShow: 10,
      dataColumn: 'effort_in_minutes',
    });
    completedTodoMinutesData.value = {
      labels: data.labels,
      datasets: data.datasets.map((dataset: Dataset, index: number) => ({
        ...dataset,
        backgroundColor: colors[index % colors.length],
        borderColor: borderColors[index % borderColors.length],
        borderWidth: 1,
        tension: 0.3,
      })),
    };
  } catch (error) {
    console.error('Error fetching completed todo minutes:', error);
  }
};

const fetchCompletedTodosTotal = async () => {
  try {
    const data = await readAPI('/statistics/completed/sum');

    completedTodosCount.value = data.map((item: any) => ({
      username: item.username,
      week: item.count_week,
      month: item.count_month,
      year: item.count_year,
    }));

    completedTodosMinutsSum.value = data.map((item: any) => ({
      username: item.username,
      week: item.sum_minutes_week,
      month: item.sum_minutes_month,
      year: item.sum_minutes_year,
    }));
  } catch (error) {
    console.error('Error fetching completed todos total:', error);
  }
};
</script>
