import Vue from 'vue';
import Router from 'vue-router';

import store from '@/store';

import Layout from '@/components/Layout/Layout';
import Login from '@/pages/Login/Login';
import PasswordResetPage from '@/pages/PasswordReset/PasswordReset';
import ErrorPage from '@/pages/Error/Error';
import OAuthReturnPage from '@/pages/OAuthReturn/OAuthReturn';

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
import AdminUsersPage from '@/pages/AdminUsers/AdminUsers';


Vue.use(Router);

const router = new Router({
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
      path: '/oauth-return',
      name: 'OAuthReturn',
      component: OAuthReturnPage,
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
        {
          path: 'admin/users',
          name: 'AdminUsers',
          component: AdminUsersPage,
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

// AUTH-03 G5 — global auth guard so a torn-down session (clearSession ran but
// the one-shot hash redirect was missed) can't navigate freely under /app/*.
// Reads in-memory store first; falls back to localStorage for the cold-reload
// path where App.vue.created hasn't yet rehydrated the store.
const PUBLIC_PATHS = ['/login', '/password-reset', '/error', '/oauth-return'];
const ADMIN_PATHS = ['/app/admin'];
router.beforeEach((to, from, next) => {
  if (PUBLIC_PATHS.includes(to.path)) return next();
  if (!to.path.startsWith('/app')) return next();
  const authed =
    !!(store && store.state && store.state.auth && store.state.auth.accessToken) ||
    !!(typeof window !== 'undefined' && window.localStorage.getItem('accessToken'));
  if (!authed) return next('/login');
  if (ADMIN_PATHS.some(p => to.path.startsWith(p))) {
    const profile = (store && store.state && store.state.profile && store.state.profile.profile);
    if (!profile || profile.admin !== true) return next('/app/dashboard');
  }
  next();
});

export default router;
