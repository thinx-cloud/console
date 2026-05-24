<template>
  <router-view />
</template>

<script>
import { mapGetters, mapMutations, mapActions } from "vuex";

export default {
  name: "App",
  computed: {
    ...mapGetters({
      isAuthenticated: "auth/isAuthenticated"
    })
  },
  methods: {
    ...mapMutations({
      setAccessToken: "auth/setAccessToken",
      setRefreshToken: "auth/setRefreshToken",
    }),
    ...mapActions({
      isTokenValid: "auth/isTokenValid",
      scheduleExpiry: "auth/scheduleExpiry",
    }),
    async pushIfNeeded(location) {
      if (this.$route.fullPath === location) {
        return;
      }

      try {
        await this.$router.push(location);
      } catch (error) {
        if (error?.name !== "NavigationDuplicated") {
          throw error;
        }
      }
    },
  },
  async created() {
    const currentPath = this.$router.history.current.path;
    const authenticated = this.isAuthenticated;// (window.localStorage.getItem("authenticated") === 'true');

    if (!authenticated) {
      if (currentPath !== "/login") {
        await this.pushIfNeeded("/login");
      }
    }

    if (authenticated) {
      // init auth in vuex

      let storedAccessToken = window.localStorage.getItem("accessToken");
      let storedRefreshToken = window.localStorage.getItem("refreshToken");

      if (await this.isTokenValid(storedAccessToken) && await this.isTokenValid(storedRefreshToken)) {
        this.setAccessToken(storedAccessToken);
        this.setRefreshToken(storedRefreshToken);
        this.scheduleExpiry(storedAccessToken);
      }

      // concat default paths
      if (currentPath === "/" || currentPath === "/app") {
        await this.pushIfNeeded("/app/dashboard");
      }

      /*
        TODO unwrap and check validity of this JWT token
        retrieve accessToken from localstorage, if present
      */
    }
  },
};
</script>

<style src="./styles/theme.scss" lang="scss" />
