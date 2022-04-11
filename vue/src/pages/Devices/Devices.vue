<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Management - <span class="fw-semi-bold">Devices</span>
    </h1>

    <p>
      <b-button variant="success" id="create-item" @click="create"
        >Add Mesh Channels</b-button
      >
      <b-button
        variant="danger"
        id="delete-selected-items"
        @click="deleteSelected"
        :disabled="!isSelected"
        >{{ selectedCount }}<span class="glyphicon glyphicon-trash"></span
      ></b-button>
    </p>

    <p>Manage your Devices</p>

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
  name: "Devices",
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
    this.fetchItems().then((devices) => {
      // this.repositories = repositories;
    });
  },
  mounted() {
    this.items = this.getItems();
    this.headers = this.getHeaders();
    console.log('getDevices', this.items);
  },
  methods: {
    ...mapGetters({ getItems: 'devices/getItems', getHeaders: 'devices/getHeaders' }),
    ...mapActions({ fetchItems: 'devices/fetchItems' }),
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
