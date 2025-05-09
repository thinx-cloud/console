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
              <b-button
                variant="success"
                class="social-button"
                :href="this.$hostnames.API + '/oauth/github'"
              >
                <i class="social-icon social-github"></i>
                <p class="social-text">GitHub</p>
              </b-button>
              <b-button
                variant="primary"
                class="social-button"
                :href="this.$hostnames.API + '/oauth/google'"
              >
                <i class="social-icon social-google"></i>
                <p class="social-text">Google</p>
              </b-button>
            </div>
          </div>
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
import { mapMutations, mapGetters, mapActions } from "vuex";
import hostnameMixin from "@/mixins/hostnames";

export default {
  name: "LoginPage",
  components: { Widget },
  mixins: [hostnameMixin],
  data() {
    return {
      errorMessage: null,
    };
  },
  methods: {
    ...mapMutations({
      setAccessToken: "auth/setAccessToken",
      setRefreshToken: "auth/setRefreshToken",
      setUser: "auth/setUser",
    }),
    ...mapActions({
      fetchProfile: "profile/fetchProfile",
      isTokenValid: "auth/isTokenValid",
    }),
    ...mapGetters({
      isAuthenticated: "auth/isAuthenticated",
      getProfile: "profile/getProfile",
    }),
    async login(e) {
      e.preventDefault();
      const usernameValue = this.$refs.username.value;
      const passwordValue = this.$refs.password.value;
      
      if (usernameValue.length !== 0 && passwordValue.length !== 0) {
        // TODO start JWT login scenario
        const response = await fetch(this.$hostnames.API + "/login", {
          method: "POST",
          // mode: 'no-cors', // no-cors, *cors, same-origin
          redirect: "manual",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "http://localhost:3080 " + this.$hostnames.API,
          },
          body: JSON.stringify({
            username: this.$refs.username.value,
            password: this.$refs.password.value,
          }),
        });

        const {
          // status, // Unused variable
          success,
          access_token,
          refresh_token,
          // redirectURL, // Unused variable
          // g, // Unused variable
        } = await response.json();

        if (success) {
          console.log("VAL ACC", await this.isTokenValid(access_token));
          console.log("VAL REF", await this.isTokenValid(refresh_token), refresh_token);

          if (
            (await this.isTokenValid(access_token)) &&
            (await this.isTokenValid(refresh_token))
          ) {
            this.setAccessToken(access_token);
            this.setRefreshToken(refresh_token);
          }

          if (this.isAuthenticated()) {
            window.localStorage.setItem("accessToken", access_token);
            window.localStorage.setItem("refreshToken", refresh_token);
            window.localStorage.setItem("authenticated", true);

            this.fetchProfile().then(() => {
              this.setUser(this.getProfile());
              this.$router.push("/app/dashboard");
            });
          } else {
            this.errorMessage = "Token expired";
          }
        } else {
          this.errorMessage = "Invalid username or password";
        }
      }
    },
  },
  created() {
    // TTODO validate
    const authenticated = window.localStorage.getItem("authenticated") === "true";
    const accessToken = window.localStorage.getItem("accessToken");
    const refreshToken = window.localStorage.getItem("refreshToken");

    if (authenticated && accessToken) {
      this.setAccessToken(accessToken);
      this.setRefreshToken(refreshToken);
      this.$router.push("/app/dashboard");
    }
  },
};
</script>
