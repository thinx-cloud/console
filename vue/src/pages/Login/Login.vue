<template>
  <div class="auth-page">
    <b-container>
      <Widget
        class="widget-auth mx-auto"
        title="<h3 class='mt-0'>THiNX Login</h3>"
        customHeader
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
                required
                placeholder="Password"
              />
            </b-input-group>
          </b-form-group>
          <div class="bg-widget auth-widget-footer">
            <b-button type="submit" variant="danger" class="auth-btn" size="sm">
              Login
            </b-button>
            <p class="widget-auth-info mt-4">Don't have an account? Sign up now!</p>
            <router-link class="d-block text-center mb-4" to="login"
              >Create an Account</router-link
            >
            <div class="social-buttons">
              <b-button variant="success" class="social-button">
                <i class="social-icon social-github"></i>
                <p class="social-text">GitHub</p>
              </b-button>
              <b-button variant="primary" class="social-button">
                <i class="social-icon social-google"></i>
                <p class="social-text">Google</p>
              </b-button>
            </div>
          </div>
        </form>
      </Widget>
    </b-container>
    <footer class="auth-footer">
      <a :href="env.VUE_APP_CONSOLE_HOSTNAME" target="_blank">THiNX Console</a> by <a :href="env.VUE_APP_LANDING_HOSTNAME" target="_blank">THiNX Cloud</a>
    </footer>
  </div>
</template>

<script>
import Widget from "@/components/Widget/Widget";
import { mapMutations, mapGetters, mapActions } from "vuex";

export default {
  name: "LoginPage",
  components: { Widget },
  data() {
    return {
      errorMessage: null,
      env: process.env,
    };
  },
  methods: {
    ...mapMutations({ setAccessToken: "auth/setAccessToken", setRefreshToken: "auth/setRefreshToken", setUser: "auth/setUser" }),
    ...mapActions({ fetchProfile: "profile/fetchProfile" }),
    ...mapGetters({ isLoggedIn: "auth/isLoggedIn", getProfile: "profile/getProfile" }),
    async login(e) {
      e.preventDefault();

      if (username.length !== 0 && password.length !== 0) {
        // TODO start JWT login scenario
        const response = await fetch(process.env.VUE_APP_API_HOSTNAME + "/v2/login", {
          method: 'POST',
          // mode: 'no-cors', // no-cors, *cors, same-origin
          redirect: 'manual', // manual, *follow, error
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            // 'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            username: this.$refs.username.value,
            password: this.$refs.password.value,
          }),
        });

        const { status, success, access_token, refresh_token, redirectURL, g } = await response.json();

        if (success) {
          this.setAccessToken(access_token);
          window.localStorage.setItem('accessToken', access_token);
          this.setRefreshToken(access_token);
          window.localStorage.setItem('refreshToken', refresh_token);

          window.localStorage.setItem('authenticated', true);
          this.fetchProfile().then(() => {
            this.setUser(this.getProfile());
            this.$router.push('/app/dashboard');
          });
        } else {
          this.errorMessage = 'Invalid username or password';
        }
      }
    },
  },
  created() {
    // TTODO validate
    const accessToken = window.localStorage.getItem('accessToken');
    const refreshToken = window.localStorage.getItem('refreshToken');
    const authenticated = window.localStorage.getItem('authenticated');
    if (authenticated === 'true' && typeof accessToken !== 'undefined') {
      this.setAccessToken(accessToken);
      this.setRefreshToken(refreshToken);
      this.$router.push("/app/dashboard");
    }
  },
};
</script>
