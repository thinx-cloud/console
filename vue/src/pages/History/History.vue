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
    this.$watch(() => this.$route.params, () => { this.loadData() }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: "history/getItems", getHeaders: "history/getHeaders" }),
    ...mapActions({ fetchAuditlog: "history/fetchAuditlog", fetchBuildlog: "history/fetchBuildLog" }),

    loadData() {
        this.loading = true;
        this.headers = this.getHeaders();

        this.fetchBuildlog().then((items) => {
            console.log("# fetchBuildlog");
            this.fetchAuditlog().then((items) => {
                console.log("# fetchAuditlog");

                this.items = this.getItems();
                this.headers = this.getHeaders();

                this.loading = false;
            });

        });

  
    },
  },
};
</script>
