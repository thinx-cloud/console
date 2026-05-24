import Vue from 'vue';
import Router from 'vue-router';

import Layout from '@/components/Layout/Layout';
import Login from '@/pages/Login/Login';
import PasswordResetPage from '@/pages/PasswordReset/PasswordReset';
import ErrorPage from '@/pages/Error/Error';

import Dashboard from '@/pages/Visits/Visits';

import RepoManager from '@/pages/Repositories/Repositories';
import ApikeyManager from '@/pages/Apikeys/Apikeys';
import RsakeyManager from '@/pages/Rsakeys/Rsakeys';
import EnviroManager from '@/pages/Enviros/Enviros';
import ChannelManager from '@/pages/Channels/Channels';
import DeviceManager from '@/pages/Devices/Devices';
import DeviceDetail from '@/pages/Devices/DeviceDetail';
import TransformerManager from '@/pages/Transformers/Transformers';
import TransformerEditor from '@/pages/Transformers/TransformerEditor';

import HistoryManager from '@/pages/History/History';
import ProfilePage from '@/pages/Profile/Profile';


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
      path: '/password-reset',
      name: 'PasswordReset',
      component: PasswordResetPage,
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
          component: DeviceManager,
        },
        {
          path: 'device/:udid',
          name: 'DeviceDetail',
          component: DeviceDetail,
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
          component: HistoryManager, // History,
          children: [
            { path: '', redirect: 'audit' },
            { path: 'audit', name: 'HistoryAudit', component: HistoryManager },
            { path: 'builds', name: 'HistoryBuilds', component: HistoryManager },
          ],
        },

        {
          path: 'rsakeys',
          name: 'RSA Keys',
          component: RsakeyManager, // DeploykeyManager,
        },

        {
          path: 'transformers',
          name: 'Transformers',
          component: TransformerManager,
        },
        {
          path: 'transformer/:utid',
          name: 'TransformerEditor',
          component: TransformerEditor,
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
        {
          path: 'profile',
          name: 'Profile',
          component: ProfilePage,
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
