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
      <table class="table deploy-keys-table">
        <caption class="sr-only">Deploy keys</caption>
        <thead><tr><th><span class="sr-only">Select</span></th><th>Name</th><th>Generated</th><th>Public key</th><th>Actions</th></tr></thead>
        <tbody v-for="item in items" :key="item.id" class="key-group" data-cy="deploy-key-group">
          <tr data-cy="deploy-key-row">
            <td><b-form-checkbox v-model="selectedIds" :value="item.id" :aria-label="'Select ' + item.name" :disabled="isDeleting(item)" /></td>
            <td><span class="key-name" dir="auto" :title="item.name" data-cy="key-name">{{ item.name }}</span></td>
            <td class="text-nowrap">{{ formatDate(item.date) }}</td>
            <td class="text-nowrap"><span class="key-fingerprint" title="SHA-256 fingerprint of the public key" data-cy="key-fingerprint">{{ fingerprintText(item.fingerprint) }}</span></td>
            <td class="actions-cell">
              <IconButton :icon="isShown(item) ? 'fa fa-eye-slash' : 'fa fa-eye'" :label="isShown(item) ? 'Hide key' : 'Show key'" :aria-expanded="String(isShown(item))" :aria-controls="'key-text-' + item.id" :disabled="isDeleting(item) || !hasPubkey(item)" data-cy="key-show" @click="toggleKey(item)" />
              <IconButton icon="fa fa-copy" label="Copy key" :disabled="isDeleting(item) || !hasPubkey(item)" data-cy="key-copy" @click="copyToClipboard(item.pubkey)" />
              <IconButton :icon="isDeleting(item) ? 'fa fa-spin fa-circle-o-notch' : 'fa fa-trash'" :label="isDeleting(item) ? 'Deleting…' : 'Delete'" variant="danger" :disabled="isDeleting(item)" data-cy="key-delete" @click="deleteRow(item)" />
            </td>
          </tr>
          <tr v-if="isShown(item)" class="key-detail-row">
            <td colspan="5"><pre class="key-text" :id="'key-text-' + item.id" data-cy="key-text">{{ item.pubkey }}</pre></td>
          </tr>
        </tbody>
        <tbody v-if="!items.length">
          <tr><td colspan="5" class="text-muted">{{ loadFailed ? 'Deploy keys could not be loaded. Reload the page to retry.' : 'No deploy keys yet.' }}</td></tr>
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
import IconButton from '@/components/IconButton/IconButton';

export default {
  name: 'Rsakeys',
  components: { IconButton },
  data() { return { selectedIds: [], items: [], loading: true, loadFailed: false, creating: false, error: null, keyName: '', createdPubkey: '', shownName: '', deletingIds: [], confirming: false, shownIds: [] }; },
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
    // The created-key result modal only; row keys open inline (UI-K06).
    showKey(item) {
      this.shownName = item.name;
      this.createdPubkey = item.pubkey;
      this.$bvModal.show('rsakey-result-modal');
    },
    isDeleting(item) { return this.deletingIds.includes(item.id); },
    isShown(item) { return this.shownIds.includes(item.id); },
    // Several keys may be open at once; ids are kept in an array (Vue 2 does not observe Set).
    toggleKey(item) {
      this.shownIds = this.isShown(item) ? this.shownIds.filter(id => id !== item.id) : this.shownIds.concat(item.id);
    },
    hasPubkey(item) { return typeof item.pubkey === 'string' && item.pubkey.length > 0; },
    fingerprintText(value) { return typeof value === 'string' && value ? value : '—'; },
    // Per-row delete (UI-K10, D-11): a named confirmation with the cancel button focused;
    // `confirming` makes every Delete a no-op while a dialog is open and `deletingIds`
    // keeps one click one request. The name is passed as plain text, never HTML.
    async deleteRow(item) {
      if (this.confirming || this.isDeleting(item)) return;
      this.confirming = true;
      let confirmed = false;
      try {
        confirmed = await this.$bvModal.msgBoxConfirm(
          'Delete the deploy key "' + item.name + '"? This cannot be undone. Repositories that use it stop building until a new key is generated and added to the Git host.',
          { title: 'Confirm Delete', okVariant: 'danger', okTitle: 'Delete', cancelTitle: 'Keep key', autoFocusButton: 'cancel', bodyClass: 'text-break' });
      } catch (e) { confirmed = false; }
      finally { this.confirming = false; }
      if (!confirmed || this.isDeleting(item)) return;
      this.deletingIds.push(item.id);
      this.error = null;
      try {
        const result = await this.deleteItems([item.filename]);
        if (!result || !result.success) { this.error = 'Could not delete the deploy key. Try again.'; return; }
        await this.loadData();
      } catch (e) { this.error = 'Could not delete the deploy key. Try again.'; }
      finally { this.deletingIds = this.deletingIds.filter(id => id !== item.id); }
    },
    async deleteSelected() {
      if (this.confirming) return;
      const filenames = this.selectedIds.map(id => this.items.find(item => item.id === id)).filter(Boolean).map(item => item.filename);
      if (!filenames.length) return;
      // Deletion removes the key pair on disk and cannot be undone (35 WR-06).
      const count = filenames.length === 1 ? 'this deploy key' : filenames.length + ' deploy keys';
      let confirmed = false;
      try {
        confirmed = await this.$bvModal.msgBoxConfirm(
          'Delete ' + count + '? This cannot be undone. Repositories that use ' + (filenames.length === 1 ? 'it' : 'them') + ' stop building until a new key is generated and added to the Git host.',
          { title: 'Confirm Delete', okVariant: 'danger', okTitle: 'Delete', cancelTitle: 'Cancel', autoFocusButton: 'cancel' });
      } catch (e) { confirmed = false; }
      if (!confirmed) return;
      try {
        const result = await this.deleteItems(filenames);
        if (!result || !result.success) { this.error = 'Failed to delete deploy keys.'; return; }
        this.selectedIds = [];
        await this.loadData();
      } catch (e) { this.error = 'Failed to delete deploy keys.'; }
    },
    async loadData() {
      this.loading = true;
      try { await this.fetchItems(); this.items = this.getItems(); this.loadFailed = false; }
      catch (e) { this.loadFailed = true; this.error = 'Could not load deploy keys.'; }
      finally { this.loading = false; }
    },
    formatDate(value) {
      if (!value) return '—';
      const date = new Date(value);
      return isNaN(date.getTime()) ? '—' : date.toLocaleString();
    },
    async copyToClipboard(value) {
      if (!value) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try { await navigator.clipboard.writeText(value); }
          catch (e) { this.copyFallback(value); }
        } else { this.copyFallback(value); }
        this.$toasted.show('Copied to clipboard', { type: 'success', duration: 2000 });
      } catch (e) { this.error = 'Could not copy the key. Use Show key and copy the text manually.'; }
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
