<template>
  <div class="oauth-return-page d-flex flex-column align-items-center justify-content-center" style="min-height:60vh">
    <p>Completing sign-in…</p>
    <p v-if="errorMessage" class="text-danger mt-2">{{ errorMessage }}</p>
  </div>
</template>

<script>
import { mapMutations, mapGetters, mapActions } from "vuex";
import hostnameMixin from "@/mixins/hostnames";

// Landing page for the OAuth callback when the API was told to return to this
// console (?return=<origin>). The API redirected here as
//   <origin>/#/oauth-return?t=<one-shot-token>
// We exchange that token at /api/v2/login for JWTs (performTokenLogin now mints
// them) and complete the session exactly like the password Login.vue flow.
export default {
  name: "OAuthReturnPage",
  mixins: [hostnameMixin],
  data() {
    return { errorMessage: null };
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
      scheduleExpiry: "auth/scheduleExpiry",
    }),
    ...mapGetters({
      isAuthenticated: "auth/isAuthenticated",
      getProfile: "profile/getProfile",
    }),
    async complete() {
      const token = this.$route.query.t;
      if (!token) {
        this.errorMessage = "Missing sign-in token.";
        return this.$router.push("/login");
      }

      let response;
      try {
        response = await fetch(this.$hostnames.API + "/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token }),
        });
      } catch (networkError) {
        this.errorMessage = "Cannot reach the server. Please try again.";
        return this.$router.push("/login");
      }

      let payload;
      try {
        payload = await response.json();
      } catch (parseError) {
        this.errorMessage = "Unexpected response from the server.";
        return this.$router.push("/login");
      }

      const { success, access_token, refresh_token } = payload || {};
      if (!success || !access_token || !refresh_token) {
        this.errorMessage = (payload && payload.message)
          ? "Sign-in failed: " + payload.message
          : "Sign-in failed.";
        return this.$router.push("/login");
      }

      if (
        (await this.isTokenValid(access_token)) &&
        (await this.isTokenValid(refresh_token))
      ) {
        this.setAccessToken(access_token);
        this.setRefreshToken(refresh_token);
        this.scheduleExpiry(access_token);
      }

      if (this.isAuthenticated()) {
        window.localStorage.setItem("accessToken", access_token);
        window.localStorage.setItem("refreshToken", refresh_token);
        window.localStorage.setItem("authenticated", true);

        await this.fetchProfile();
        this.setUser(this.getProfile());
        this.$router.push("/app/dashboard");
      } else {
        this.errorMessage = "Token expired.";
        this.$router.push("/login");
      }
    },
  },
  created() {
    this.complete();
  },
};
</script>
