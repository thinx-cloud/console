<template>
  <router-view />
</template>

<script>
import { mapGetters } from "vuex";

export default {
  name: "App",
  methods: {
    ...mapGetters(["isLoggedIn"]),
  },
  created() {

    console.log(process.env);

    const currentPath = this.$router.history.current.path;

    // || !this.isLoggedIn()
    if (
      window.localStorage.getItem("authenticated") === "false" &&
      currentPath !== "/login"
    ) {
      this.$router.push("/login");
    } else {
      if (currentPath === "/" || currentPath === "/app") {
        this.$router.push("/app/dashboard");
      }
    }
  },
};
</script>

<style src="./styles/theme.scss" lang="scss" />
