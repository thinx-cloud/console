<template>
<div :class="{root: true, sidebarClose}">
  <Helper />
  <Header />
  <Sidebar />
  <div ref="content" class="content animated fadeInUp">
    <transition name="router-animation">
      <router-view />
    </transition>
  </div>
  <footer class="contentFooter">
    <a :href="env.VUE_APP_CONSOLE_HOSTNAME" target="_blank">THiNX Console</a> by <a :href="env.VUE_APP_LANDING_HOSTNAME" target="_blank">THiNX Cloud</a>
  </footer>
</div>
</template>

<script>
import { mapState, mapActions } from 'vuex';

import Sidebar from '@/components/Sidebar/Sidebar';
import Header from '@/components/Header/Header';
import Helper from '@/components/Helper/Helper';

import './Layout.scss';

export default {
  name: 'Layout',
  components: { Sidebar, Header, Helper },
  data() {
    return {
      env: {
        VUE_APP_CONSOLE_HOSTNAME: process.env.VUE_APP_CONSOLE_HOSTNAME,
        VUE_APP_LANDING_HOSTNAME: process.env.VUE_APP_LANDING_HOSTNAME,
      }
    };
  },
  methods: {
    ...mapActions(
      'layout', ['switchSidebar', 'changeSidebarActive'],
    ),
  },
  computed: {
    ...mapState('layout', {
      sidebarClose: state => state.sidebarClose,
    }),
  },
  created() {
    // 
  },
  mounted() {
    this.$refs.content.addEventListener('animationend', () => {
      this.$refs.content.classList.remove('animated');
      this.$refs.content.classList.remove('fadeInUp');
    });
  }
};
</script>

<style src="./Layout.scss" lang="scss" />
