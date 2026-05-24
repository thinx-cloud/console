<template>
  <div v-if="impersonatorOwner" class="impersonation-banner bg-warning text-dark py-2 px-3 d-flex align-items-center">
    <span class="mr-3">🎭 Impersonating <strong>{{ targetUsername || targetOwner }}</strong> — expires in {{ countdown }}</span>
    <b-button size="sm" variant="dark" @click="exit">Exit impersonation</b-button>
  </div>
</template>

<script>
import VueJwtDecode from "vue-jwt-decode";
import { mapActions } from "vuex";

export default {
  name: "ImpersonationBanner",
  data() {
    return {
      impersonatorOwner: null,
      targetOwner: null,
      targetUsername: null,
      expSeconds: null,
      countdown: '--:--',
      tickerId: null,
    };
  },
  created() {
    this.decode();
    this.tickerId = setInterval(() => this.updateCountdown(), 1000);
  },
  beforeDestroy() {
    if (this.tickerId) clearInterval(this.tickerId);
  },
  watch: {
    '$route'() { this.decode(); },
  },
  methods: {
    ...mapActions({ clearSession: "auth/clearSession" }),
    decode() {
      try {
        const token = window.localStorage.getItem('accessToken');
        if (!token) { this.impersonatorOwner = null; return; }
        const decoded = VueJwtDecode.decode(token);
        if (decoded && decoded.impersonator_owner) {
          this.impersonatorOwner = decoded.impersonator_owner;
          this.targetOwner = decoded.username;
          this.expSeconds = decoded.exp;
          this.updateCountdown();
        } else {
          this.impersonatorOwner = null;
        }
      } catch (_e) {
        this.impersonatorOwner = null;
      }
    },
    updateCountdown() {
      if (!this.expSeconds) return;
      const secondsLeft = this.expSeconds - Math.floor(Date.now() / 1000);
      if (secondsLeft <= 0) {
        this.countdown = '00:00';
        this.exit();
        return;
      }
      const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
      const s = String(secondsLeft % 60).padStart(2, '0');
      this.countdown = m + ':' + s;
    },
    async exit() {
      await this.clearSession();
      this.$router.push('/login');
    },
  },
};
</script>

<style scoped>
.impersonation-banner { position: sticky; top: 0; z-index: 1050; border-bottom: 2px solid #856404; }
</style>
