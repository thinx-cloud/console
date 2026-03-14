<template>
  <b-collapse class="sidebar-collapse" id="sidebar-collapse" :visible="sidebarOpened">
    <nav :class="{ sidebar: true }">
      <header class="logo">
        <router-link to="/app">THiNX <span class="fw-bold">Console</span></router-link>
      </header>

      <ul class="nav">
        <h5 class="navTitle">SUMMARY</h5>
        <NavLink
          :activeItem="activeItem"
          header="Dashboard"
          link="/app/dashboard"
          iconName="flaticon-home-3"
          index="dashboard"
          isHeader
        />
        <h5 class="navTitle">MANAGEMENT</h5>
        <NavLink
          header="Devices"
          link="/app/devices"
          iconName="flaticon-list-3"
          index="devices"
          isHeader
        />
        <NavLink
          header="API Keys"
          link="/app/apikeys"
          iconName="flaticon-list-3"
          index="api keys"
          isHeader
        />
        <NavLink
          header="Repositories"
          link="/app/repositories"
          iconName="flaticon-list-3"
          index="repositories"
          isHeader
        />
        <NavLink
          header="History"
          link="/app/history"
          iconName="flaticon-list-3"
          index="History"
          isHeader
        />
        <NavLink
          :activeItem="activeItem"
          header="Settings"
          iconName="flaticon-network-1"
          index="settings"
          :childrenLinks="[
            { header: 'RSA Keys', link: '/app/rsakeys' },
            { header: 'Transformers', link: '/app/transformers' },
            { header: 'Environment Globals', link: '/app/enviros' },
            { header: 'Mesh Channels', link: '/app/channels' },
          ]"
        />
        

      </ul>
    </nav>
  </b-collapse>
</template>

<script>
import { mapState, mapActions } from "vuex";
import NavLink from "./NavLink/NavLink";

export default {
  name: "Sidebar",
  components: { NavLink },
  methods: {
    ...mapActions("layout", ["changeSidebarActive", "switchSidebar"]),
    setActiveByRoute() {
      const paths = this.$route.fullPath.split("/");
      paths.pop();
      this.changeSidebarActive(paths.join("/"));
    },
  },
  created() {
    this.setActiveByRoute();
  },
  computed: {
    ...mapState("layout", {
      sidebarOpened: (state) => !state.sidebarClose,
      activeItem: (state) => state.sidebarActiveElement,
    }),
  },
};
</script>

<!-- Sidebar styles should be scoped -->
<style src="./Sidebar.scss" lang="scss" scoped />
