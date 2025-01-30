import './assets/base.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { createAuth0 } from '@auth0/auth0-vue';
import router from './router';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Aura from '@primevue/themes/aura';
import { definePreset } from '@primevue/themes';
import 'primeicons/primeicons.css';

const app = createApp(App);
const pinia = createPinia();

app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      redirect_uri: window.location.origin,
    },
  }),
);
app.use(pinia);
app.use(router);

// Define a custom preset
const MyPreset = definePreset(Aura, {
  components: {
    menubar: {
      // currently not working in prime vue, handled in js/css
      // item: {
      //   active: {
      //     background: "red",
      //   },
      // },
      border: {
        color: 'none',
      },
      background: 'none',
    },
  },
  semantic: {
    // currently not working in prime vue, handled in js/css
    //databaseHeaderCellBackground: 'red',
    // datatable: {
    //   header: {
    //     border: {
    //       color: 'red',
    //     },
    //     cell: {
    //       background: 'red',
    //     },
    //   },
    // },
    transitionDuration: '0.2s',
    focusRing: {
      width: '1px',
      style: 'solid',
      color: '{primary.color}',
      offset: '2px',
      shadow: 'none',
    },
    disabledOpacity: '0.6',
    iconSize: '1rem',
    anchorGutter: '2px',
    primary: {
      50: '#f8fcfb',
      100: '#dbf2eb',
      200: '#bfe8da',
      300: '#a3deca',
      400: '#87d4ba',
      500: '#6bcaaa',
      600: '#5bac91',
      700: '#4b8d77',
      800: '#3b6f5e',
      900: '#2b5144',
      950: '#1b332b',
    },
    colorScheme: {
      dark: {
        primary: {
          100: '#1b332b',
        },
      },
    },
  },
});

app.use(PrimeVue, {
  theme: {
    preset: MyPreset,
    options: {
      darkModeSelector: '.dark-mode',
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities',
      },
    },
  },
});
app.use(ToastService);
app.use(ConfirmationService);

app.mount('#app');
