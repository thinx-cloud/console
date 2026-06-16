<template>
  <div class="auth-page">
    <b-container>
      <Widget
        class="widget-auth mx-auto"
        title="THiNX Login"
      >
        <p class="widget-auth-info">Use your username to sign in.</p>
        <form class="mt" @submit.prevent="login">
          <b-alert class="alert-sm" variant="danger" :show="!!errorMessage">
            {{ errorMessage }}
          </b-alert>

          <!--
          <b-form-group label="Email" label-for="email">
            <b-input-group>
              <b-input-group-text slot="prepend"><i class="la la-user text-white"></i></b-input-group-text>
              <input id="email"
                     ref="email"
                     class="form-control input-transparent pl-3"
                     type="email"
                     required
                     placeholder="Email"/>
            </b-input-group>
          </b-form-group>
-->
          <b-form-group label="Username" label-for="username">
            <b-input-group>
              <b-input-group-text slot="prepend"
                ><i class="la la-user text-white"></i
              ></b-input-group-text>
              <input
                id="username"
                ref="username"
                class="form-control input-transparent pl-3"
                type="text"
                autocomplete="username"
                required
                placeholder="Username"
              />
            </b-input-group>
          </b-form-group>
          <b-form-group label="Password" label-for="password">
            <b-input-group>
              <b-input-group-text slot="prepend"
                ><i class="la la-lock text-white"></i
              ></b-input-group-text>
              <input
                id="password"
                ref="password"
                class="form-control input-transparent pl-3"
                type="password"
                autocomplete="current-password"
                required
                placeholder="Password"
              />
            </b-input-group>
          </b-form-group>
          <router-link class="d-block text-center mb-2" to="/password-reset">Forgot password?</router-link>
          <div class="bg-widget auth-widget-footer">
            <b-button type="submit" variant="danger" class="auth-btn" size="sm">
              Login
            </b-button>
            <p class="widget-auth-info mt-4">Don't have an account? Sign up now!</p>
            <router-link class="d-block text-center mb-4" to="login"
              >Create an Account</router-link
            >
            <div class="social-buttons">
              <b-button
                size="sm"
                variant="light"
                class="social-button social-button--google"
                :href="this.$hostnames.API + '/oauth/google'"
              >
                <i class="fa fa-google"></i> Login with Google
              </b-button>
              <b-button
                size="sm"
                variant="dark"
                class="social-button social-button--github"
                :href="this.$hostnames.API + '/oauth/github'"
              >
                <i class="fa fa-github"></i> Login with GitHub
              </b-button>
            </div>
          </div>
        </form>
      </Widget>
    </b-container>
    <footer class="auth-footer">
      <a :href="this.$hostnames.CONSOLE" target="_blank">THiNX Console</a> by
      <a :href="this.$hostnames.LANDING" target="_blank">THiNX Cloud</a>
      <span class="build-id" style="display:block;font-size:0.7rem;opacity:0.5;margin-top:4px">{{ buildHash }}</span>
    </footer>
  </div>
</template>

<script>
import Widget from "@/components/Widget/Widget";
import { mapGetters, mapActions } from "vuex";
import hostnameMixin from "@/mixins/hostnames";

export default {
  name: "LoginPage",
  components: { Widget },
  mixins: [hostnameMixin],
  data() {
    return {
      errorMessage: null,
      buildHash: process.env.VUE_APP_BUILD_HASH || '',
    };
  },
  methods: {
    ...mapActions({
      persistSession: "auth/persistSession",
      hydrateSession: "auth/hydrateSession",
      fetchProfile: "profile/fetchProfile",
      isTokenValid: "auth/isTokenValid",
    }),
    ...mapGetters({
      isAuthenticated: "auth/isAuthenticated",
      getProfile: "profile/getProfile",
    }),
    async pushIfNeeded(location) {
      if (this.$route.fullPath === location) {
        return;
      }

      try {
        await this.$router.push(location);
      } catch (error) {
        if (!error || error.name !== "NavigationDuplicated") {
          throw error;
        }
      }
    },
    async login(e) {
      e.preventDefault();
      this.errorMessage = null;
      const usernameValue = this.$refs.username.value;
      const passwordValue = this.$refs.password.value;
      
      if (usernameValue.length === 0 || passwordValue.length === 0) {
        this.errorMessage = "Enter both username and password.";
        return;
      }

      let response;
      try {
        response = await fetch(this.$hostnames.API + "/login", {
          method: "POST",
          // mode: 'no-cors', // no-cors, *cors, same-origin
          redirect: "manual",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: usernameValue,
            password: passwordValue,
          }),
        });
      } catch (networkError) {
        this.errorMessage = "Cannot reach the server. Check your connection and try again.";
        return;
      }

      // The server returns JSON for both success and credential failures
      // (403). A non-JSON body means a 5xx / gateway HTML error page — parse
      // defensively so the page shows a message instead of throwing.
      let payload;
      try {
        payload = await response.json();
      } catch (parseError) {
        this.errorMessage = response.status >= 500
          ? "Server error during login. Please try again in a moment."
          : "Unexpected response from the server. Please try again.";
        return;
      }

      const { success, access_token, refresh_token } = payload || {};

      if (!success) {
        this.errorMessage = (payload && payload.message)
          ? "Login failed: " + payload.message
          : "Invalid username or password";
        return;
      }

      if (
        (await this.isTokenValid(access_token)) &&
        (await this.isTokenValid(refresh_token))
      ) {
        await this.persistSession({ accessToken: access_token, refreshToken: refresh_token });
      }

      if (this.isAuthenticated()) {
        await this.fetchProfile();
        this.$store.commit("auth/setUser", this.getProfile());
        await this.pushIfNeeded("/app/dashboard");
      } else {
        this.errorMessage = "Token expired";
      }
    },
  },
  async created() {
    if (await this.hydrateSession()) {
      void this.pushIfNeeded("/app/dashboard");
    }
  },
};
</script>
