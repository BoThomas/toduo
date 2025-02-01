<template>
  <div class="reports">
    <h2 class="mb-6">Reports</h2>

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
            class="h-60"
          />
          <Tabs value="0">
            <TabList>
              <Tab value="0">This Week</Tab>
              <Tab value="1">This Month</Tab>
              <Tab value="2">This Year</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="0">
                <div v-for="user in completedTodosCount" :key="user.username">
                  <h4>
                    {{ user.username }}:
                    <span class="text-primary">{{ user.week }}</span>
                  </h4>
                </div>
              </TabPanel>
              <TabPanel value="1">
                <div v-for="user in completedTodosCount" :key="user.username">
                  <h4>
                    {{ user.username }}:
                    <span class="text-primary">{{ user.month }}</span>
                  </h4>
                </div>
              </TabPanel>
              <TabPanel value="2">
                <div v-for="user in completedTodosCount" :key="user.username">
                  <h4>
                    {{ user.username }}:
                    <span class="text-primary">{{ user.year }}</span>
                  </h4>
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </TabPanel>
        <TabPanel value="1">
          <Chart
            type="line"
            :data="completedTodoMinutesData"
            :options="chartOptions"
            class="h-60"
          />
          <Tabs value="0">
            <TabList>
              <Tab value="0">This Week</Tab>
              <Tab value="1">This Month</Tab>
              <Tab value="2">This Year</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="0">
                <div
                  v-for="user in completedTodosMinutsSum"
                  :key="user.username"
                >
                  <h4>
                    {{ user.username }}:
                    <span class="text-primary"
                      >{{ user.week }} ({{ Math.round(user.week / 60) }}h)</span
                    >
                  </h4>
                </div>
              </TabPanel>
              <TabPanel value="1">
                <div
                  v-for="user in completedTodosMinutsSum"
                  :key="user.username"
                >
                  <h4>
                    {{ user.username }}:
                    <span class="text-primary"
                      >{{ user.month }} ({{
                        Math.round(user.month / 60)
                      }}h)</span
                    >
                  </h4>
                </div>
              </TabPanel>
              <TabPanel value="2">
                <div
                  v-for="user in completedTodosMinutsSum"
                  :key="user.username"
                >
                  <h4>
                    {{ user.username }}:
                    <span class="text-primary"
                      >{{ user.year }} ({{ Math.round(user.year / 60) }}h)</span
                    >
                  </h4>
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </TabPanel>
      </TabPanels>
    </Tabs>
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
const completedTodosCount = ref<any>(null);
const completedTodosMinutsSum = ref<any>(null);

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
  await Promise.all([
    fetchCompletedTodos(),
    fetchCompletedTodoMinutes(),
    fetchCompletedTodosTotal(),
  ]);
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
        tension: 0.4,
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
        tension: 0.4,
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
