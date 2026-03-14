<template>
  <b-navbar toggleable="md" class="app-header d-print-none">
    <b-navbar-nav class="navbar-nav-mobile ml-auto">
      <b-nav-text class="mr-3">
        <b-alert
          class="header-alert animate__animated animate__bounceIn animate__delay-2s"
          dismissible
          v-model="showNavbarAlert"
        >
          <i class="fa fa-info-circle mr-1"></i> Check out Light Blue Settings on the
          right!
        </b-alert>
      </b-nav-text>
      <b-nav-form class="d-sm-down-none mr-3">
        <b-input-group class="input-group-transparent search-group">
          <b-input-group-text slot="prepend"
            ><i class="fi flaticon-search-2"></i
          ></b-input-group-text>
          <b-input
            class="input-transparent"
            id="search-input"
            placeholder="Search Dashboard"
          />
        </b-input-group>
      </b-nav-form>
      <b-nav-item-dropdown right class="avatar-toggle" menu-class="py-0">
        <template slot="button-content">
          <span class="avatar rounded-circle thumb-sm-1 float-left mr-2">
            <img
              class="rounded-circle"
              :src="avatarFallback"
              alt="..."
            />
          </span>
          <span class="text-white"
            >{{ this.profile.first_name }} {{ this.profile.last_name }}</span
          >
          <span class="mx-2 circle bg-danger text-dark fs-sm fw-bold">9</span>
          <i class="fi flaticon-arrow-down" />
        </template>
        <notifications />
      </b-nav-item-dropdown>
      <b-nav-item class="divider d-md-down-none"></b-nav-item>
      <b-nav-item-dropdown
        no-caret
        right
        class="mr-2"
        menu-class="dropdown-menu-settings"
      >
        <template slot="button-content">
          <i class="fi flaticon-settings-10 px-2" />
        </template>
        <b-dropdown-item><i class="la la-user" /> My Account</b-dropdown-item>
        <b-dropdown-divider />
        <b-dropdown-item>
          Inbox &nbsp;&nbsp;<b-badge
            variant="danger"
            pill
            class="animate__animated animate__bounceIn"
            >9</b-badge
          >
        </b-dropdown-item>
        <b-dropdown-divider />
        <b-dropdown-item-button @click="logout">
          <i class="la la-sign-out" /> Log Out
        </b-dropdown-item-button>
      </b-nav-item-dropdown>
      <b-nav-item class="d-md-down-none" @click="logout">
        <i class="fi flaticon-power-1 px-2" />
      </b-nav-item>
      <b-nav-item class="d-md-none" @click="switchSidebarMethod">
        <i class="la la-navicon px-2" />
      </b-nav-item>
    </b-navbar-nav>
  </b-navbar>
</template>

<script>
import { mapState, mapActions, mapMutations, mapGetters } from "vuex";
import Notifications from "@/components/Notifications/Notifications";

export default {
  name: "Header",
  components: { Notifications },
  data() {
    return {
      showNavbarAlert: true,
      profile: {},
    };
  },
  computed: {
    ...mapState("layout", {
      sidebarClose: (state) => state.sidebarClose,
      sidebarStatic: (state) => state.sidebarStatic,
    }),
    avatarFallback() {
      const fallbackPath = "thinx/default_avatar_sm.png";
      if (
        this.profile &&
        typeof this.profile.avatar !== "undefined" &&
        this.profile.avatar.length > 0
      ) {
        return this.profile.avatar;
      }
      return require(`@/assets/${fallbackPath}`);
    },
  },
  methods: {
    ...mapActions({
      fetchProfile: "profile/fetchProfile",
      switchSidebar: "layout/switchSidebar",
      changeSidebarActive: "layout/changeSidebarActive",
      removeAccessToken: "auth/removeAccessToken",
      removeRefreshToken: "auth/removeRefreshToken",
    }),
    ...mapMutations({ 
      setAccessToken: "auth/setAccessToken", 
      setRefreshToken: "auth/setRefreshToken", 
      setUser: "auth/setUser" 
    }),
    ...mapGetters({ getProfile: "profile/getProfile" }),
    switchSidebarMethod() {
      if (!this.sidebarClose) {
        this.switchSidebar(true);
        this.changeSidebarActive(null);
      } else {
        this.switchSidebar(false);
        const paths = this.$route.fullPath.split("/");
        paths.pop();
        this.changeSidebarActive(paths.join("/"));
      }
    },
    logout() {
      window.localStorage.removeItem("authenticated");
      this.setUser(null);
      this.removeAccessToken();
      this.removeRefreshToken();
      this.$router.push("/login");
    },
  },
  created() {},
  mounted() {
    //this.profile = this.getProfile();
    this.fetchProfile().then(() => {
      this.profile = this.getProfile();
      console.log("--- PROFILE DEBUG ---", this.profile);
    });
  },
};
</script>

<style src="./Header.scss" lang="scss" />
