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
    ...mapActions({ isTokenValid: "auth/isTokenValid" }),
  },
  async created() {
    const currentPath = this.$router.history.current.path;
    const authenticated = this.isAuthenticated;// (window.localStorage.getItem("authenticated") === 'true');

    if (!authenticated) {
      if (currentPath !== "/login") {
        this.$router.push("/login");
      }
    }

    if (authenticated) {
      // init auth in vuex

      let storedAccessToken = window.localStorage.getItem("accessToken");
      let storedRefreshToken = window.localStorage.getItem("refreshToken");

      if (await this.isTokenValid(storedAccessToken) && await this.isTokenValid(storedRefreshToken)) {
        this.setAccessToken(storedAccessToken);
        this.setRefreshToken(storedRefreshToken);
      }

      // concat default paths
      if (currentPath === "/" || currentPath === "/app") {
        this.$router.push("/app/dashboard");
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
