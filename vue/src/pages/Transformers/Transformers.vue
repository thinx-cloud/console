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
        <tr v-for="item in items" :key="item.utid">
          <td>{{ item.alias }}</td>
          <td>
            <b-button size="sm" variant="primary" @click="editTransformer(item.utid)" class="mr-2">Edit</b-button>
            <b-button size="sm" variant="danger" @click="deleteTransformer(item.utid)">Delete</b-button>
          </td>
        </tr>
        <tr v-if="!items.length">
          <td colspan="2" class="text-muted">No transformers yet.</td>
        </tr>
      </tbody>
    </table>

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

export default {
  name: "Transformers",
  data() {
    return {
      items: [],
      loading: true,
      error: null,
      form: { alias: '' },
      creating: false,
    };
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'transformers/getItems' }),
    ...mapActions({ fetchItems: 'transformers/fetchItems', createItem: 'transformers/createItem', deleteItem: 'transformers/deleteItem' }),
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
    async deleteTransformer(utid) {
      const confirmed = await this.$bvModal.msgBoxConfirm('Delete this transformer?', { title: 'Confirm Delete', okVariant: 'danger', okTitle: 'Delete' });
      if (!confirmed) return;
      try {
      const result = await this.deleteItem(utid);
      if (!result.success) this.error = result.message || 'Failed to delete transformer.';
      else await this.loadData();
      } catch (e) { this.error = 'Could not delete transformer.'; }
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
