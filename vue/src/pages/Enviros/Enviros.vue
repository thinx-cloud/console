<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
      <b-breadcrumb-item active>Settings</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Settings - <span class="fw-semi-bold">Environment Globals</span>
    </h1>

    <p>
      <b-button variant="success" @click="$bvModal.show('create-enviro-modal')">Add Variable</b-button>
      <b-button
        variant="danger"
        @click="deleteSelected"
        :disabled="!isSelected"
        class="ml-2"
      >Delete ({{ selectedCount }})</b-button>
    </p>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>

    <p>Global environment variables are available to all your devices during firmware builds.</p>

    <List
      @selection-update="selectionUpdated"
      :datasource="items"
      :dataheaders="headers"
      :showLoading="loading"
    ></List>

    <!-- Create Modal -->
    <b-modal id="create-enviro-modal" title="Add Environment Variable" @ok="create" ok-title="Add">
      <b-form-group label="Key" label-for="enviro-key">
        <b-form-input id="enviro-key" v-model="form.key" placeholder="e.g. WIFI_SSID" required />
      </b-form-group>
      <b-form-group label="Value" label-for="enviro-value">
        <b-form-input id="enviro-value" v-model="form.value" placeholder="e.g. MyNetwork" required />
      </b-form-group>
    </b-modal>
  </div>
</template>

<script>
import List from "@/components/List/List";
import { mapGetters, mapActions } from "vuex";

export default {
  name: "Enviros",
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
      form: { key: '', value: '' },
    };
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: "enviros/getItems", getHeaders: "enviros/getHeaders" }),
    ...mapActions({ fetchItems: "enviros/fetchItems", createItem: "enviros/createItem", deleteItems: "enviros/deleteItems" }),
    async create(bvModalEvt) {
      bvModalEvt.preventDefault();
      if (!this.form.key.trim() || !this.form.value.trim()) return;
      const result = await this.createItem({ key: this.form.key.trim(), value: this.form.value.trim() });
      if (result.success) {
        this.form = { key: '', value: '' };
        this.$bvModal.hide('create-enviro-modal');
        this.loadData();
      } else {
        this.error = result.message || 'Failed to add environment variable.';
      }
    },
    async deleteSelected() {
      const names = this.selectedIds
        .map(id => this.items.find(item => item.id === id))
        .filter(Boolean)
        .map(item => item.label);
      if (!names.length) return;
      const result = await this.deleteItems(names);
      if (!result.success) this.error = result.message || 'Failed to delete environment variables.';
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
