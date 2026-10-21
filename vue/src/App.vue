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
    // Resolves with the confirmed initial path once the router's initial navigation
    // has settled: onReady's success callback, or its error callback when that
    // navigation failed (so created() never stays pending).
    waitForInitialRoute() {
      return new Promise((resolve) => {
        const done = () => resolve(this.$router.currentRoute.path);
        this.$router.onReady(done, done);
      });
    },
  },
  // The default-route decision reads the confirmed initial route (NOTIF-04, D-07).
  // Before the initial navigation confirms, the current route is the router's start
  // route `/`, which is what sent every reloaded deep link to the dashboard. For
  // /app/* the Routes.js guard has already hydrated, so the hydrate below returns
  // from the in-memory token without a request.
  async created() {
    const currentPath = await this.waitForInitialRoute();
    // GET /api/oauth/* destroyed the API session before the provider redirect,
    // so the XSRF-TOKEN cookie on /oauth-return is stale: re-prime, don't trust it.
    const authenticated = await this.hydrateSession({ forcePrime: currentPath === "/oauth-return" });

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
