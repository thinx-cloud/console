<template>
  <div>
    <b-breadcrumb>
      <b-breadcrumb-item to="/app/transformers">Transformers</b-breadcrumb-item>
      <b-breadcrumb-item active>{{ form.alias || 'Editor' }}</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Transformer - <span class="fw-semi-bold">{{ form.alias }}</span>
    </h1>

    <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
    <b-alert v-if="saved" variant="success" show dismissible @dismissed="saved = false">Transformer saved.</b-alert>
    <b-alert v-if="hasChanges" variant="warning" show>You have unsaved changes.</b-alert>

    <b-form-group label="Alias" label-for="transformer-alias" class="mb-3" style="max-width:400px">
      <b-form-input id="transformer-alias" v-model="form.alias" @input="hasChanges = true" />
    </b-form-group>

    <codemirror
      v-model="form.body"
      :options="editorOptions"
      @input="hasChanges = true"
      class="mb-3"
    />

    <b-button variant="primary" @click="save" :disabled="saving">
      {{ saving ? 'Saving...' : 'Save' }}
    </b-button>
    <b-button variant="secondary" class="ml-2" @click="cancel">Cancel</b-button>
  </div>
</template>

<script>
import { codemirror } from 'vue-codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/theme/material.css';
import { mapGetters, mapActions } from 'vuex';

export default {
  name: "TransformerEditor",
  components: { codemirror },
  data() {
    return {
      form: { alias: '', body: '' },
      hasChanges: false,
      saving: false,
      saved: false,
      error: null,
      editorOptions: {
        tabSize: 2,
        mode: 'text/javascript',
        theme: 'material',
        lineNumbers: true,
        lineWrapping: false,
      },
    };
  },
  created() {
    this.loadTransformer();
  },
  beforeRouteLeave(to, from, next) {
    if (this.hasChanges) {
      this.$bvModal.msgBoxConfirm('You have unsaved changes. Leave anyway?', {
        title: 'Unsaved Changes',
        okVariant: 'warning',
        okTitle: 'Leave',
      }).then(confirmed => { if (confirmed) next(); });
    } else {
      next();
    }
  },
  methods: {
    ...mapGetters({ getByUtid: 'transformers/getByUtid' }),
    ...mapActions({ fetchItems: 'transformers/fetchItems', updateItem: 'transformers/updateItem' }),
    async loadTransformer() {
      await this.fetchItems();
      const utid = this.$route.params.utid;
      const transformer = this.getByUtid()(utid);
      if (!transformer) {
        this.error = 'Transformer not found.';
        return;
      }
      this.form.alias = transformer.alias;
      // body is stored base64-encoded
      try {
        this.form.body = transformer.body ? atob(transformer.body) : '';
      } catch {
        this.form.body = transformer.body || '';
      }
      this.hasChanges = false;
    },
    async save() {
      this.saving = true;
      const result = await this.updateItem({
        utid: this.$route.params.utid,
        alias: this.form.alias,
        body: this.form.body,
      });
      this.saving = false;
      if (result.success) {
        this.hasChanges = false;
        this.saved = true;
      } else {
        this.error = result.message || 'Failed to save transformer.';
      }
    },
    cancel() {
      this.$router.push('/app/transformers');
    },
  },
};
</script>

<style>
.CodeMirror {
  height: 400px;
  border: 1px solid #ddd;
  font-size: 13px;
}
</style>
