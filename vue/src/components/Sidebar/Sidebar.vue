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
        <NavLink
          header="Cost Attribution"
          link="/app/cost-attribution"
          iconName="flaticon-list-3"
          index="cost-attribution"
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
            { header: 'My Profile', link: '/app/profile' },
          ]"
        />
        <template v-if="isAdmin">
          <h5 class="navTitle">ADMIN</h5>
          <NavLink
            header="Admin Users"
            link="/app/admin/users"
            iconName="flaticon-list-3"
            index="admin users"
            isHeader
          />
        </template>

      </ul>
    </nav>
  </b-collapse>
</template>

<script>
import { mapState, mapActions, mapGetters } from "vuex";
import NavLink from "./NavLink/NavLink";

export default {
  name: "Sidebar",
  components: { NavLink },
  methods: {
    ...mapActions("layout", ["changeSidebarActive", "switchSidebar"]),
    ...mapGetters({ getProfile: "profile/getProfile" }),
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
    isAdmin() {
      const p = this.getProfile();
      return !!(p && p.admin === true);
    },
  },
};
</script>

<!-- Sidebar styles should be scoped -->
<style src="./Sidebar.scss" lang="scss" scoped />
