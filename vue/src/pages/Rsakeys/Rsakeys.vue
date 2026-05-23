<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item active>Settings</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Settings - <span class="fw-semi-bold">RSA Keys</span>
    </h1>

    <p>
      <b-button variant="success" @click="create" :disabled="creating">
        {{ creating ? 'Generating...' : 'Generate RSA Key' }}
      </b-button>
      <b-button
        variant="danger"
        @click="deleteSelected"
        :disabled="!isSelected"
        class="ml-2"
      >Delete ({{ selectedCount }})</b-button>
    </p>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>

    <p>RSA keys are used to access private Git repositories. After generating, add the public key to your repository's deploy keys.</p>

    <List
      @selection-update="selectionUpdated"
      :datasource="items"
      :dataheaders="headers"
      :showLoading="loading"
    ></List>

    <!-- Generated Key Result Modal -->
    <b-modal id="rsakey-result-modal" title="RSA Key Generated" ok-only ok-title="Close">
      <p>Your new RSA key pair has been generated. Add the public key below to your Git repository's deploy keys.</p>
      <b-form-group label="Public Key">
        <b-form-textarea readonly :value="createdPubkey" rows="4" class="mb-2" />
        <b-button variant="outline-secondary" size="sm" @click="copyToClipboard(createdPubkey)">Copy to clipboard</b-button>
      </b-form-group>
    </b-modal>
  </div>
</template>

<script>
import List from '@/components/List/List';
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "Rsakeys",
  components: { List },
  data() {
    return {
      isSelected: false,
      selectedCount: 0,
      selectedIds: [],
      items: [],
      headers: [],
      loading: true,
      creating: false,
      error: null,
      createdPubkey: null,
    };
  },
  created() {
    this.$watch(() => this.$route.params, () => { this.loadData(); }, { immediate: true });
  },
  methods: {
    ...mapGetters({ getItems: 'rsakeys/getItems', getHeaders: 'rsakeys/getHeaders' }),
    ...mapActions({ fetchItems: 'rsakeys/fetchItems', createItem: 'rsakeys/createItem', deleteItems: 'rsakeys/deleteItems' }),
    async create() {
      this.creating = true;
      const result = await this.createItem();
      this.creating = false;
      if (result.success) {
        this.createdPubkey = result.response && result.response.pubkey ? result.response.pubkey : null;
        if (this.createdPubkey) this.$bvModal.show('rsakey-result-modal');
        this.loadData();
      } else {
        this.error = result.message || 'Failed to generate RSA key.';
      }
    },
    async deleteSelected() {
      const filenames = this.selectedIds
        .map(id => this.items.find(item => item.id === id))
        .filter(Boolean)
        .map(item => item.filename);
      if (!filenames.length) return;
      const result = await this.deleteItems(filenames);
      if (!result.success) this.error = result.message || 'Failed to delete RSA keys.';
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
