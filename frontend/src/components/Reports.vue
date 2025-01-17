<template>
  <div class="reports">
    <h2 class="mb-2">Reports</h2>

    <div class="grid grid-cols-12 gap-4">
      <div class="col-span-12 md:col-span-6">
        <h3 class="mb-2">Completed Todos per Person</h3>
        <Chart type="line" :data="completedTodosData" :options="chartOptions" />
      </div>
      <div class="col-span-12 md:col-span-6">
        <h3 class="mb-2">Completed Minutes per Person</h3>
        <Chart
          type="line"
          :data="completedTodoMinutesData"
          :options="chartOptions"
        />
      </div>
    </div>

    <div class="grid grid-cols-12 gap-4 sm:mt-6">
      <div class="col-span-12 md:col-span-6 md:mt-6">
        <h3 class="mb-2">Work Done (in hours)</h3>
        <Tabs value="0">
          <TabList>
            <Tab value="0">This Week</Tab>
            <Tab value="1">This Month</Tab>
            <Tab value="2">This Year</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="0">
              <h4>Total Hours: {{ workDone.week }}</h4>
            </TabPanel>
            <TabPanel value="1">
              <h4>Total Hours: {{ workDone.month }}</h4>
            </TabPanel>
            <TabPanel value="2">
              <h4>Total Hours: {{ workDone.year }}</h4>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>

      <div class="col-span-12 md:col-span-6 md:mt-6">
        <h3 class="mb-2">Upcoming Work (in hours)</h3>
        <Tabs value="0">
          <TabList>
            <Tab value="0">This Week</Tab>
            <Tab value="1">This Month</Tab>
            <Tab value="2">This Year</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="0">
              <h4>Total Hours: {{ upcomingWork.week }}</h4>
            </TabPanel>
            <TabPanel value="1">
              <h4>Total Hours: {{ upcomingWork.month }}</h4>
            </TabPanel>
            <TabPanel value="2">
              <h4>Total Hours: {{ upcomingWork.year }}</h4>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Chart from 'primevue/chart';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import { readAPI } from '@/services/apiService';

const completedTodosData = ref<any>(null);
const completedTodoMinutesData = ref<any>(null);
const missedTodosData = ref<any>(null);
const workDone = ref({ week: 0, month: 0, year: 0 });
const upcomingWork = ref({ week: 0, month: 0, year: 0 });

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
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
  await fetchCompletedTodos();
  await fetchCompletedTodoMinutes();
  await fetchMissedTodos();
  await fetchWorkDone();
  await fetchUpcomingWork();
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
      })),
    };
  } catch (error) {
    console.error('Error fetching completed todo minutes:', error);
  }
};

const fetchMissedTodos = async () => {
  try {
    // TODO: implement
  } catch (error) {
    console.error('Error fetching missed todos:', error);
  }
};

const fetchWorkDone = async () => {
  try {
    // TODO: implement
  } catch (error) {
    console.error('Error fetching work done:', error);
  }
};

const fetchUpcomingWork = async () => {
  try {
    // TODO: implement
  } catch (error) {
    console.error('Error fetching upcoming work:', error);
  }
};
</script>
