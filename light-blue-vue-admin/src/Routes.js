import Vue from 'vue';
import Router from 'vue-router';

import Layout from '@/components/Layout/Layout';
import Typography from '@/pages/Typography/Typography';
import Tables from '@/pages/Tables/Tables';
import Notifications from '@/pages/Notifications/Notifications';
import Icons from '@/pages/Icons/Icons';
import Maps from '@/pages/Maps/Maps';
import Charts from '@/pages/Charts/Charts';
import Login from '@/pages/Login/Login';
import ErrorPage from '@/pages/Error/Error';

import Dashboard from '@/pages/Visits/Visits';

import SourceManager from '@/pages/Sources/Sources';

Vue.use(Router);

export default new Router({
  mode: 'hash',
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: Login,
    },
    {
      path: '/error',
      name: 'Error',
      component: ErrorPage,
    },
    {
      path: '/app',
      name: 'Layout',
      component: Layout,
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: Dashboard,
        },
        {
          path: 'devices',
          name: 'Devices',
          component: SourceManager, // Devices,
        },
        {
          path: 'apikeys',
          name: 'API Keys',
          component: SourceManager, // ApikeyManager,
        },
        {
          path: 'sources',
          name: 'Code Sources',
          component: SourceManager, // SourceManager,
        },
        {
          path: 'history',
          name: 'History',
          component: SourceManager, // History,
        },

        {
          path: 'delpoykeys',
          name: 'Delpoy Keys',
          component: SourceManager, // DeploykeyManager,
        },

        {
          path: 'transformers',
          name: 'Transformers',
          component: SourceManager, // Transformers,
        },

        {
          path: 'enviros',
          name: 'Environment Globals',
          component: SourceManager, // EnviroManager,
        },

        {
          path: 'channels',
          name: 'Mesh Channels',
          component: SourceManager, // ChannelManager,
        },

// TODO femove template routes

        {
          path: 'typography',
          name: 'Typography',
          component: Typography,
        },
        {
          path: 'tables',
          name: 'Tables',
          component: Tables,
        },
        {
          path: 'notifications',
          name: 'Notifications',
          component: Notifications,
        },
        {
          path: 'components/icons',
          name: 'Icons',
          component: Icons,
        },
        {
          path: 'components/maps',
          name: 'Maps',
          component: Maps,
        },
        {
          path: 'components/charts',
          name: 'Charts',
          component: Charts,
        },
      ],
    },
    {
      path: '*',
      name: 'RootError',
      component: ErrorPage,
    }
  ],
});
