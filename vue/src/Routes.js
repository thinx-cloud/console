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
          name: 'Deploy Keys',
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
// Reads the in-memory store first; on a cold reload (tokens are never persisted
// in browser storage) it re-mints one from the httpOnly session cookie.
//
// NOTIF-04 (audit W1): on a cold reload the profile store is still its initial
// empty object (nothing loads the profile before the first navigation), so the
// admin check loads the profile first and decides from the server's answer. The
// guard is a UX gate only — the API enforces admin on every /api/v2/admin route.
// A profile that cannot be loaded fails closed to the dashboard.
const PUBLIC_PATHS = ['/login', '/password-reset', '/error', '/oauth-return'];
const ADMIN_PATHS = ['/app/admin'];

// Resolves true only when the loaded profile carries admin === true; never rejects.
// Fetches the profile only while the store still holds the initial empty object, so
// a loaded admin or a loaded non-admin is decided without a request. That shortcut
// relies on the store never holding a previous account, so every in-tab identity switch
// resets the profile to {}: auth/logout after sign-out, Login/OAuthReturn before their
// read, AdminUsers.confirmImpersonate before it reads the impersonated user's profile, and
// ImpersonationBanner.exit before the admin's session is re-hydrated (48.1-REVIEW WR-01).
async function isAdminSession() {
  const profileOf = () => (store && store.state && store.state.profile && store.state.profile.profile);
  let profile = profileOf();
  if (!profile || Object.keys(profile).length === 0) {
    try {
      await store.dispatch('profile/fetchProfile');
    } catch (_error) {
      // A failed read leaves the store as it was; the check below fails closed.
    }
    profile = profileOf();
  }
  return !!profile && profile.admin === true;
}

router.beforeEach(async (to, from, next) => {
  if (PUBLIC_PATHS.includes(to.path)) return next();
  if (!to.path.startsWith('/app')) return next();
  const authed =
    !!(store && store.state && store.state.auth && store.state.auth.accessToken) ||
    !!(store && await store.dispatch('auth/hydrateSession'));
  if (!authed) return next('/login');
  if (ADMIN_PATHS.some(p => to.path.startsWith(p))) {
    if (!(await isAdminSession())) return next('/app/dashboard');
  }
  next();
});

export default router;
