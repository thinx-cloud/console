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
          <b-form-group
            label="Timezone"
            description="IANA tz database name (e.g. Europe/Prague, America/Los_Angeles). The server computes the offset (with DST) when needed."
          >
            <b-form-input v-model="form.timezone_abbr" placeholder="e.g. Europe/Prague" />
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

          <!-- GitHub access token linking (#392 / GH-03). The stored token is never
               returned by the backend and is not part of the /profile payload, so
               there is no "current value" to display — only the masked input, the
               link action, and transient feedback after a submit. -->
          <b-card title="GitHub Access Token" class="mb-3">
            <p class="text-muted mb-2">
              Link a GitHub
              <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">personal access token</a>
              so THiNX can push your deploy (RSA) key to GitHub and access your private repositories.
              The token is validated with GitHub, stored securely, and never shown again.
            </p>
            <b-form @submit.prevent="linkGitHub">
              <b-form-group
                label="GitHub access token"
                description="Re-submitting a new token replaces the stored one."
              >
                <b-form-input
                  v-model="githubForm.token"
                  type="password"
                  autocomplete="off"
                  placeholder="ghp_…"
                  :disabled="githubLinking"
                />
              </b-form-group>
              <b-button type="submit" variant="primary" :disabled="githubLinking || !githubForm.token">
                {{ githubLinking ? 'Validating…' : 'Validate & link' }}
              </b-button>
            </b-form>
            <b-alert
              v-if="githubResult"
              :variant="githubResult.variant"
              show
              dismissible
              class="mt-3 mb-0"
              @dismissed="githubResult = null"
            >{{ githubResult.text }}</b-alert>
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
            <p class="mb-2">Open the admin console to manage users, revoke sessions, and impersonate non-admin users for support.</p>
            <router-link to="/app/admin/users" class="btn btn-primary btn-sm">Open Admin Console</router-link>
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
        // Matches the legacy storage shape (lib/thinx/owner.js + device.js consume
        // info.timezone_abbr; submitProfile in legacy thinx-api.js writes it).
        // The bare `info.timezone` key that earlier Vue versions wrote is silently
        // ignored by the device side — that was the persistence bug reported
        // 2026-05-24.
        timezone_abbr: '',
      },
      notifForm: {
        all: false,
        important: false,
        info: false,
      },
      avatarB64: null,
      avatarUploading: false,
      // GitHub access token linking (#392). Token is held only transiently while the
      // user types; cleared from component state immediately after a submit so it is
      // never retained. githubResult is the post-submit feedback banner.
      githubForm: {
        token: '',
      },
      githubLinking: false,
      githubResult: null,
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
    ...mapActions({ fetchProfile: 'profile/fetchProfile', updateProfile: 'profile/updateProfile', deleteAccount: 'profile/deleteAccount', uploadAvatar: 'profile/uploadAvatar', linkGitHubToken: 'profile/linkGitHubToken', clearSession: 'auth/clearSession' }),
    async loadProfile() {
      this.loading = true;
      await this.fetchProfile();
      this.profile = this.getProfile();
      if (this.profile && this.profile.info) {
        const info = this.profile.info;
        this.form.first_name = info.first_name || '';
        this.form.last_name = info.last_name || '';
        this.form.mobile_phone = info.mobile_phone || '';
        // Read `timezone_abbr` (canonical); fall back to the bare `timezone` key
        // for accounts whose only timezone value came from the earlier broken
        // Vue saveProfile path.
        this.form.timezone_abbr = info.timezone_abbr || info.timezone || '';
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
        timezone_abbr: this.form.timezone_abbr,
      });
      // Strip the legacy bare `timezone` key if present — it was the buggy field
      // name Vue used briefly; legacy + device.js consumers only read
      // timezone_abbr, so clearing it on save avoids two fields drifting out of
      // sync in the stored info blob.
      if (Object.prototype.hasOwnProperty.call(info, 'timezone')) delete info.timezone;
      const result = await this.updateProfile(info);
      this.saving = false;
      if (result.success) {
        // Refresh the local copy so the form re-hydrates from the just-saved info
        // on the next visit/reload without a fetchProfile round-trip.
        this.profile = this.getProfile();
        this.message = 'Profile updated.';
      } else {
        this.error = result.message || 'Failed to update profile.';
      }
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
    async linkGitHub() {
      const token = (this.githubForm.token || '').trim();
      if (!token) {
        this.githubResult = { variant: 'danger', text: 'Enter a GitHub access token first.' };
        return;
      }
      this.githubLinking = true;
      this.githubResult = null;
      const result = await this.linkGitHubToken(token);
      this.githubLinking = false;
      // Never retain the token in component state once it has been submitted.
      this.githubForm.token = '';
      if (result && result.success) {
        // Success payload is { key_pushed, created_key } (parsed by core/api.js into
        // result.response). Report whether a key was created vs. reused, and whether
        // the public key actually reached GitHub. key_pushed:false means the token
        // was stored but the key push failed — surface that as a warning, not success.
        const r = result.response || {};
        const keyPart = r.created_key ? 'a new RSA key was created' : 'your existing RSA key was used';
        const pushPart = r.key_pushed
          ? 'and pushed to GitHub'
          : 'but the public key could not be pushed to GitHub';
        this.githubResult = {
          variant: r.key_pushed ? 'success' : 'warning',
          text: 'GitHub token linked — ' + keyPart + ' ' + pushPart + '.',
        };
      } else {
        // Failure responses carry a string code in result.response:
        // 401 github_token_invalid, 400 missing_token, invalid_owner, plus the 500s.
        const code = result && result.response;
        const messages = {
          github_token_invalid: 'GitHub rejected this token. Check it is valid and has the required scopes, then try again.',
          missing_token: 'No token was provided.',
          invalid_owner: 'Your session is no longer valid. Please sign in again.',
          token_store_failed: 'The token could not be stored. Please try again.',
          rsa_key_creation_failed: 'Could not create an RSA key for your account. Please try again.',
        };
        this.githubResult = {
          variant: 'danger',
          text: (typeof code === 'string' && messages[code]) || 'Failed to link GitHub token. Please try again.',
        };
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
        // G7 fix: account is gone server-side, so tear down the local session
        // (persisted auth tokens + Vuex slots + cancel expiry timer) BEFORE
        // routing. Without this, the router.beforeEach guard treats the
        // orphaned page as still logged in
        // (same chokepoint as Header.vue#logout — Phase 8 Wave 2, 0295a69).
        await this.$store.dispatch('auth/clearSession');
        this.$router.push('/login');
      } else {
        this.error = result.message || 'Failed to delete account.';
      }
    },
  },
};
</script>
