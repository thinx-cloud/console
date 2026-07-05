<template>
  <div class="oauth-return-page d-flex flex-column align-items-center justify-content-center" style="min-height:60vh">
    <!-- GDPR consent gate (shown only when the API signals g=false: consent not yet given) -->
    <div v-if="needsConsent" class="gdpr-consent" style="max-width:420px;width:100%">
      <h5 class="mb-3">Before you continue</h5>
      <p class="text-muted">To create your THiNX account we need your consent.</p>
      <div class="form-check mb-2">
        <input id="gdpr-consent" v-model="gdprChecked" type="checkbox" class="form-check-input" />
        <label class="form-check-label" for="gdpr-consent">
          I agree to the
          <a :href="privacyPolicyUrl" target="_blank" rel="noopener noreferrer">THiNX Privacy Policy (GDPR)</a>.
        </label>
      </div>
      <div class="form-check mb-3">
        <input id="cookies-consent" v-model="cookiesChecked" type="checkbox" class="form-check-input" />
        <label class="form-check-label" for="cookies-consent">I accept the Cookies Policy.</label>
      </div>
      <div class="d-flex" style="gap:8px">
        <button
          type="button"
          class="btn btn-danger btn-sm"
          :disabled="!gdprChecked || !cookiesChecked || submitting"
          @click="acceptConsent"
        >
          {{ submitting ? 'Please wait…' : 'Agree and continue' }}
        </button>
        <button type="button" class="btn btn-link btn-sm" :disabled="submitting" @click="rejectConsent">
          Decline
        </button>
      </div>
      <p v-if="errorMessage" class="text-danger mt-2">{{ errorMessage }}</p>
    </div>

    <!-- Default: silently completing the token exchange -->
    <div v-else>
      <p>Completing sign-in…</p>
      <p v-if="errorMessage" class="text-danger mt-2">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script>
import { mapMutations, mapGetters, mapActions } from "vuex";
import hostnameMixin from "@/mixins/hostnames";
import { getCookie } from "@/utils/cookies";

// Landing page for the OAuth callback when the API was told to return to this
// console (?return=<origin>). The API redirected here as
//   <origin>/#/oauth-return?t=<one-shot-token>&g=<true|false>
// When g=false the user has not yet given GDPR consent, so we show the same
// consent gate the legacy auth.html does and POST it before logging in (parity).
// When g=true we exchange the token at /api/v2/login for JWTs and complete the
// session exactly like the password Login.vue flow.
export default {
  name: "OAuthReturnPage",
  mixins: [hostnameMixin],
  data() {
    return {
      errorMessage: null,
      needsConsent: false,
      gdprChecked: false,
      cookiesChecked: false,
      submitting: false,
    };
  },
  computed: {
    privacyPolicyUrl() {
      const landing = this.$hostnames && this.$hostnames.LANDING ? this.$hostnames.LANDING : "";
      return landing ? landing.replace(/\/$/, "") + "/gdpr.html" : "#";
    },
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

    // Prime the XSRF-TOKEN cookie for a cold session. This page is reached directly
    // via the OAuth-provider redirect and created() dispatches immediately to a
    // protected POST with no human-typing delay, so callers must AWAIT this.
    async primeCsrfCookie() {
      await fetch(this.$hostnames.API + "/csrf-token", {
        method: "GET",
        credentials: "include",
      }).catch(() => {});
    },

    // PUT /api/v2/gdpr is the consent setter (setGDPR); POST is transferGDPR, so
    // we must use PUT here. The one-shot token authorizes the change.
    async submitConsent(consent) {
      const token = this.$route.query.t;
      const response = await fetch(this.$hostnames.API + "/gdpr", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": getCookie("XSRF-TOKEN") || "",
        },
        body: JSON.stringify({ token: token, gdpr: consent, gdpr_consent: consent }),
      });
      return response.json();
    },

    async acceptConsent() {
      if (!this.gdprChecked || !this.cookiesChecked) return;
      this.errorMessage = null;
      this.submitting = true;
      try {
        const payload = await this.submitConsent(true);
        if (!payload || payload.success === false) {
          this.errorMessage = "Could not record your consent. Please try again.";
          this.submitting = false;
          return;
        }
      } catch (e) {
        this.errorMessage = "Cannot reach the server. Please try again.";
        this.submitting = false;
        return;
      }
      // Consent recorded — proceed with the normal login exchange.
      this.needsConsent = false;
      this.submitting = false;
      this.complete();
    },

    async rejectConsent() {
      this.submitting = true;
      try {
        await this.submitConsent(false); // backend marks the account for deletion
      } catch (e) {
        // ignore — declining proceeds to login regardless
      }
      this.$router.push("/login");
    },

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
          headers: {
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": getCookie("XSRF-TOKEN") || "",
          },
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
  async created() {
    // Await the cookie prime FIRST: this page dispatches immediately to a protected
    // POST with no human-typing delay, so a cold session must not race ahead of the
    // XSRF-TOKEN cookie landing.
    await this.primeCsrfCookie();

    // g=false -> consent not yet given: show the gate. Otherwise complete silently.
    if (String(this.$route.query.g) === "false") {
      this.needsConsent = true;
    } else {
      this.complete();
    }
  },
};
</script>
