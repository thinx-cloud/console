<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Management - <span class="fw-semi-bold">RSA Keys</span>
    </h1>

    <p>
      <b-button variant="success" id="create-item" @click="create"
        >Add RSA Key</b-button
      >
      <b-button
        variant="danger"
        id="delete-selected-items"
        @click="deleteSelected"
        :disabled="!isSelected"
        >{{ selectedCount }}<span class="glyphicon glyphicon-trash"></span
      ></b-button>
    </p>

    <p>Manage your private RSA keys</p>

    <List
      @selection-update="selectionUpdated"
      :datasource="items"
      :dataheaders="headers"
    ></List>
  </div>
</template>

<script>
import List from '@/components/List/List';
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "Rsakeys",
  components: { List },
  data() {
    return {
      isSelected: false,
      selectedCount: 0,
      items: [],
      headers: [],
    };
  },
  created() {
    this.fetchItems().then((rsakeys) => {
      // this.repositories = repositories;
    });
  },
  mounted() {
    this.items = this.getItems();
    this.headers = this.getHeaders();
    console.log('getRsaKeys', this.items);
  },
  methods: {
    ...mapGetters({ getItems: 'rsakeys/getItems', getHeaders: 'rsakeys/getHeaders' }),
    ...mapActions({ fetchItems: 'rsakeys/fetchItems' }),
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
  },
};
</script>
