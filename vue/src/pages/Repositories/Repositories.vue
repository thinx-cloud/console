<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item active>Management</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Management - <span class="fw-semi-bold">Repositories</span>
    </h1>

    <p>
      <b-button variant="success" @click="$bvModal.show('create-repo-modal')">Add Repository</b-button>
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
    <b-modal id="create-repo-modal" title="Add Repository" @ok="create" ok-title="Add" size="lg">
      <b-alert :show="!!error" variant="danger" class="mb-3">{{ error }}</b-alert>
      <b-form-group label="Git URL *" label-for="repo-url">
        <b-form-input
          id="repo-url"
          v-model="form.url"
          placeholder="https://github.com/your/repo.git"
          @input="autoAlias"
          required
        />
      </b-form-group>
      <b-form-group label="Alias *" label-for="repo-alias">
        <b-form-input id="repo-alias" v-model="form.alias" placeholder="my-firmware-repo" required />
      </b-form-group>
      <b-form-group label="Branch" label-for="repo-branch">
        <b-form-input id="repo-branch" v-model="form.branch" placeholder="origin/master" />
      </b-form-group>
      <b-form-group>
        <b-form-checkbox v-model="form.is_private">Private repository (requires an RSA deploy key)</b-form-checkbox>
      </b-form-group>
      <b-form-group label="CircleCI Token" label-for="repo-circle-token">
        <b-form-input id="repo-circle-token" v-model="form.circleToken" placeholder="Optional" />
      </b-form-group>
      <b-form-group label="Git Secret" label-for="repo-secret">
        <b-form-input id="repo-secret" v-model="form.secret" placeholder="Optional webhook secret" />
      </b-form-group>
    </b-modal>
  </div>
</template>

<script>
import List from '@/components/List/List';
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "Repositories",
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
      form: {
        url: '',
        alias: '',
        branch: 'origin/master',
        is_private: false,
        circleToken: '',
        secret: '',
      },
    };
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'repositories/getItems', getHeaders: 'repositories/getHeaders' }),
    ...mapActions({ fetchItems: 'repositories/fetchItems', createItem: 'repositories/createItem', deleteItems: 'repositories/deleteItems' }),
    autoAlias() {
      const match = this.form.url.match(/\/([^/]+?)(\.git)?$/);
      if (match) this.form.alias = match[1];
    },
    async create(bvModalEvt) {
      bvModalEvt.preventDefault();
      this.error = null;
      if (!this.form.url.trim() || !this.form.alias.trim()) return;
      const duplicate = this.items.find(r => r.alias === this.form.alias.trim());
      if (duplicate) {
        this.error = 'A repository with this alias already exists.';
        return;
      }
      const payload = {
        url: this.form.url.trim(),
        alias: this.form.alias.trim(),
        branch: this.form.branch.trim() || 'origin/master',
        is_private: this.form.is_private,
      };
      if (this.form.circleToken.trim()) payload.circleToken = this.form.circleToken.trim();
      if (this.form.secret.trim()) payload.secret = this.form.secret.trim();
      const result = await this.createItem(payload);
      if (result.success) {
        this.form = { url: '', alias: '', branch: 'origin/master', is_private: false, circleToken: '', secret: '' };
        this.$bvModal.hide('create-repo-modal');
        this.loadData();
      } else {
        this.error = result.message || 'Failed to add repository.';
      }
    },
    async deleteSelected() {
      const source_ids = this.selectedIds
        .map(id => this.items.find(item => item.id === id))
        .filter(Boolean)
        .map(item => item.id);
      if (!source_ids.length) return;
      const result = await this.deleteItems(source_ids);
      if (!result.success) this.error = result.message || 'Failed to delete repositories.';
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
