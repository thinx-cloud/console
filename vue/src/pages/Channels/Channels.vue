<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item active>Settings</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Settings - <span class="fw-semi-bold">Mesh Channels</span>
    </h1>

    <p>
      <b-button variant="success" @click="$bvModal.show('create-channel-modal')">Add Mesh Channel</b-button>
      <b-button
        variant="danger"
        @click="deleteSelected"
        :disabled="!isSelected"
        class="ml-2"
      >Delete ({{ selectedCount }})</b-button>
    </p>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>

    <p>Mesh channels allow groups of devices to communicate with each other.</p>

    <List
      @selection-update="selectionUpdated"
      :datasource="items"
      :dataheaders="headers"
      :showLoading="loading"
    ></List>

    <!-- Create Modal -->
    <b-modal id="create-channel-modal" title="Add Mesh Channel" @ok="create" ok-title="Create">
      <b-form-group label="Channel ID" label-for="channel-mesh-id">
        <b-form-input id="channel-mesh-id" v-model="form.mesh_id" placeholder="e.g. living-room" required />
      </b-form-group>
      <b-form-group label="Alias" label-for="channel-alias">
        <b-form-input id="channel-alias" v-model="form.alias" placeholder="e.g. Living Room Sensors" />
      </b-form-group>
    </b-modal>
  </div>
</template>

<script>
import List from '@/components/List/List';
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "Channels",
  components: { List },
  data() {
    return {
      isSelected: false,
      selectedCount: 0,
      selectedIds: [],
      items: [],
      headers: [],
      loading: true,
      error: null,
      form: { mesh_id: '', alias: '' },
    };
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'channels/getItems', getHeaders: 'channels/getHeaders' }),
    ...mapActions({ fetchItems: 'channels/fetchItems', createItem: 'channels/createItem', deleteItems: 'channels/deleteItems' }),
    async create(bvModalEvt) {
      bvModalEvt.preventDefault();
      if (!this.form.mesh_id.trim()) return;
      const payload = {
        mesh_id: this.form.mesh_id.trim(),
        alias: this.form.alias.trim() || this.form.mesh_id.trim(),
      };
      const result = await this.createItem(payload);
      if (result.success) {
        this.form = { mesh_id: '', alias: '' };
        this.$bvModal.hide('create-channel-modal');
        this.loadData();
      } else {
        this.error = result.message || 'Failed to create mesh channel.';
      }
    },
    async deleteSelected() {
      const mesh_ids = this.selectedIds
        .map(id => this.items.find(item => item.id === id))
        .filter(Boolean)
        .map(item => item.mesh_id);
      if (!mesh_ids.length) return;
      const result = await this.deleteItems(mesh_ids);
      if (!result.success) this.error = result.message || 'Failed to delete mesh channels.';
      this.selectedIds = [];
      this.isSelected = false;
      this.selectedCount = 0;
    },
    selectionUpdated(value) {
      this.isSelected = value.count > 0;
      this.selectedCount = value.count;
      this.selectedIds = value.items || [];
    },
    loadData() {
      this.loading = true;
      this.fetchItems().then(() => {
        this.items = this.getItems();
        this.headers = this.getHeaders();
        this.loading = false;
      });
    },
  },
};
</script>
