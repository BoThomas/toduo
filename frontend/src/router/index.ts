import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '@/components/Dashboard.vue';
import TheDoings from '@/components/TheDoings.vue';
import TheDuo from '@/components/TheDuo.vue';
import Reports from '@/components/Reports.vue';
import Settings from '@/components/Settings.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard,
    },
    {
      path: '/doings',
      name: 'Doings',
      component: TheDoings,
    },
    {
      path: '/duo',
      name: 'Duo',
      component: TheDuo,
    },
    {
      path: '/report',
      name: 'Report',
      component: Reports,
    },
    {
      path: '/settings',
      name: 'Settings',
      component: Settings,
    },
  ],
});

export default router;
