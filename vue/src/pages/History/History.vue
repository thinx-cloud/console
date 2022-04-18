<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">Management - <span class="fw-semi-bold">History</span></h1>

    <p>Browse in your history</p>

    <List :datasource="auditlog" :dataheaders="headers" :showLoading="loading"></List>
  </div>
</template>

<script>
import List from "@/components/List/List";
import { mapGetters, mapActions } from "vuex";

export default {
  name: "History",
  components: { List },
  data() {
    return {
      items: [],
      headers: [],
      auditlog: [],
      buildlog: [],
      loading: true,
    };
  },
  created() {
    this.$watch(
      () => this.$route.params,
      () => {
        console.log('TODO itemslength', this.getAuditItems().length);
        if (this.getAuditItems().length == 0) {
            this.loadData();
        } else {
            this.refreshData();
        }
      },
      { immediate: true }
    );
  },
  methods: {
    ...mapGetters({ 
        getAuditItems: "auditlog/getItems", 
        getAuditHeaders: "auditlog/getHeaders",
        getBuildItems: "buildlog/getItems", 
        getBuildHeaders: "buildlog/getHeaders",
    }),
    ...mapActions({
      fetchAuditlog: "auditlog/fetchAuditlog",
      fetchBuildlog: "buildlog/fetchBuildLog",
    }),
    loadData() {
      this.loading = true;
      this.headers = this.getAuditHeaders();
      this.fetchBuildlog().then((items) => {
        console.log("# fetchBuildlog");
        this.buildlog = this.getBuildItems();
        this.fetchAuditlog().then((items) => {
            console.log("# fetchAuditlog");
            this.auditlog = this.getAuditItems();
            this.loading = false;
        });
      });
    },
    refreshData() {
        this.loading = false;
        this.auditlog = this.getAuditItems();
        this.buildlog = this.getBuildItems();
        this.headers = this.getAuditHeaders();
        console.log('TODO refresh data on view enter');
    }
  },
};
</script>
