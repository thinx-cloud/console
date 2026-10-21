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
    <b-alert v-if="hasChanges" variant="warning" show>You have unsaved changes.</b-alert>

    <b-form-group label="Name" label-for="transformer-alias" class="mb-3" style="max-width:400px">
      <b-form-input id="transformer-alias" v-model="form.alias" @input="hasChanges = true" />
    </b-form-group>

    <codemirror
      v-model="form.body"
      :options="editorOptions"
      @input="hasChanges = true"
      class="mb-3"
    />

    <b-button variant="success" @click="save" :disabled="saving || !loaded || !form.alias.trim()">
      {{ saving ? 'Saving…' : 'Save Transformer' }}
    </b-button>
    <b-button variant="default" class="ml-2" @click="cancel">Back to Transformers</b-button>
  </div>
</template>

<script>
import { codemirror } from 'vue-codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/theme/material.css';
import { mapGetters, mapActions } from 'vuex';
import { confirmLeave } from '@/utils/confirmLeave';

export default {
  name: "TransformerEditor",
  components: { codemirror },
  data() {
    return {
      form: { alias: '', body: '' },
      // True only after the transformer was fetched and copied into the form.
      // Save stays disabled otherwise, so a failed load cannot blank it.
      loaded: false,
      hasChanges: false,
      leavePrompting: false,
      saving: false,
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
  // The shared unsaved-changes confirm (D-10, UI-T17); one dialog per leave attempt.
  async beforeRouteLeave(to, from, next) {
    if (!this.hasChanges) { next(); return; }
    if (this.leavePrompting) { next(false); return; }
    this.leavePrompting = true;
    const leaving = await confirmLeave(this);
    this.leavePrompting = false;
    if (leaving) next(); else next(false);
  },
  methods: {
    ...mapGetters({ getByUtid: 'transformers/getByUtid' }),
    ...mapActions({ fetchItems: 'transformers/fetchItems', updateItem: 'transformers/updateItem' }),
    async loadTransformer() {
      this.loaded = false;
      try { await this.fetchItems(); }
      catch (e) { this.error = 'Could not load transformers.'; return; }
      const utid = this.$route.params.utid;
      const transformer = this.getByUtid()(utid);
      if (!transformer) {
        this.error = 'Transformer not found.';
        return;
      }
      this.form.alias = transformer.alias || '';
      // body is stored base64-encoded
      try {
        this.form.body = transformer.body ? decodeURIComponent(escape(atob(transformer.body))) : '';
      } catch {
        this.form.body = transformer.body || '';
      }
      this.hasChanges = false;
      this.loaded = true;
    },
    async save() {
      if (this.saving) return;
      if (!this.loaded) {
        this.error = 'The transformer did not load. Reload the page before saving.';
        return;
      }
      if (!this.form.alias || !this.form.alias.trim()) {
        this.error = 'Enter a transformer name.';
        return;
      }
      this.saving = true;
      try {
      const result = await this.updateItem({
        utid: this.$route.params.utid,
        alias: this.form.alias,
        body: this.form.body,
      });
      if (result.success) {
        this.hasChanges = false;
        this.$router.push('/app/transformers');
      } else {
        this.error = result.message || 'Failed to save transformer.';
      }
      } catch (e) { this.error = 'Could not save transformer.'; }
      finally { this.saving = false; }
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
