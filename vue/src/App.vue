<template>
  <router-view />
</template>

<script>
import { mapGetters, mapMutations } from 'vuex';

export default {
  name: "App",
  methods: {
    ...mapMutations({ setAccessToken: 'auth/setAccessToken', setRefreshToken: 'auth/setRefreshToken' }),
    ...mapGetters(['isLoggedIn']),
  },
  created() {
    const currentPath = this.$router.history.current.path;
    const authenticated = window.localStorage.getItem('authenticated');

    if (authenticated === 'false' && currentPath !== '/login') {
      this.$router.push('/login');
    } else {
      // retrieve accessToken from localstorage, if present
      // TODO unwrap and check validity of this JWT token
      if (authenticated === 'true') {
        this.setAccessToken(window.localStorage.getItem('accessToken'));
        this.setRefreshToken(window.localStorage.getItem('refreshToken'));
      }
      if (currentPath === '/' || currentPath === '/app') {
        this.$router.push("/app/dashboard");
      }
    }
  },
};
</script>

<style src="./styles/theme.scss" lang="scss" />
