<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item active>Settings</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Settings - <span class="fw-semi-bold">Transformers</span>
    </h1>

    <div class="settings-add">
      <b-button variant="success" data-cy="transformer-add" @click="openCreate"><i class="fa fa-plus" aria-hidden="true"></i><span class="button-text">Add Transformer</span></b-button>
    </div>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
    <b-alert v-if="loadFailed" variant="danger" show data-cy="transformers-load-error">Could not load transformers. Refresh to retry.</b-alert>

    <p>Status transformers are JavaScript functions that process and transform device status data before display.</p>

    <div v-if="!loading && !loadFailed && items.length" class="bulk-toolbar" role="toolbar" aria-label="Selected transformers">
      <b-button size="sm" variant="danger" data-cy="transformer-bulk-delete" :disabled="!selectedUtids.length || bulkDeleting || deleting" @click="openBulkDelete">
        <i class="fa fa-trash" aria-hidden="true"></i><span class="button-text">{{ bulkLabel }}</span>
      </b-button>
    </div>
    <div v-if="loading" role="status">Loading…</div>
    <div v-else-if="!loadFailed" class="table-responsive">
      <table class="table table-striped transformers-table">
        <caption class="sr-only">Transformers</caption>
        <thead>
          <tr><th><span class="sr-only">Select</span></th><th>Name</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.utid" data-cy="transformer-row">
            <td><b-form-checkbox v-model="selectedUtids" :value="item.utid" :aria-label="'Select ' + displayName(item)" :disabled="isDeleting(item)" data-cy="transformer-select" /></td>
            <td><span class="transformer-name" dir="auto" :title="displayName(item)" data-cy="transformer-name">{{ displayName(item) }}</span></td>
            <td class="actions-cell">
              <IconButton icon="fa fa-wrench icon-white" label="Edit" :disabled="isDeleting(item)" data-cy="transformer-edit" @click="editTransformer(item.utid)" />
              <IconButton :icon="isDeleting(item) ? 'fa fa-spin fa-circle-o-notch' : 'fa fa-trash'" :label="isDeleting(item) ? 'Deleting…' : 'Delete'" variant="danger" :disabled="isDeleting(item)" data-cy="transformer-delete" @click="openDelete([item])" />
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="3">No transformers yet. Add one with Add Transformer.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Typed-confirm delete (TRANS-04, D-05..D-07, UI-T08..UI-T10). Names are text only. -->
    <b-modal id="transformer-delete-modal" title="Confirm Delete" body-class="text-break" @shown="focusConfirmInput" @hide="onDeleteHide">
      <b-form id="transformer-delete-form" class="dialog-stack" @submit.prevent="submitDelete">
        <p data-cy="transformer-delete-question">{{ deleteQuestion }}</p>
        <ul v-if="deleteMany" class="typed-confirm__names" data-cy="transformer-delete-names">
          <li v-for="target in deleteTargets" :key="target.utid" dir="auto">{{ target.name }}</li>
        </ul>
        <p class="typed-confirm__usage" data-cy="transformer-delete-usage"><i class="fa fa-warning" aria-hidden="true"></i> {{ usageText }}</p>
        <div class="dialog-field">
          <label for="transformer-delete-confirm" class="dialog-label">Type <span class="typed-confirm__word">confirm</span> to delete {{ deleteMany ? 'them' : 'it' }}.</label>
          <b-form-input id="transformer-delete-confirm" ref="confirmInput" v-model="confirmText" autocomplete="off" autocapitalize="off" spellcheck="false" :disabled="deleting" aria-describedby="transformer-delete-error" data-cy="transformer-delete-input" />
          <p id="transformer-delete-error" class="dialog-feedback" aria-live="polite" data-cy="transformer-delete-error">{{ deleteError }}</p>
        </div>
      </b-form>
      <template #modal-footer>
        <b-button variant="default" :disabled="deleting" data-cy="transformer-delete-keep" @click="$bvModal.hide('transformer-delete-modal')">{{ deleteMany ? 'Keep transformers' : 'Keep transformer' }}</b-button>
        <b-button variant="danger" type="submit" form="transformer-delete-form" :disabled="!confirmMatches || deleting" data-cy="transformer-delete-submit">{{ deleting ? 'Deleting…' : (deleteMany ? 'Delete transformers' : 'Delete transformer') }}</b-button>
      </template>
    </b-modal>

    <!-- Create dialog (UI-T11, D-14): its own feedback line; the page alert stays behind it. -->
    <b-modal id="create-transformer-modal" title="Add Transformer" :ok-title="creating ? 'Creating…' : 'Create Transformer'" ok-variant="success" cancel-title="Close without adding" cancel-variant="default" :ok-disabled="creating" @ok="create">
      <b-form-group label="Name" label-for="transformer-name">
        <b-form-input id="transformer-name" v-model="form.alias" placeholder="e.g. Battery Parser" aria-describedby="transformer-create-feedback" data-cy="transformer-create-input" />
      </b-form-group>
      <p id="transformer-create-feedback" class="dialog-feedback" aria-live="polite" data-cy="transformer-create-feedback">{{ createError }}</p>
    </b-modal>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import IconButton from '@/components/IconButton/IconButton';
import { countDevicesUsing, usageSentence } from '@/utils/transformerUsage';

export default {
  name: "Transformers",
  components: { IconButton },
  data() {
    return {
      items: [],
      loading: true,
      error: null,
      form: { alias: '' },
      creating: false,
      createError: null,
      selectedUtids: [],
      deletingUtids: [],
      deleteTargets: [],
      confirmText: '',
      deleting: false,
      deleteError: null,
      deleteFromBulk: false,
      bulkDeleting: false,
      loadFailed: false,
      devices: [],
      devicesLoaded: false,
    };
  },
  computed: {
    // D-07: exactly the word confirm, surrounding spaces ignored, case-sensitive.
    confirmMatches() {
      return this.confirmText.trim() === 'confirm';
    },
    deleteMany() {
      return this.deleteTargets.length > 1;
    },
    deleteQuestion() {
      if (this.deleteMany) return 'Delete these ' + this.deleteTargets.length + ' transformers? This cannot be undone.';
      const target = this.deleteTargets[0];
      return 'Delete the transformer "' + (target ? target.name : '') + '"? This cannot be undone.';
    },
    // D-06: counted from the device list loaded with the page; null when that load failed.
    usageCount() {
      if (!this.devicesLoaded) return null;
      return countDevicesUsing(this.devices, this.deleteTargets.map(target => target.utid));
    },
    usageText() {
      return usageSentence(this.usageCount, this.deleteMany);
    },
    // Selected transformers that are still listed, in table order.
    selectedItems() {
      return this.items.filter(item => this.selectedUtids.includes(item.utid));
    },
    bulkLabel() {
      if (this.bulkDeleting) return 'Deleting…';
      const count = this.selectedItems.length;
      return count ? 'Delete selected (' + count + ')' : 'Delete selected';
    },
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'transformers/getItems', getDevices: 'devices/getItems' }),
    ...mapActions({ fetchItems: 'transformers/fetchItems', createItem: 'transformers/createItem', deleteItems: 'transformers/deleteItems', loadDevices: 'devices/loadDevices' }),
    // The stored alias when it is a non-blank string, else the utid (UI-T05).
    displayName(item) {
      return typeof item.alias === 'string' && item.alias.trim() ? item.alias : item.utid;
    },
    isDeleting(item) { return this.deletingUtids.includes(item.utid); },
    editTransformer(utid) {
      this.$router.push({ name: 'TransformerEditor', params: { utid } });
    },
    openCreate() {
      if (!this.creating) this.createError = null;
      this.$bvModal.show('create-transformer-modal');
    },
    // Create (UI-T11): the dialog stays open and says why; one click sends one request.
    // The name is stored in the `alias` data key (D-14 changes the visible text only).
    async create(bvModalEvt) {
      bvModalEvt.preventDefault();
      if (this.creating) return;
      const name = this.form.alias.trim();
      if (!name) {
        this.createError = 'Enter a transformer name.';
        return;
      }
      if (this.items.some(t => typeof t.alias === 'string' && t.alias.trim() === name)) {
        this.createError = 'A transformer with this name already exists.';
        return;
      }
      this.creating = true;
      this.createError = null;
      try {
        let result = null;
        try { result = await this.createItem(name); } catch (e) { result = null; }
        if (result && result.success) {
          this.form.alias = '';
          this.$bvModal.hide('create-transformer-modal');
          // Phase 35 IN-02: the write succeeded but the store could not re-read it.
          if (result.refreshed === false) await this.loadData();
          else this.applyItems(this.getItems());
        } else {
          this.createError = 'Could not create the transformer. Try again.';
        }
      } finally { this.creating = false; }
    },
    // One dialog for the row trash and the bulk trash (D-05). The typed word and the
    // error from an earlier opening are cleared every time (D-07).
    openDelete(targets, fromBulk = false) {
      if (this.deleting || !targets.length) return;
      this.deleteTargets = targets.map(item => ({ utid: item.utid, name: this.displayName(item) }));
      this.deleteFromBulk = !!fromBulk;
      this.confirmText = '';
      this.deleteError = null;
      this.$bvModal.show('transformer-delete-modal');
    },
    // The bulk trash (UI-T07): the selected transformers that still exist and are not
    // already being deleted, in table order.
    openBulkDelete() {
      if (this.bulkDeleting || this.deleting) return;
      this.openDelete(this.selectedItems.filter(item => !this.isDeleting(item)), true);
    },
    focusConfirmInput() {
      const input = this.$refs.confirmInput;
      if (input && typeof input.focus === 'function') input.focus();
    },
    // Esc, the backdrop and the header close do nothing while the request runs (UI-T10).
    onDeleteHide(evt) {
      if (this.deleting) evt.preventDefault();
    },
    // Enter and a disabled button both land here: nothing is sent unless the word
    // matches, and a second submit while one runs is ignored (one write, D-08).
    async submitDelete() {
      if (!this.confirmMatches || this.deleting) return;
      const utids = this.deleteTargets.map(target => target.utid);
      if (!utids.length) return;
      const many = utids.length > 1;
      this.deleting = true;
      this.bulkDeleting = this.deleteFromBulk;
      this.deleteError = null;
      this.deletingUtids = this.deletingUtids.concat(utids.filter(utid => !this.deletingUtids.includes(utid)));
      try {
        let result = null;
        try { result = await this.deleteItems(utids); } catch (e) { result = null; }
        if (result && result.success) {
          // Cleared first: the hide guard would otherwise block the close.
          this.deleting = false;
          this.$bvModal.hide('transformer-delete-modal');
          this.selectedUtids = this.selectedUtids.filter(utid => !utids.includes(utid));
          // Phase 35 IN-02: the write succeeded but the store could not re-read it.
          if (result.refreshed === false) await this.loadData();
          else this.applyItems(this.getItems());
        } else {
          this.deleting = false;
          this.deleteError = many ? 'Could not delete the transformers. Try again.' : 'Could not delete the transformer. Try again.';
        }
      } finally {
        this.deleting = false;
        this.bulkDeleting = false;
        this.deletingUtids = this.deletingUtids.filter(utid => !utids.includes(utid));
      }
    },
    // A listed set of transformers: the rows, and the selection pruned to them (UI-T12).
    applyItems(items) {
      const list = Array.isArray(items) ? items : [];
      const listed = list.map(item => item.utid);
      this.items = list;
      this.selectedUtids = this.selectedUtids.filter(utid => listed.includes(utid));
    },
    // Transformers and devices load side by side (UI-T09, UI-T12). A failed transformer
    // load clears the rows behind one non-dismissible alert and leaves the action error
    // alone; a failed device load only makes the usage sentence generic. Only the first
    // load shows Loading… (`loading` starts true), so later loads refresh in place.
    async loadData() {
      const [list, devices] = await Promise.allSettled([this.fetchItems(), this.loadDevices()]);
      if (list.status === 'fulfilled') {
        this.applyItems(this.getItems());
        this.loadFailed = false;
      } else {
        this.items = [];
        this.selectedUtids = [];
        this.loadFailed = true;
      }
      if (devices.status === 'fulfilled') {
        const known = this.getDevices();
        this.devices = Array.isArray(known) ? known : [];
        this.devicesLoaded = true;
      } else {
        this.devicesLoaded = false;
      }
      this.loading = false;
    },
  },
};
</script>
