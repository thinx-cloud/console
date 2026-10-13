<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item active>Settings</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Settings - <span class="fw-semi-bold">Transformers</span>
    </h1>

    <p>
      <b-button variant="success" @click="$bvModal.show('create-transformer-modal')">Add Transformer</b-button>
    </p>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>

    <p>Status transformers are JavaScript functions that process and transform device status data before display.</p>

    <div v-if="loading">Loading...</div>
    <table v-else class="table table-striped">
      <thead>
        <tr>
          <th>Alias</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.utid" data-cy="transformer-row">
          <td>{{ displayName(item) }}</td>
          <td class="actions-cell">
            <IconButton icon="fa fa-wrench icon-white" label="Edit" :disabled="isDeleting(item)" data-cy="transformer-edit" @click="editTransformer(item.utid)" />
            <IconButton :icon="isDeleting(item) ? 'fa fa-spin fa-circle-o-notch' : 'fa fa-trash'" :label="isDeleting(item) ? 'Deleting…' : 'Delete'" variant="danger" :disabled="isDeleting(item)" data-cy="transformer-delete" @click="openDelete([item])" />
          </td>
        </tr>
        <tr v-if="!items.length">
          <td colspan="2" class="text-muted">No transformers yet.</td>
        </tr>
      </tbody>
    </table>

    <!-- Typed-confirm delete (TRANS-04, D-05, D-07, UI-T08, UI-T10). Names are text only. -->
    <b-modal id="transformer-delete-modal" title="Confirm Delete" body-class="text-break" @shown="focusConfirmInput" @hide="onDeleteHide">
      <b-form id="transformer-delete-form" class="dialog-stack" @submit.prevent="submitDelete">
        <p data-cy="transformer-delete-question">{{ deleteQuestion }}</p>
        <div class="dialog-field">
          <label for="transformer-delete-confirm" class="dialog-label">Type <span class="typed-confirm__word">confirm</span> to delete it.</label>
          <b-form-input id="transformer-delete-confirm" ref="confirmInput" v-model="confirmText" autocomplete="off" autocapitalize="off" spellcheck="false" :disabled="deleting" aria-describedby="transformer-delete-error" data-cy="transformer-delete-input" />
          <p id="transformer-delete-error" class="dialog-feedback" aria-live="polite" data-cy="transformer-delete-error">{{ deleteError }}</p>
        </div>
      </b-form>
      <template #modal-footer>
        <b-button variant="default" :disabled="deleting" data-cy="transformer-delete-keep" @click="$bvModal.hide('transformer-delete-modal')">Keep transformer</b-button>
        <b-button variant="danger" type="submit" form="transformer-delete-form" :disabled="!confirmMatches || deleting" data-cy="transformer-delete-submit">{{ deleting ? 'Deleting…' : 'Delete transformer' }}</b-button>
      </template>
    </b-modal>

    <!-- Create Modal -->
    <b-modal id="create-transformer-modal" title="Add Transformer" :ok-disabled="creating" @ok="create" ok-title="Create">
      <b-alert :show="!!error" variant="danger" class="mb-3">{{ error }}</b-alert>
      <b-form-group label="Alias" label-for="transformer-alias">
        <b-form-input id="transformer-alias" v-model="form.alias" placeholder="e.g. Battery Parser" required />
      </b-form-group>
    </b-modal>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import IconButton from '@/components/IconButton/IconButton';

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
      selectedUtids: [],
      deletingUtids: [],
      deleteTargets: [],
      confirmText: '',
      deleting: false,
      deleteError: null,
    };
  },
  computed: {
    // D-07: exactly the word confirm, surrounding spaces ignored, case-sensitive.
    confirmMatches() {
      return this.confirmText.trim() === 'confirm';
    },
    deleteQuestion() {
      const target = this.deleteTargets[0];
      return 'Delete the transformer "' + (target ? target.name : '') + '"? This cannot be undone.';
    },
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'transformers/getItems' }),
    ...mapActions({ fetchItems: 'transformers/fetchItems', createItem: 'transformers/createItem', deleteItems: 'transformers/deleteItems' }),
    // The stored alias when it is a non-blank string, else the utid (UI-T05).
    displayName(item) {
      return typeof item.alias === 'string' && item.alias.trim() ? item.alias : item.utid;
    },
    isDeleting(item) { return this.deletingUtids.includes(item.utid); },
    editTransformer(utid) {
      this.$router.push({ name: 'TransformerEditor', params: { utid } });
    },
    async create(bvModalEvt) {
      bvModalEvt.preventDefault();
      this.error = null;
      if (!this.form.alias.trim()) return;
      const duplicate = this.items.find(t => t.alias === this.form.alias.trim());
      if (duplicate) {
        this.error = 'A transformer with this alias already exists.';
        return;
      }
      if (this.creating) return;
      this.creating = true;
      try {
      const result = await this.createItem(this.form.alias.trim());
      if (result.success) {
        this.form.alias = '';
        this.$bvModal.hide('create-transformer-modal');
        await this.loadData();
      } else {
        this.error = result.message || 'Failed to create transformer.';
      }
      } catch (e) { this.error = 'Could not create transformer.'; }
      finally { this.creating = false; }
    },
    // One dialog for the row trash and the bulk trash (D-05). The typed word and the
    // error from an earlier opening are cleared every time (D-07).
    openDelete(targets) {
      if (this.deleting) return;
      this.deleteTargets = targets.map(item => ({ utid: item.utid, name: this.displayName(item) }));
      this.confirmText = '';
      this.deleteError = null;
      this.$bvModal.show('transformer-delete-modal');
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
      this.deleting = true;
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
          else this.items = this.getItems();
        } else {
          this.deleting = false;
          this.deleteError = 'Could not delete the transformer. Try again.';
        }
      } finally {
        this.deleting = false;
        this.deletingUtids = this.deletingUtids.filter(utid => !utids.includes(utid));
      }
    },
    async loadData() {
      this.loading = true;
      try { await this.fetchItems(); this.items = this.getItems(); }
      catch (e) { this.error = 'Could not load transformers.'; }
      finally { this.loading = false; }
    },
  },
};
</script>
