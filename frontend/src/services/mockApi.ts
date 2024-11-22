const todos = [
  {
    id: 1,
    name: 'Clean the kitchen',
    description: 'Clean all surfaces and mop the floor',
    repetition: 'weekly',
    effort: 60,
    notice: '',
    active: true,
    shittyPoints: 5,
  },
  // ...other mock todos...
];

const users = [
  {
    id: 1,
    name: 'Thomas',
    participation: 50,
  },
  {
    id: 2,
    name: 'Wife',
    participation: 50,
  },
  // ...other mock users...
];

const weeklyAssignments = [
  {
    id: 1,
    todo: todos[0],
    assignedUser: users[0],
    status: 'Pending',
  },
  // ...other mock assignments...
];

export const mockApi = {
  async fetchTodos() {
    return Promise.resolve(todos);
  },
  async fetchUsers() {
    return Promise.resolve(users);
  },
  async fetchWeeklyAssignments() {
    return Promise.resolve(weeklyAssignments);
  },
  async updateTodo(updatedTodo: any) {
    const index = todos.findIndex((todo) => todo.id === updatedTodo.id);
    if (index !== -1) {
      todos[index] = updatedTodo;
    }
    return Promise.resolve();
  },
  async deleteTodo(id: number) {
    const index = todos.findIndex((todo) => todo.id === id);
    if (index !== -1) {
      todos.splice(index, 1);
    }
    return Promise.resolve();
  },
  async updateUserParticipation(updatedUsers: any) {
    updatedUsers.forEach((updatedUser: any) => {
      const index = users.findIndex((user) => user.id === updatedUser.id);
      if (index !== -1) {
        users[index].participation = updatedUser.participation;
      }
    });
    return Promise.resolve();
  },
  async updateAssignment(updatedAssignment: any) {
    const index = weeklyAssignments.findIndex(
      (assignment) => assignment.id === updatedAssignment.id,
    );
    if (index !== -1) {
      weeklyAssignments[index] = updatedAssignment;
    }
    return Promise.resolve();
  },
  async updateAssignmentStatus(updatedAssignment: any) {
    const index = weeklyAssignments.findIndex(
      (assignment) => assignment.id === updatedAssignment.id,
    );
    if (index !== -1) {
      weeklyAssignments[index].status = updatedAssignment.status;
    }
    return Promise.resolve();
  },
  async triggerReassignment() {
    // Logic to reassign todos
    return Promise.resolve();
  },
};
