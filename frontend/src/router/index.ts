import { createRouter, createWebHistory } from 'vue-router';

const Dashboard = () => import('@/components/Dashboard.vue');
const TheDoings = () => import('@/components/TheDoings.vue');
const TheDuo = () => import('@/components/TheDuo.vue');
const Reports = () => import('@/components/Reports.vue');
const Settings = () => import('@/components/Settings.vue');

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
