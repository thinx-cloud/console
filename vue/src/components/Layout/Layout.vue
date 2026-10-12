<template>
<div :class="{root: true, sidebarClose}">
  <Header />
  <Sidebar />
  <ImpersonationBanner />
  <div ref="content" class="content animated fadeInUp">
    <transition name="router-animation">
      <router-view />
    </transition>
  </div>
  <AppFooter variant="layout" />
</div>
</template>

<script>
import { mapState, mapActions } from 'vuex';

import Sidebar from '@/components/Sidebar/Sidebar';
import Header from '@/components/Header/Header';
import ImpersonationBanner from '@/components/ImpersonationBanner/ImpersonationBanner';
import AppFooter from '@/components/AppFooter/AppFooter';
// Removed: Helper (Flatlogic template "Configuration" panel — Purchase / Go FULL / Documentation / social-sharing).
// Not part of THiNX product surface; was leftover from the light-blue-vue template.

import './Layout.scss';

export default {
  name: 'Layout',
  components: { Sidebar, Header, ImpersonationBanner, AppFooter },
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
