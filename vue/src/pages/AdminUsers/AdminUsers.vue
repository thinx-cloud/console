<template>
  <div>
    <div class="page-top-line">
      <h1>Admin · Users</h1>
    </div>
    <b-alert variant="danger" :show="!!error" dismissible @dismissed="error = ''">{{ error }}</b-alert>
    <b-alert variant="success" :show="!!message" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <div v-if="loading">Loading users…</div>
    <div v-else>
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Admin</th>
            <th>Last login</th>
            <th>Devices</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in pagedUsers" :key="user.owner">
            <td>{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>
              <b-badge v-if="user.admin" variant="success">Yes</b-badge>
              <span v-else class="text-muted">—</span>
            </td>
            <td>{{ formatDate(user.last_login) }}</td>
            <td>{{ user.device_count }}</td>
            <td>
              <b-button size="sm" variant="danger" class="mr-1" @click="confirmRevoke(user)">Revoke</b-button>
              <b-button v-if="!user.admin" size="sm" variant="warning" @click="confirmImpersonate(user)">Impersonate</b-button>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="6" class="text-center text-muted">No users.</td>
          </tr>
        </tbody>
      </table>

      <div class="d-flex align-items-center">
        <b-button size="sm" :disabled="page === 1" @click="page = page - 1">Prev</b-button>
        <span class="mx-2">Page {{ page }} / {{ totalPages }}</span>
        <b-button size="sm" :disabled="page >= totalPages" @click="page = page + 1">Next</b-button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapActions, mapGetters } from "vuex";

export default {
  name: "AdminUsers",
  data() {
    return {
      loading: true,
      error: '',
      message: '',
      page: 1,
      pageSize: 20,
    };
  },
  computed: {
    users() { return this.getUsers() || []; },
    totalPages() { return Math.max(1, Math.ceil(this.users.length / this.pageSize)); },
    pagedUsers() {
      const start = (this.page - 1) * this.pageSize;
      return this.users.slice(start, start + this.pageSize);
    },
  },
  async created() {
    try {
      await this.fetchUsers();
    } catch (e) {
      this.error = 'Failed to load users.';
    } finally {
      this.loading = false;
    }
  },
  methods: {
    ...mapGetters({ getUsers: 'admin/getUsers' }),
    ...mapActions({
      fetchUsers: 'admin/fetchUsers',
      revokeSession: 'admin/revokeSession',
      impersonate: 'admin/impersonate',
      persistSession: 'auth/persistSession',
    }),
    formatDate(ts) {
      if (!ts) return '—';
      try { return new Date(ts).toLocaleString(); } catch (_e) { return String(ts); }
    },
    async confirmRevoke(user) {
      this.error = '';
      this.message = '';
      const ok = await this.$bvModal.msgBoxConfirm(
        'Force-logout ' + user.username + '? This invalidates all their access and refresh tokens.',
        { title: 'Revoke Sessions', okVariant: 'danger', okTitle: 'Force logout', size: 'sm' }
      );
      if (!ok) return;
      const result = await this.revokeSession({ owner: user.owner });
      if (result && result.success) {
        this.message = 'Sessions revoked for ' + user.username + '.';
      } else {
        this.error = (result && result.response && result.response.toString()) || 'Failed to revoke sessions.';
      }
    },
    async confirmImpersonate(user) {
      this.error = '';
      this.message = '';
      const ok = await this.$bvModal.msgBoxConfirm(
        'Impersonate ' + user.username + '? You will be logged in as them for 15 minutes; every action is audit-logged.',
        { title: 'Impersonate User', okVariant: 'warning', okTitle: 'Impersonate', size: 'sm' }
      );
      if (!ok) return;
      const result = await this.impersonate({ owner: user.owner });
      if (!result || !result.success) {
        this.error = (result && result.response && result.response.toString()) || 'Failed to impersonate.';
        return;
      }
      const access_token = result.response && result.response.access_token;
      if (!access_token) {
        this.error = 'Impersonation token missing from server response.';
        return;
      }
      await this.persistSession({ accessToken: access_token, refreshToken: null });
      this.$router.push('/app/dashboard');
    },
  },
};
</script>
