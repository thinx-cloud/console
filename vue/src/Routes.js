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

import RepoManager from '@/pages/Repositories/Repositories';
import ApikeyManager from '@/pages/Apikeys/Apikeys';
import RsakeyManager from '@/pages/Rsakeys/Rsakeys';
import EnviroManager from '@/pages/Enviros/Enviros';
import ChannelManager from '@/pages/Channels/Channels';
import DeviceManager from '@/pages/Devices/Devices';
import TransformerManager from '@/pages/Transformers/Transformers';

import HistoryManager from '@/pages/History/History';


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
          component: DeviceManager, // Devices,
        },
        {
          path: 'apikeys',
          name: 'API Keys',
          component: ApikeyManager, // ApikeyManager,
        },
        {
          path: 'repositories',
          name: 'Repositories',
          component: RepoManager, // RepoManager,
        },
        {
          path: 'history',
          name: 'History',
          component: HistoryManager, // History,
        },

        {
          path: 'rsakeys',
          name: 'RSA Keys',
          component: RsakeyManager, // DeploykeyManager,
        },

        {
          path: 'transformers',
          name: 'Transformers',
          component: TransformerManager, // Transformers,
        },

        {
          path: 'enviros',
          name: 'Environment Globals',
          component: EnviroManager, // EnviroManager,
        },

        {
          path: 'channels',
          name: 'Mesh Channels',
          component: ChannelManager, // ChannelManager,
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
  ]
});
