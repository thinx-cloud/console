<template>
  <router-view />
</template>

<script>
import { mapActions } from "vuex";

// Public routes must NOT be force-redirected to /login on cold load. In
// particular /oauth-return is unauthenticated by definition (it is mid-flight
// exchanging the one-shot OAuth token for JWTs); bouncing it here aborted the
// exchange and dropped the user back on the login page. Keep in sync with
// Routes.js PUBLIC_PATHS.
const PUBLIC_PATHS = ["/login", "/password-reset", "/error", "/oauth-return"];

export default {
  name: "App",
  methods: {
    ...mapActions({
      hydrateSession: "auth/hydrateSession",
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
  },
  async created() {
    const currentPath = this.$router.history.current.path;
    const authenticated = await this.hydrateSession();

    if (!authenticated) {
      if (!PUBLIC_PATHS.includes(currentPath)) {
        await this.pushIfNeeded("/login");
      }
      return;
    }

    if (authenticated) {
      // concat default paths
      if (currentPath === "/" || currentPath === "/app") {
        await this.pushIfNeeded("/app/dashboard");
      }
    }
  },
};
</script>

<style src="./styles/theme.scss" lang="scss" />
