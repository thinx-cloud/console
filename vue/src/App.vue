<template>
  <router-view />
</template>

<script>
import { mapActions } from "vuex";

const PUBLIC_PATHS = ["/login", "/password-reset", "/error"];

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

    if (!authenticated && !PUBLIC_PATHS.includes(currentPath)) {
      await this.pushIfNeeded("/login");
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
