<template>
  <div class="the-duo">
    <h2>The Duo</h2>

    <h3>User Participation</h3>
    <div v-for="user in users" :key="user.id" class="p-field">
      <label :for="user.id">{{ user.name }}</label>
      <Slider v-model="user.participation" @change="updateParticipation" />
      <span>{{ user.participation }}%</span>
    </div>

    <h3>This Week's Assignments</h3>
    <DataTable :value="weeklyAssignments" responsiveLayout="scroll">
      <Column field="todo.name" header="Todo"></Column>
      <Column field="assignedUser" header="Assigned To">
        <template #body="slotProps">
          <Dropdown v-model="slotProps.data.assignedUser" :options="users" optionLabel="name" optionValue="id" @change="updateAssignment(slotProps.data)" />
        </template>
      </Column>
      <Column field="status" header="Status">
        <template #body="slotProps">
          <Dropdown v-model="slotProps.data.status" :options="statusOptions" @change="updateStatus(slotProps.data)" />
        </template>
      </Column>
    </DataTable>

    <Button label="Trigger Reassignment" @click="triggerReassignment" class="mt-3" />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Slider from "primevue/slider";
import Dropdown from "primevue/dropdown";
import Button from "primevue/button";
import { mockApi } from "@/services/mockApi";

const users = ref([]);
const weeklyAssignments = ref([]);
const statusOptions = ["Pending", "Completed", "Skipped", "Postponed"];

onMounted(async () => {
  await fetchUsers();
  await fetchWeeklyAssignments();
});

const fetchUsers = async () => {
  try {
    // const response = await fetch("/api/users", {
    //   headers: {
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    // });
    // users.value = await response.json();
    users.value = await mockApi.fetchUsers();
  } catch (error) {
    console.error("Error fetching users:", error);
  }
};

const fetchWeeklyAssignments = async () => {
  try {
    // const response = await fetch("/api/assignments/weekly", {
    //   headers: {
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    // });
    // weeklyAssignments.value = await response.json();
    weeklyAssignments.value = await mockApi.fetchWeeklyAssignments();
  } catch (error) {
    console.error("Error fetching weekly assignments:", error);
  }
};

const updateParticipation = async () => {
  try {
    // await fetch("/api/users/participation", {
    //   method: "PUT",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    //   body: JSON.stringify(users.value.map((user) => ({ id: user.id, participation: user.participation }))),
    // });
    await mockApi.updateUserParticipation(users.value);
  } catch (error) {
    console.error("Error updating user participation:", error);
  }
};

const updateAssignment = async (assignment) => {
  try {
    // await fetch(`/api/assignments/${assignment.id}`, {
    //   method: "PATCH",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    //   body: JSON.stringify({ assignedUser: assignment.assignedUser }),
    // });
    await mockApi.updateAssignment(assignment);
  } catch (error) {
    console.error("Error updating assignment:", error);
  }
};

const updateStatus = async (assignment) => {
  try {
    // await fetch(`/api/assignments/${assignment.id}/status`, {
    //   method: "PATCH",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    //   body: JSON.stringify({ status: assignment.status }),
    // });
    await mockApi.updateAssignmentStatus(assignment);
  } catch (error) {
    console.error("Error updating assignment status:", error);
  }
};

const triggerReassignment = async () => {
  try {
    // await fetch("/api/assignments/reassign", {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    //   },
    // });
    // await fetchWeeklyAssignments();
    await mockApi.triggerReassignment();
    weeklyAssignments.value = await mockApi.fetchWeeklyAssignments();
  } catch (error) {
    console.error("Error triggering reassignment:", error);
  }
};
</script>
