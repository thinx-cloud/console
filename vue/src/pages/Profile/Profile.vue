<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
      <b-breadcrumb-item active>My Profile</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">My Profile</h1>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
    <b-alert v-if="message" variant="success" show dismissible @dismissed="message = null">{{ message }}</b-alert>

    <div v-if="loading">Loading...</div>
    <b-tabs v-else content-class="mt-3">

      <!-- Profile Tab -->
      <b-tab title="Profile" active>
        <b-form @submit.prevent="saveProfile" style="max-width:500px">
          <b-form-group label="First Name">
            <b-form-input v-model="form.first_name" />
          </b-form-group>
          <b-form-group label="Last Name">
            <b-form-input v-model="form.last_name" />
          </b-form-group>
          <b-form-group label="Mobile Phone">
            <b-form-input v-model="form.mobile_phone" type="tel" />
          </b-form-group>
          <b-form-group label="Timezone">
            <b-form-input v-model="form.timezone" placeholder="e.g. Europe/Prague" />
          </b-form-group>
          <b-button type="submit" variant="primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Profile' }}
          </b-button>
        </b-form>
      </b-tab>

      <!-- Notifications Tab -->
      <b-tab title="Notifications">
        <b-form @submit.prevent="saveNotifications" style="max-width:400px">
          <b-form-group label="Notification preferences">
            <b-form-checkbox v-model="notifForm.all" class="mb-2">All notifications</b-form-checkbox>
            <b-form-checkbox v-model="notifForm.important" class="mb-2">Important notifications only</b-form-checkbox>
            <b-form-checkbox v-model="notifForm.info">Informational notifications</b-form-checkbox>
          </b-form-group>
          <b-button type="submit" variant="primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Notifications' }}
          </b-button>
        </b-form>
      </b-tab>

      <!-- Account Tab -->
      <b-tab title="Account">
        <div style="max-width:500px">
          <b-card title="Account Details" class="mb-3">
            <table class="table table-sm table-borderless mb-0">
              <tr><td class="text-muted" style="width:120px">Username</td><td>{{ profile && profile.username }}</td></tr>
              <tr><td class="text-muted">Email</td><td>{{ profile && profile.info && profile.info.email }}</td></tr>
              <tr><td class="text-muted">Owner ID</td><td><code style="font-size:11px">{{ profile && profile.owner }}</code></td></tr>
            </table>
          </b-card>

          <b-card title="Delete Account" border-variant="danger">
            <p class="text-danger">This action is permanent and cannot be undone. All devices, repositories, and data will be deleted.</p>
            <b-button variant="danger" @click="confirmDeleteAccount">Delete My Account</b-button>
          </b-card>
        </div>
      </b-tab>

    </b-tabs>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "Profile",
  data() {
    return {
      loading: true,
      saving: false,
      error: null,
      message: null,
      profile: null,
      form: {
        first_name: '',
        last_name: '',
        mobile_phone: '',
        timezone: '',
      },
      notifForm: {
        all: false,
        important: false,
        info: false,
      },
    };
  },
  created() {
    this.loadProfile();
  },
  methods: {
    ...mapGetters({ getProfile: 'profile/getProfile' }),
    ...mapActions({ fetchProfile: 'profile/fetchProfile', updateProfile: 'profile/updateProfile', deleteAccount: 'profile/deleteAccount' }),
    async loadProfile() {
      this.loading = true;
      await this.fetchProfile();
      this.profile = this.getProfile();
      if (this.profile && this.profile.info) {
        const info = this.profile.info;
        this.form.first_name = info.first_name || '';
        this.form.last_name = info.last_name || '';
        this.form.mobile_phone = info.mobile_phone || '';
        this.form.timezone = info.timezone || '';
        const notif = info.notifications || {};
        this.notifForm.all = !!notif.all;
        this.notifForm.important = !!notif.important;
        this.notifForm.info = !!notif.info;
      }
      this.loading = false;
    },
    async saveProfile() {
      this.saving = true;
      const result = await this.updateProfile({
        first_name: this.form.first_name,
        last_name: this.form.last_name,
        mobile_phone: this.form.mobile_phone,
        timezone: this.form.timezone,
      });
      this.saving = false;
      if (result.success) this.message = 'Profile updated.';
      else this.error = result.message || 'Failed to update profile.';
    },
    async saveNotifications() {
      this.saving = true;
      const result = await this.updateProfile({
        notifications: {
          all: this.notifForm.all,
          important: this.notifForm.important,
          info: this.notifForm.info,
        },
      });
      this.saving = false;
      if (result.success) this.message = 'Notification preferences saved.';
      else this.error = result.message || 'Failed to save notifications.';
    },
    async confirmDeleteAccount() {
      const confirmed = await this.$bvModal.msgBoxConfirm(
        'Are you absolutely sure? This will permanently delete your account and all associated data.',
        { title: 'Delete Account', okVariant: 'danger', okTitle: 'Yes, delete my account', size: 'sm' }
      );
      if (!confirmed) return;
      const result = await this.deleteAccount();
      if (result.success) {
        this.$router.push('/login');
      } else {
        this.error = result.message || 'Failed to delete account.';
      }
    },
  },
};
</script>
