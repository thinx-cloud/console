<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item>YOU ARE HERE</b-breadcrumb-item>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Management - <span class="fw-semi-bold">API Keys</span>
    </h1>

    <p>
      <b-button variant="success" @click="$bvModal.show('create-apikey-modal')">Add API Key</b-button>
      <b-button
        variant="danger"
        @click="deleteSelected"
        :disabled="!isSelected"
        class="ml-2"
      >Delete ({{ selectedCount }})</b-button>
    </p>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>

    <List
      @selection-update="selectionUpdated"
      :datasource="items"
      :dataheaders="headers"
      :showLoading="loading"
    ></List>

    <!-- Create Modal -->
    <b-modal id="create-apikey-modal" title="Add API Key" @ok="create" ok-title="Create">
      <b-form-group label="Alias" label-for="apikey-alias">
        <b-form-input id="apikey-alias" v-model="form.alias" placeholder="e.g. My Device Key" required />
      </b-form-group>
    </b-modal>

    <!-- Created Key Result Modal -->
    <b-modal id="apikey-result-modal" title="API Key Created" ok-only ok-title="Close">
      <p>Your new API key has been created. Copy it now — it will not be shown again.</p>
      <b-form-input readonly :value="createdKey" class="mb-2" />
      <b-button variant="outline-secondary" size="sm" @click="copyToClipboard(createdKey)">Copy to clipboard</b-button>
    </b-modal>
  </div>
</template>

<script>
import List from '@/components/List/List';
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "Apikeys",
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
      createdKey: null,
      form: { alias: '' },
    };
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'apikeys/getItems', getHeaders: 'apikeys/getHeaders' }),
    ...mapActions({ fetchItems: 'apikeys/fetchItems', createItem: 'apikeys/createItem', deleteItems: 'apikeys/deleteItems' }),
    async create(bvModalEvt) {
      bvModalEvt.preventDefault();
      if (!this.form.alias.trim()) return;
      const result = await this.createItem(this.form.alias.trim());
      if (result.success) {
        this.createdKey = result.response && result.response.key ? result.response.key : null;
        this.form.alias = '';
        this.$bvModal.hide('create-apikey-modal');
        if (this.createdKey) this.$bvModal.show('apikey-result-modal');
        this.loadData();
      } else {
        this.error = result.message || 'Failed to create API key.';
      }
    },
    async deleteSelected() {
      const hashes = this.selectedIds
        .map(id => this.items.find(item => item.id === id))
        .filter(Boolean)
        .map(item => item.hash);
      if (!hashes.length) return;
      const result = await this.deleteItems(hashes);
      if (!result.success) this.error = result.message || 'Failed to delete API keys.';
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
    copyToClipboard(value) {
      navigator.clipboard.writeText(value).catch(() => {
        const el = document.createElement('textarea');
        el.value = value;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
      this.$toasted.show('Copied to clipboard', { type: 'success', duration: 2000 });
    },
  },
};
</script>
