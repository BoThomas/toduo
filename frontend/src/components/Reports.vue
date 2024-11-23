<template>
  <div class="reports">
    <h2 class="mb-2">Reports</h2>

    <div class="grid grid-cols-12 gap-4">
      <div class="col-span-12 md:col-span-6">
        <h3 class="mb-2">Completed Todos per Person</h3>
        <Chart type="line" :data="completedTodosData" :options="chartOptions" />
      </div>
      <div class="col-span-12 md:col-span-6">
        <h3 class="mb-2">Missed Todos per Person</h3>
        <Chart type="line" :data="missedTodosData" :options="chartOptions" />
      </div>
    </div>

    <div class="grid grid-cols-12 gap-4 sm:mt-6">
      <div class="col-span-12 md:col-span-6 md:mt-6">
        <h3 class="mb-2">Work Done (in hours)</h3>
        <TabView>
          <TabPanel header="This Week" :value="0">
            <h4>Total Hours: {{ workDone.week }}</h4>
          </TabPanel>
          <TabPanel header="This Month" :value="1">
            <h4>Total Hours: {{ workDone.month }}</h4>
          </TabPanel>
          <TabPanel header="This Year" :value="2">
            <h4>Total Hours: {{ workDone.year }}</h4>
          </TabPanel>
        </TabView>
      </div>

      <div class="col-span-12 md:col-span-6 md:mt-6">
        <h3 class="mb-2">Upcoming Work (in hours)</h3>
        <TabView>
          <TabPanel header="This Week" :value="0">
            <h4>Total Hours: {{ upcomingWork.week }}</h4>
          </TabPanel>
          <TabPanel header="This Month" :value="1">
            <h4>Total Hours: {{ upcomingWork.month }}</h4>
          </TabPanel>
          <TabPanel header="This Year" :value="2">
            <h4>Total Hours: {{ upcomingWork.year }}</h4>
          </TabPanel>
        </TabView>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Chart from 'primevue/chart';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { mockApi } from '@/services/mockApi';

const completedTodosData = ref<any>(null);
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

onMounted(async () => {
  await fetchCompletedTodos();
  await fetchMissedTodos();
  await fetchWorkDone();
  await fetchUpcomingWork();
});

const fetchCompletedTodos = async () => {
  try {
    // const response = await fetch("/api/reports/completed-todos", {
    //   headers: {
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    // });
    // const data = await response.json();
    // const data = await mockApi.fetchCompletedTodos();
    // completedTodosData.value = {
    //   labels: data.labels,
    //   datasets: data.datasets,
    // };
  } catch (error) {
    console.error('Error fetching completed todos:', error);
  }
};

const fetchMissedTodos = async () => {
  try {
    // const response = await fetch("/api/reports/missed-todos", {
    //   headers: {
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    // });
    // const data = await response.json();
    //const data = await mockApi.fetchMissedTodos();
    // missedTodosData.value = {
    //   labels: data.labels,
    //   datasets: data.datasets,
    // };
  } catch (error) {
    console.error('Error fetching missed todos:', error);
  }
};

const fetchWorkDone = async () => {
  try {
    // const response = await fetch("/api/reports/work-done", {
    //   headers: {
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    // });
    // workDone.value = await response.json();
    //workDone.value = await mockApi.fetchWorkDone();
  } catch (error) {
    console.error('Error fetching work done:', error);
  }
};

const fetchUpcomingWork = async () => {
  try {
    // const response = await fetch("/api/reports/upcoming-work", {
    //   headers: {
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    // });
    // upcomingWork.value = await response.json();
    //upcomingWork.value = await mockApi.fetchUpcomingWork();
  } catch (error) {
    console.error('Error fetching upcoming work:', error);
  }
};
</script>
