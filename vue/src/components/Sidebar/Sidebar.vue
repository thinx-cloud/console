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
        
        <NavLink
          header="Typography"
          link="/app/typography"
          iconName="flaticon-list-3"
          index="typography"
          isHeader
        />
        <NavLink
          header="Tables Basic"
          link="/app/tables"
          iconName="flaticon-equal-3"
          index="tables"
          isHeader
        />
        <NavLink
          header="Notifications"
          link="/app/notifications"
          iconName="flaticon-bell"
          index="notifications"
          isHeader
        />
        <NavLink
          :activeItem="activeItem"
          header="Components"
          iconName="flaticon-network-1"
          index="components"
          :childrenLinks="[
            { header: 'Charts', link: '/app/components/charts' },
            { header: 'Icons', link: '/app/components/icons' },
            { header: 'Maps', link: '/app/components/maps' },
          ]"
        />

      </ul>
      <h5 class="navTitle d-sm-down-none">LABELS</h5>
      <ul class="sidebarLabels d-sm-down-none">
        <li>
          <a href="#">
            <i class="fa fa-circle text-success mr-3" />
            <span class="labelName">Core</span>
          </a>
        </li>
        <li>
          <a href="#">
            <i class="fa fa-circle text-primary mr-3" />
            <span class="labelName">UI Elements</span>
          </a>
        </li>
        <li>
          <a href="#">
            <i class="fa fa-circle text-danger mr-3" />
            <span class="labelName">Forms</span>
          </a>
        </li>
      </ul>

      <h5 class="navTitle d-sm-down-none mb-3">PROJECTS</h5>
      <div class="sidebarAlerts d-sm-down-none">
        <b-alert
          v-for="alert in alerts"
          :key="alert.id"
          class="sidebarAlert"
          variant="transparent"
          show
          dismissible
        >
          <span>{{ alert.title }}</span
          ><br />
          <b-progress
            class="sidebarProgress progress-xs mt-1"
            :variant="alert.color"
            :value="alert.value"
            :max="100"
          />
          <span>{{ alert.footer }}</span>
        </b-alert>
      </div>
    </nav>
  </b-collapse>
</template>

<script>
import { mapState, mapActions } from "vuex";
import NavLink from "./NavLink/NavLink";

export default {
  name: "Sidebar",
  components: { NavLink },
  data() {
    return {
      alerts: [
        {
          id: 0,
          title: "Sales Report",
          value: 15,
          footer: "Calculating x-axis bias... 65%",
          color: "primary",
        },
        {
          id: 1,
          title: "Personal Responsibility",
          value: 20,
          footer: "Provide required notes",
          color: "danger",
        },
      ],
    };
  },
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
