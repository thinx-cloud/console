<template>
  <div>
    <b-breadcrumb>
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

      <!-- Avatar Tab -->
      <b-tab title="Avatar">
        <div style="max-width:400px">
          <div class="mb-3">
            <img
              :src="avatarSrc"
              class="rounded-circle mb-2"
              style="width:96px;height:96px;object-fit:cover"
              alt="Profile avatar"
            />
          </div>
          <b-form-group label="Upload new avatar (JPEG or PNG, max 2 MB)">
            <b-form-file
              accept="image/jpeg,image/png"
              @change="onAvatarFileChange"
              :disabled="avatarUploading"
            />
          </b-form-group>
          <b-button
            variant="primary"
            :disabled="!avatarB64 || avatarUploading"
            @click="saveAvatar"
          >
            {{ avatarUploading ? 'Uploading...' : 'Save Avatar' }}
          </b-button>
        </div>
      </b-tab>

      <!-- Account Tab -->
      <b-tab title="Account">
        <div style="max-width:500px">
          <b-card title="Account Details" class="mb-3">
            <table class="table table-sm table-borderless mb-0">
              <tr><td class="text-muted" style="width:120px">Username</td><td>{{ profile && profile.username }}</td></tr>
              <tr><td class="text-muted">Email</td><td>{{ profile && profile.info && profile.info.email }}</td></tr>
              <tr>
                <td class="text-muted">Owner ID</td>
                <td>
                  <div class="d-flex align-items-center" style="gap:6px">
                    <code style="font-size:11px;word-break:break-all;flex:1;min-width:0">{{ profile && profile.owner }}</code>
                    <b-button
                      v-if="profile && profile.owner"
                      size="sm"
                      variant="link"
                      class="p-0"
                      title="Copy Owner ID to clipboard"
                      @click="copyToClipboard(profile.owner)"
                    ><i class="la la-copy"></i></b-button>
                  </div>
                </td>
              </tr>
            </table>
          </b-card>

          <b-card title="Delete Account" border-variant="danger">
            <p class="text-danger">This action is permanent and cannot be undone. All devices, repositories, and data will be deleted.</p>
            <b-button variant="danger" @click="confirmDeleteAccount">Delete My Account</b-button>
          </b-card>
        </div>
      </b-tab>

      <!-- Admin Tab — visible only to admin users (v-if removes from DOM for non-admins) -->
      <b-tab v-if="profile && profile.admin === true" title="Admin">
        <div style="max-width:500px">
          <b-card title="Admin Status" class="mb-3">
            <table class="table table-sm table-borderless mb-0">
              <tr><td class="text-muted" style="width:140px">Username</td><td>{{ profile && profile.username }}</td></tr>
              <tr>
                <td class="text-muted">Owner ID</td>
                <td>
                  <div class="d-flex align-items-center" style="gap:6px">
                    <code style="font-size:11px;word-break:break-all;flex:1;min-width:0">{{ profile && profile.owner }}</code>
                    <b-button
                      v-if="profile && profile.owner"
                      size="sm"
                      variant="link"
                      class="p-0"
                      title="Copy Owner ID to clipboard"
                      @click="copyToClipboard(profile.owner)"
                    ><i class="la la-copy"></i></b-button>
                  </div>
                </td>
              </tr>
              <tr><td class="text-muted">Admin</td><td><b-badge variant="success">Yes</b-badge></td></tr>
            </table>
          </b-card>
          <b-card border-variant="secondary">
            <p class="text-muted mb-0">
              <i class="la la-info-circle mr-1"></i>
              Admin-management features (user list, session revocation, impersonation) are not yet available in this API version.
              This tab will be expanded when backend admin endpoints are implemented.
            </p>
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
      avatarB64: null,
      avatarUploading: false,
    };
  },
  computed: {
    avatarSrc() {
      if (this.profile && this.profile.avatar && this.profile.avatar.length > 0) {
        return 'data:image/png;base64,' + this.profile.avatar;
      }
      return require('@/assets/thinx/default_avatar_sm.png');
    },
  },
  created() {
    this.loadProfile();
  },
  methods: {
    ...mapGetters({ getProfile: 'profile/getProfile' }),
    ...mapActions({ fetchProfile: 'profile/fetchProfile', updateProfile: 'profile/updateProfile', deleteAccount: 'profile/deleteAccount', uploadAvatar: 'profile/uploadAvatar' }),
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
      // Merge form fields into existing info — the backend writes the full info
      // blob, so sending only form fields would wipe email, notifications,
      // security, tags, transformers, goals, avatar. Same data-loss pattern as
      // saveNotifications fixed in 06-02; missed there for saveProfile.
      const existingInfo = (this.profile && this.profile.info) ? Object.assign({}, this.profile.info) : {};
      const info = Object.assign(existingInfo, {
        first_name: this.form.first_name,
        last_name: this.form.last_name,
        mobile_phone: this.form.mobile_phone,
        timezone: this.form.timezone,
      });
      const result = await this.updateProfile(info);
      this.saving = false;
      if (result.success) this.message = 'Profile updated.';
      else this.error = result.message || 'Failed to update profile.';
    },
    async saveNotifications() {
      this.saving = true;
      const existingInfo = (this.profile && this.profile.info) ? Object.assign({}, this.profile.info) : {};
      const info = Object.assign(existingInfo, {
        notifications: {
          all: this.notifForm.all,
          important: this.notifForm.important,
          info: this.notifForm.info,
        },
      });
      const result = await this.updateProfile(info);
      this.saving = false;
      if (result && result.success) this.message = 'Notification preferences saved.';
      else this.error = (result && result.message) || 'Failed to save notifications.';
    },
    onAvatarFileChange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target.result; // e.g. "data:image/png;base64,AAAA..."
        const commaIdx = dataUri.indexOf(',');
        this.avatarB64 = commaIdx !== -1 ? dataUri.substring(commaIdx + 1) : dataUri;
      };
      reader.readAsDataURL(file);
    },
    async saveAvatar() {
      if (!this.avatarB64) return;
      this.avatarUploading = true;
      const result = await this.uploadAvatar(this.avatarB64);
      this.avatarUploading = false;
      if (result && result.success) {
        this.profile = this.getProfile();
        this.message = 'Avatar updated.';
        this.avatarB64 = null;
      } else {
        this.error = (result && result.message) || 'Failed to upload avatar.';
      }
    },
    copyToClipboard(value) {
      // Mirror the Apikeys.vue copy pattern — async clipboard API with a
      // document.execCommand fallback, plus a toast confirmation.
      navigator.clipboard.writeText(value).catch(() => {
        const el = document.createElement('textarea');
        el.value = value;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
      this.$toasted.show('Copied to clipboard', { type: 'success', duration: 2000 });
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
