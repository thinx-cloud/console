<template>
  <div>
    <b-breadcrumb>
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
        :disabled="!selectedKeys.length"
        class="ml-2"
      >Delete ({{ selectedKeys.length }})</b-button>
    </p>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>

    <p>Global environment variables are available to all your devices during firmware builds.</p>

    <!-- Page-local table (UI-T19, UI-T20): rows keyed by the variable name; values are never listed. -->
    <div v-if="loading" role="status">Loading…</div>
    <div v-else class="table-responsive">
      <table class="table table-striped enviros-table">
        <caption class="sr-only">Environment variables</caption>
        <thead>
          <tr><th><span class="sr-only">Select</span></th><th>Key</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.label" data-cy="enviro-row">
            <td><b-form-checkbox v-model="selectedKeys" :value="item.label" :aria-label="'Select ' + item.label" /></td>
            <td><span class="enviro-key" :title="item.label" data-cy="enviro-key">{{ item.label }}</span></td>
            <td class="actions-cell">
              <IconButton icon="fa fa-pencil" label="Edit value" data-cy="enviro-edit" @click="openEdit(item)" />
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="3">No environment variables yet. Add one with Add Variable.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit value (ENV-01, D-03, UI-T21, UI-T22): the current value is never shown, and the
         typed one stays inside this field (no toast, no error text, no log line). -->
    <b-modal id="enviro-edit-modal" :title="'Change value of ' + editKey" title-class="text-break" @shown="focusValue" @hide="onEditHide" @hidden="onEditHidden">
      <b-form id="enviro-edit-form" class="dialog-stack" @submit.prevent="saveEdit">
        <div class="dialog-field">
          <span id="enviro-edit-key-label" class="dialog-label">Key</span>
          <p class="enviro-edit-key" aria-labelledby="enviro-edit-key-label" data-cy="enviro-edit-key">{{ editKey }}</p>
        </div>
        <div class="dialog-field">
          <label for="enviro-edit-value" class="dialog-label">New value</label>
          <b-form-input id="enviro-edit-value" ref="valueInput" v-model="editValue" autocomplete="off" spellcheck="false" :disabled="editSaving" aria-describedby="enviro-edit-feedback enviro-edit-help" data-cy="enviro-edit-value" />
          <p id="enviro-edit-feedback" class="dialog-feedback" aria-live="polite" data-cy="enviro-edit-feedback">{{ editError }}</p>
          <p id="enviro-edit-help" class="dialog-help">The current value is never shown. The new value replaces it when you save.</p>
        </div>
      </b-form>
      <template #modal-footer>
        <b-button variant="default" :disabled="editSaving" data-cy="enviro-edit-keep" @click="$bvModal.hide('enviro-edit-modal')">Keep current value</b-button>
        <b-button variant="success" type="submit" form="enviro-edit-form" :disabled="!editValue.trim() || editSaving" data-cy="enviro-edit-save">{{ editSaving ? 'Saving…' : 'Save value' }}</b-button>
      </template>
    </b-modal>

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
import { mapGetters, mapActions } from "vuex";
import IconButton from '@/components/IconButton/IconButton';

export default {
  name: "Enviros",
  components: { IconButton },
  data() {
    return {
      items: [],
      selectedKeys: [],
      loading: true,
      loadFailed: false,
      error: null,
      form: { key: '', value: '' },
      editKey: '',
      editValue: '',
      editSaving: false,
      editError: null,
    };
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: "enviros/getItems" }),
    ...mapActions({ loadItems: "enviros/loadItems", createItem: "enviros/createItem", deleteItems: "enviros/deleteItems" }),
    async create(bvModalEvt) {
      bvModalEvt.preventDefault();
      if (!this.form.key.trim() || !this.form.value.trim()) return;
      const result = await this.createItem({ key: this.form.key.trim(), value: this.form.value.trim() });
      if (result.success) {
        this.form = { key: '', value: '' };
        this.$bvModal.hide('create-enviro-modal');
        this.items = this.getItems();
      } else {
        this.error = result.message || 'Failed to add environment variable.';
      }
    },
    async deleteSelected() {
      const names = this.selectedKeys.filter(name => this.items.some(item => item.label === name));
      if (!names.length) return;
      const result = await this.deleteItems(names);
      if (!result.success) this.error = result.message || 'Failed to delete environment variables.';
      this.selectedKeys = [];
      this.items = this.getItems();
    },
    // Edit value (D-03): the field opens empty on every open, and an earlier error is cleared.
    openEdit(item) {
      this.editKey = item.label;
      this.editValue = '';
      this.editError = null;
      this.$bvModal.show('enviro-edit-modal');
    },
    focusValue() {
      const input = this.$refs.valueInput;
      if (input && typeof input.focus === 'function') input.focus();
    },
    // Esc, the backdrop and the header close are ignored while the request runs (UI-T22).
    onEditHide(evt) {
      if (this.editSaving) evt.preventDefault();
    },
    // The typed value never outlives the dialog.
    onEditHidden() {
      this.editValue = '';
      this.editError = null;
    },
    // One PUT /api/v2/env replaces the value in one write (D-01, made exact-key by 46-01).
    // A failure keeps the dialog open with the typed value and reloads the list (D-04); the
    // copy names the key only, never the value.
    async saveEdit() {
      if (this.editSaving) return;
      const key = this.editKey;
      const value = this.editValue.trim();
      if (!key || !value) return;
      this.editSaving = true;
      this.editError = null;
      let result = null;
      try {
        result = await this.createItem({ key, value });
      } catch (e) { result = null; }
      this.editSaving = false;
      if (result && result.success) {
        this.$bvModal.hide('enviro-edit-modal');
        this.$toasted.show('Value saved', { type: 'success', duration: 2000 });
        // The store refreshed the list; when only that refresh failed, reload once.
        if (result.refreshed === false) await this.loadData();
        else this.items = this.getItems();
        return;
      }
      this.editError = 'Could not save the new value. ' + key + ' keeps its current value. Try again.';
      await this.loadData();
    },
    // Only the first load shows Loading… (`loading` starts true); reloads refresh in place.
    async loadData() {
      try {
        await this.loadItems();
        this.items = this.getItems();
        this.loadFailed = false;
      } catch (e) {
        this.items = [];
      } finally { this.loading = false; }
    },
  },
};
</script>
