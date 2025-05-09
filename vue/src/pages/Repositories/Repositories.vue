<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Management - <span class="fw-semi-bold">Repositories</span>
    </h1>

    <p>
      <b-button variant="success" id="create-item" @click="create"
        >Add Repository</b-button
      >
      <b-button
        variant="danger"
        id="delete-selected-items"
        @click="deleteSelected"
        :disabled="!isSelected"
        >{{ selectedCount }}<span class="glyphicon glyphicon-trash"></span
      ></b-button>
    </p>

    <p>Manage your public or private git repositories</p>

    <List
      @selection-update="selectionUpdated"
      :datasource="repositories"
      :dataheaders="headers"
      :showLoading="loading"
    ></List>
  </div>
</template>

<script>
import List from "@/components/List/List";
import { mapGetters, mapActions } from "vuex";

export default {
  name: "Repositories",
  components: { List },
  data() {
    return {
      isSelected: false,
      selectedCount: 0,
      repositories: [],
      headers: [],
      loading: true,
    };
  },
  created() {
    this.$watch(
      () => this.$route.params,
      () => {
        console.log("TODO itemslength", this.getItems().length);
        if (this.getItems().length == 0) {
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
      getItems: "repositories/getItems",
      getHeaders: "repositories/getHeaders",
    }),
    ...mapActions({ fetchRepositories: "repositories/fetchRepositories" }),
    create() {
      // TODO implement
    },
    deleteSelected() {
      // TODO implement
    },
    selectionUpdated(value) {
      this.isSelected = value.count > 0;
      this.selectedCount = value.count;
    },
    loadData() {
      this.loading = true;
      this.fetchRepositories().then(() => {
        // Removed unused 'repositories' parameter
        this.repositories = this.getItems();
        this.headers = this.getHeaders();
        this.loading = false;
      });
    },
    refreshData() {
      this.loading = false;
      this.repositories = this.getItems();
      this.headers = this.getHeaders();
    },
  },
};
</script>
