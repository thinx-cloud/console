<template>
  <div>
    <b-breadcrumb><b-breadcrumb-item active>Settings</b-breadcrumb-item></b-breadcrumb>
    <h1 class="page-title">Settings - <span class="fw-semi-bold">Deploy Keys</span></h1>
    <b-form inline class="mb-3" @submit.prevent="create">
      <label for="deploy-key-name" class="mr-2">Key name</label>
      <b-form-input id="deploy-key-name" v-model="keyName" maxlength="120" required placeholder="e.g. Firmware Repository" class="mr-2 mb-2" :disabled="creating" />
      <b-button type="submit" variant="success" :disabled="creating || !keyName.trim()" class="mb-2">{{ creating ? 'Generating…' : 'Generate Deploy Key' }}</b-button>
      <b-button variant="danger" @click="deleteSelected" :disabled="!selectedIds.length" class="ml-2 mb-2">Delete ({{ selectedIds.length }})</b-button>
    </b-form>
    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
    <p>Deploy keys grant access to private Git repositories. Add the public key to your repository's deploy keys.</p>
    <div v-if="loading" role="status">Loading…</div>
    <div v-else class="table-responsive">
      <table class="table table-striped">
        <thead><tr><th>Select</th><th>Name</th><th>Generated</th><th>Public key</th></tr></thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td><b-form-checkbox v-model="selectedIds" :value="item.id" :aria-label="'Select ' + item.name" /></td>
            <td>{{ item.name }}</td><td>{{ formatDate(item.date) }}</td>
            <td>
              <b-button size="sm" variant="outline-primary" @click="showKey(item)">Show key</b-button>
              <b-button size="sm" variant="outline-secondary" class="ml-2" @click="copyToClipboard(item.pubkey)">Copy key</b-button>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="4" class="text-muted">No deploy keys yet.</td></tr>
        </tbody>
      </table>
    </div>
    <b-modal id="rsakey-result-modal" :title="'Deploy Key — ' + shownName" ok-only ok-title="Close">
      <p>Add this public key to your Git repository's deploy keys.</p>
      <b-form-group label="Public key" label-for="shown-deploy-key">
        <b-form-textarea id="shown-deploy-key" readonly :value="createdPubkey" rows="5" class="mb-2" />
        <b-button variant="outline-secondary" size="sm" @click="copyToClipboard(createdPubkey)">Copy to clipboard</b-button>
      </b-form-group>
    </b-modal>
  </div>
</template>
<script>
import { mapGetters, mapActions } from 'vuex';
export default {
  name: 'Rsakeys',
  data() { return { selectedIds: [], items: [], loading: true, creating: false, error: null, keyName: '', createdPubkey: '', shownName: '' }; },
  created() { this.loadData(); },
  methods: {
    ...mapGetters({ getItems: 'rsakeys/getItems' }),
    ...mapActions({ fetchItems: 'rsakeys/fetchItems', createItem: 'rsakeys/createItem', deleteItems: 'rsakeys/deleteItems' }),
    async create() {
      if (this.creating || !this.keyName.trim()) return;
      this.creating = true;
      this.error = null;
      try {
        const result = await this.createItem(this.keyName.trim());
        if (!result || !result.success) { this.error = 'Failed to generate deploy key.'; return; }
        const key = result.response;
        if (key && key.pubkey) this.showKey(key);
        this.keyName = '';
        await this.loadData();
      } catch (e) { this.error = 'Failed to generate deploy key.'; }
      finally { this.creating = false; }
    },
    showKey(item) {
      this.shownName = item.name;
      this.createdPubkey = item.pubkey;
      this.$bvModal.show('rsakey-result-modal');
    },
    async deleteSelected() {
      const filenames = this.selectedIds.map(id => this.items.find(item => item.id === id)).filter(Boolean).map(item => item.filename);
      if (!filenames.length) return;
      try {
        const result = await this.deleteItems(filenames);
        if (!result || !result.success) { this.error = 'Failed to delete deploy keys.'; return; }
        this.selectedIds = [];
        await this.loadData();
      } catch (e) { this.error = 'Failed to delete deploy keys.'; }
    },
    async loadData() {
      this.loading = true;
      try { await this.fetchItems(); this.items = this.getItems(); }
      catch (e) { this.error = 'Could not load deploy keys.'; }
      finally { this.loading = false; }
    },
    formatDate(value) { return value ? new Date(value).toLocaleString() : '—'; },
    async copyToClipboard(value) {
      if (!value) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try { await navigator.clipboard.writeText(value); }
          catch (e) { this.copyFallback(value); }
        } else { this.copyFallback(value); }
        this.$toasted.show('Copied to clipboard', { type: 'success', duration: 2000 });
      } catch (e) { this.error = 'Could not copy the key. Select the public key and copy it manually.'; }
    },
    copyFallback(value) {
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      try { el.select(); if (!document.execCommand('copy')) throw new Error('copy failed'); }
      finally { document.body.removeChild(el); }
    },
  },
};
</script>
