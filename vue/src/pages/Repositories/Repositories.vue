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

    <List @selection-update="selectionUpdated" :datasource="repsitories"></List>
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
      checkboxes: [false, false, false, false],
      isSelected: false,
      selectedCount: 0,
      repsitories: [],
    };
  },
  created() {
    this.fetchRepositories().then((repsitories) => {
      // this.repsitories = repsitories;
    });
  },
  mounted() {
    this.repsitories = this.getRepositories();
    console.log('getRepositories', this.repsitories);
  },
  methods: {
    ...mapGetters(["getRepositories"]),
    ...mapActions(["fetchRepositories"]),
    create() {
      // TODO implement
    },
    deleteSelected() {
      // TODO implement
    },
    selectionUpdated(value) {
      this.isSelected = value.state;
      this.selectedCount = value.count;
    },
  },
};
</script>
