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
    // TODO: implement
  } catch (error) {
    console.error('Error fetching completed todos:', error);
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
