<template>
  <div class="auth-page">
    <b-container>
      <Widget
        class="widget-auth mx-auto"
        title="Password Reset"
      >
        <!-- Initiate form -->
        <form v-if="!hasResetToken" @submit.prevent="submitInitiate">
          <b-alert variant="success" :show="!!successMessage">{{ successMessage }}</b-alert>
          <b-alert variant="danger" :show="!!errorMessage">{{ errorMessage }}</b-alert>
          <p class="widget-auth-info">Enter your account email to receive a password reset link.</p>
          <b-form-group label="Email" label-for="reset-email">
            <b-input-group>
              <b-input-group-text slot="prepend"
                ><i class="la la-envelope text-white"></i
              ></b-input-group-text>
              <input
                id="reset-email"
                v-model="email"
                class="form-control input-transparent pl-3"
                type="email"
                autocomplete="email"
                required
                placeholder="Email"
              />
            </b-input-group>
          </b-form-group>
          <b-button
            type="submit"
            variant="danger"
            class="auth-btn"
            size="sm"
            :disabled="submitting"
          >
            Send reset email
          </b-button>
          <router-link class="d-block text-center mt-3" to="/login"
            >Back to login</router-link
          >
        </form>

        <!-- Confirm form -->
        <form v-else @submit.prevent="submitConfirm">
          <b-alert variant="success" :show="!!successMessage">{{ successMessage }}</b-alert>
          <b-alert variant="danger" :show="!!errorMessage">{{ errorMessage }}</b-alert>
          <template v-if="!successMessage">
            <p class="widget-auth-info">Choose a new password for your account.</p>
            <b-form-group label="New password" label-for="reset-password">
              <b-input-group>
                <b-input-group-text slot="prepend"
                  ><i class="la la-lock text-white"></i
                ></b-input-group-text>
                <input
                  id="reset-password"
                  v-model="password"
                  class="form-control input-transparent pl-3"
                  type="password"
                  autocomplete="new-password"
                  required
                />
              </b-input-group>
            </b-form-group>
            <b-form-group label="Repeat password" label-for="reset-rpassword">
              <b-input-group>
                <b-input-group-text slot="prepend"
                  ><i class="la la-lock text-white"></i
                ></b-input-group-text>
                <input
                  id="reset-rpassword"
                  v-model="rpassword"
                  class="form-control input-transparent pl-3"
                  type="password"
                  autocomplete="new-password"
                  required
                />
              </b-input-group>
            </b-form-group>
            <b-button
              type="submit"
              variant="danger"
              class="auth-btn"
              size="sm"
              :disabled="submitting"
            >
              Set password
            </b-button>
          </template>
          <router-link v-else class="d-block text-center mt-3" to="/login"
            >Go to login</router-link
          >
        </form>
      </Widget>
    </b-container>
    <footer class="auth-footer">
      <a :href="this.$hostnames.CONSOLE" target="_blank">THiNX Console</a> by
      <a :href="this.$hostnames.LANDING" target="_blank">THiNX Cloud</a>
    </footer>
  </div>
</template>

<script>
import Widget from "@/components/Widget/Widget";
import { mapActions } from "vuex";

export default {
  name: "PasswordReset",
  components: { Widget },
  data() {
    return {
      email: "",
      password: "",
      rpassword: "",
      errorMessage: "",
      successMessage: "",
      submitting: false,
    };
  },
  computed: {
    hasResetToken() {
      return !!this.$route.query.reset_key || !!this.$route.query.activation;
    },
  },
  methods: {
    ...mapActions({
      requestPasswordReset: "auth/requestPasswordReset",
      confirmPasswordReset: "auth/confirmPasswordReset",
    }),
    async submitInitiate() {
      this.submitting = true;
      this.errorMessage = "";
      this.successMessage = "";
      try {
        const result = await this.requestPasswordReset({ email: this.email });
        if (result && result.success === true) {
          this.successMessage = "Reset email sent. Check your inbox.";
          this.email = "";
        } else {
          this.errorMessage =
            (result && result.response) || "Could not initiate reset.";
        }
      } catch (e) {
        this.errorMessage = "Network error. Please try again.";
      } finally {
        this.submitting = false;
      }
    },
    async submitConfirm() {
      // Client-side guards — port of legacy password.js:13-15 (min-length 4)
      // and password.js:17-20 (equalTo). Run BEFORE any backend call so the
      // user gets immediate feedback and no traffic is wasted on validation
      // the backend will reject anyway.
      if (this.password.length < 4) {
        this.errorMessage = "Password must be at least 4 characters.";
        return;
      }
      if (this.password !== this.rpassword) {
        this.errorMessage = "Passwords do not match.";
        return;
      }
      this.submitting = true;
      this.errorMessage = "";
      this.successMessage = "";
      try {
        const result = await this.confirmPasswordReset({
          owner: this.$route.query.owner,
          reset_key: this.$route.query.reset_key,
          activation: this.$route.query.activation,
          password: this.password,
          rpassword: this.rpassword,
        });
        if (result && result.success === true) {
          this.successMessage = "Password set. You can now log in.";
          this.password = "";
          this.rpassword = "";
        } else {
          this.errorMessage =
            (result && result.response) || "Could not set password.";
        }
      } catch (e) {
        this.errorMessage = "Network error. Please try again.";
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>
