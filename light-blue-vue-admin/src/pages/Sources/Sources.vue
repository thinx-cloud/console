<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Management - <span class="fw-semi-bold">Sources</span>
    </h1>

    <p><b-button
      variant="success" id="create-item" @click="create"
    >Add Source</b-button>
    <b-button
      variant="danger" id="delete-selected-items" @click="deleteSelected" :disabled="!isSelected"
    >{{ selectedCount }}<span class="glyphicon glyphicon-trash"></span></b-button>
    </p>

    <p>Manage your public or private git repositories</p>
    
    <List @selection-update="selectionUpdated"></List>

  </div>
</template>

<script>
import List from '@/components/List/List';
import { ThinxDeviceApi } from '../../core/thinxDeviceApi';

export default {
  name: 'Sources',
  components: { List },
  data() {
    return {
      checkboxes: [false, false, false, false],
      isSelected: false,
      selectedCount: 0,
    };
  },
  created() {
  
  },
  methods: {
    create() {
      // TODO implement
      // console.log(ThinxDeviceApi.methods.sources());
    },
    deleteSelected() {
      // TODO implement
    },
    selectionUpdated(value) {
      this.isSelected = value.state;
      this.selectedCount = value.count;
    },

  }
};
</script>
