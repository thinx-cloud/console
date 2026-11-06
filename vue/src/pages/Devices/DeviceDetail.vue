<template>
  <div v-if="device">
    <b-breadcrumb>
      <b-breadcrumb-item to="/app/devices">Devices</b-breadcrumb-item>
      <b-breadcrumb-item active>{{ device.alias }}</b-breadcrumb-item>
    </b-breadcrumb>
    <h1 class="page-title">
      Device - <span class="fw-semi-bold">{{ device.alias }}</span>
    </h1>

    <!-- POL-01 D-18 (UI-C06): the content column is capped at 1140px, left-aligned under the title. -->
    <div class="device-detail-content" data-cy="device-detail-content">
      <b-alert v-if="error" variant="danger" show dismissible @dismissed="error = null">{{ error }}</b-alert>
      <b-alert v-if="message" variant="success" show dismissible @dismissed="message = null">{{ message }}</b-alert>

      <b-card title="Actions" class="mb-3" data-cy="card-actions">
        <b-button ref="buildButton" variant="primary" class="mr-2 mb-2" data-cy="action-build" :disabled="buildPending" @click="buildDevice">
          <b-spinner v-if="buildPending" small aria-hidden="true" data-cy="action-build-spinner"></b-spinner>
          <i v-else class="fa fa-cogs" aria-hidden="true"></i>
          <span class="button-text">Build Firmware</span>
        </b-button>
        <span class="sr-only" role="status" data-cy="action-build-status">{{ buildPending ? 'Requesting build…' : '' }}</span>
        <b-button variant="danger" @click="revokeDevice" class="mr-2 mb-2"><i class="fa fa-trash mr-1" aria-hidden="true" /> Revoke Device</b-button>
        <b-button variant="warning" data-cy="action-transfer" @click="$bvModal.show('transfer-modal')" class="mr-2 mb-2"><i class="fa fa-exchange mr-1" aria-hidden="true" /> Transfer Device</b-button>
        <b-button variant="secondary" data-cy="action-environment" :disabled="envLoading" @click="openEnvironmentEditor" class="mr-2 mb-2"><i class="fa fa-sliders mr-1" aria-hidden="true" /> Environment</b-button>
      </b-card>

      <b-row>
        <!-- Left: metadata -->
        <b-col cols="12">
          <b-card title="Device Info" class="mb-3" data-cy="card-device-info">
            <table class="table table-sm table-borderless mb-0">
              <tr><td class="text-muted" style="width:140px">UDID</td><td><code>{{ device.udid }}</code></td></tr>
              <tr><td class="text-muted">MAC</td><td>{{ device.mac }}</td></tr>
              <tr><td class="text-muted">Platform</td><td>{{ device.platform }}</td></tr>
              <tr><td class="text-muted">Firmware</td><td>{{ device.firmware }}</td></tr>
              <tr><td class="text-muted">Version</td><td>{{ device.version }}</td></tr>
              <tr><td class="text-muted">Status</td><td>{{ device.status }}</td></tr>
              <tr><td class="text-muted">Last seen</td><td>{{ device.lastupdate | fromNow }}</td></tr>
              <tr><td class="text-muted">Commit</td><td><code>{{ device.commit }}</code></td></tr>
              <tr>
                <td class="text-muted">MQTT Channel</td>
                <td>
                  <code data-cy="mqtt-channel">{{ mqttChannel }}</code>
                  <b-button size="sm" variant="link" class="p-0 ml-2" data-cy="mqtt-channel-copy" aria-label="Copy MQTT channel" @click="copyText(mqttChannel)"><i class="fa fa-clipboard" aria-hidden="true"></i></b-button>
                </td>
              </tr>
            </table>
            <!-- Legacy shows the device's transformer error above its status. -->
            <b-alert v-if="device.transformer_error" variant="danger" show class="mt-2 mb-0" data-cy="transformer-error">{{ device.transformer_error }}</b-alert>
          </b-card>

          <b-card title="Network" class="mb-3">
            <table class="table table-sm table-borderless mb-0">
              <tr><td class="text-muted" style="width:140px">RSSI</td><td>{{ device.rssi }}</td></tr>
              <tr v-if="device.snr !== undefined && device.snr !== null"><td class="text-muted">SNR</td><td data-cy="device-snr">{{ device.snr }}</td></tr>
              <tr><td class="text-muted">Station</td><td>{{ device.station }}</td></tr>
              <tr><td class="text-muted">Lat/Lon</td><td>{{ device.lat }}, {{ device.lon }}</td></tr>
            </table>
          </b-card>
        </b-col>

        <!-- Right: editable fields + actions -->
        <b-col cols="12">
          <b-card title="Edit Device" class="mb-3">
            <b-form-group label="Alias">
              <b-input-group>
                <b-form-input v-model="editForm.alias" />
                <b-input-group-append>
                  <b-button variant="primary" @click="saveField('alias')">Save</b-button>
                </b-input-group-append>
              </b-input-group>
            </b-form-group>
            <b-form-group label="Description">
              <b-input-group>
                <b-form-input v-model="editForm.description" />
                <b-input-group-append>
                  <b-button variant="primary" @click="saveField('description')">Save</b-button>
                </b-input-group-append>
              </b-input-group>
            </b-form-group>
            <!-- Legacy parity (device.html "Auto Update"): shown only for platforms THiNX can build,
                 saved on toggle. The API reads it on check-in and on a push to the linked repository. -->
            <b-form-group
              v-if="buildSupported"
              label="Auto Update"
              label-for="device-auto-update"
              description="Build and deliver new firmware automatically when the linked repository changes."
              class="mb-0"
              data-cy="auto-update-group">
              <b-form-checkbox
                id="device-auto-update"
                v-model="editForm.auto_update"
                switch
                :disabled="autoUpdateSaving"
                data-cy="auto-update-switch"
                @change="saveAutoUpdate">
                {{ editForm.auto_update ? 'On' : 'Off' }}
              </b-form-checkbox>
            </b-form-group>
          </b-card>

          <!-- Legacy parity (services/console/src/app/views/device.html): the device settings the Legacy
               Device view edits. Selects and toggles save on change, text fields have a Save button. -->
          <b-card title="Device Settings" class="mb-3" data-cy="card-device-settings">
            <b-form-group label="API Key" label-for="device-apikey">
              <b-input-group>
                <b-form-select id="device-apikey" v-model="editForm.keyhash" :options="apikeyOptions" :disabled="settingsSaving" data-cy="apikey-select" @change="saveSetting({ keyhash: $event }, 'API key saved.')" />
                <b-input-group-append>
                  <b-button variant="warning" to="/app/apikeys" data-cy="manage-apikeys">Manage API Keys</b-button>
                </b-input-group-append>
              </b-input-group>
              <b-alert v-if="!editForm.keyhash" variant="warning" show class="mt-2 mb-0" data-cy="apikey-missing">
                <strong><i class="fa fa-warning" aria-hidden="true"></i> No API Key assigned.</strong>
                We recommend one API Key per device to track key usage and misuse. A key is required for build.
                <span v-if="isSigfox">On Sigfox, change the key in the <a href="https://backend.sigfox.com" target="_blank" rel="noopener noreferrer">Sigfox Backend</a> callback configuration manually.</span>
              </b-alert>
            </b-form-group>

            <b-form-group label="Source" label-for="device-source" :description="buildSupported ? null : 'This platform runs vendor firmware; THiNX does not build it.'">
              <b-input-group>
                <b-form-select id="device-source" v-model="editForm.source" :options="sourceOptions" :disabled="!buildSupported || sourceSaving" data-cy="source-select" @change="changeSource" />
                <b-input-group-append>
                  <b-button variant="warning" to="/app/repositories" data-cy="manage-repositories">Manage Repositories</b-button>
                </b-input-group-append>
              </b-input-group>
            </b-form-group>

            <b-form-group label="Icon">
              <div class="d-flex align-items-center">
                <span class="device-icon mr-2" :class="'platform-' + platformKey"><img class="device-icon-symbol" :src="iconSrc(editForm.icon)" alt="Current device icon" data-cy="device-icon-current"></span>
                <b-button size="sm" variant="secondary" :aria-expanded="showIcons ? 'true' : 'false'" data-cy="device-icon-toggle" @click="showIcons = !showIcons">{{ showIcons ? 'Close' : 'Change icon' }}</b-button>
              </div>
              <div v-if="showIcons" class="device-icon-picker mt-2" role="listbox" aria-label="Device icons" data-cy="device-icon-picker">
                <button
                  v-for="n in iconNumbers"
                  :key="n"
                  type="button"
                  class="device-icon-choice"
                  :class="{ 'is-selected': n === editForm.icon }"
                  role="option"
                  :aria-selected="n === editForm.icon ? 'true' : 'false'"
                  :aria-label="'Icon ' + n"
                  :disabled="settingsSaving"
                  @click="pickIcon(n)"><img :src="iconSrc(n)" alt=""></button>
              </div>
            </b-form-group>

            <b-form-group label="Category" label-for="device-category">
              <b-form-select id="device-category" v-model="editForm.category" :options="categoryOptions" :disabled="settingsSaving" data-cy="category-select" @change="saveSetting({ category: $event }, 'Category saved.')" />
            </b-form-group>

            <b-form-group label="Tags" label-for="device-tags" description="Type a tag and press Enter.">
              <b-input-group>
                <b-form-tags input-id="device-tags" v-model="editForm.tags" separator="," remove-on-delete placeholder="Add tag…" :disabled="settingsSaving" data-cy="tags-input" />
                <b-input-group-append>
                  <b-button variant="primary" :disabled="!tagsDirty || settingsSaving" data-cy="tags-save" @click="saveTags">Save</b-button>
                </b-input-group-append>
              </b-input-group>
            </b-form-group>

            <b-form-group label="Timezone" label-for="device-timezone" :description="deviceTimeText">
              <b-input-group>
                <b-form-input id="device-timezone" v-model="editForm.timezone_utc" list="device-timezone-list" placeholder="e.g. Europe/Prague" autocomplete="off" data-cy="timezone-input" />
                <b-input-group-append>
                  <b-button variant="primary" :disabled="!timezoneDirty || settingsSaving" data-cy="timezone-save" @click="saveTimezone">Save</b-button>
                </b-input-group-append>
              </b-input-group>
              <datalist id="device-timezone-list">
                <option v-for="zone in timezoneOptions" :key="zone" :value="zone" />
              </datalist>
            </b-form-group>

            <b-form-group label="Mesh Channels" class="mb-0">
              <b-form-checkbox-group
                v-if="meshOptions.length"
                v-model="editForm.mesh_ids"
                :options="meshOptions"
                :disabled="meshSaving"
                stacked
                data-cy="mesh-checkboxes"
                @change="changeMesh" />
              <p v-else class="mb-1" data-cy="mesh-empty">No channels yet.</p>
              <b-button size="sm" variant="warning" class="mt-1" to="/app/channels" data-cy="manage-channels">Manage Channels</b-button>
            </b-form-group>
          </b-card>

          <b-card v-if="device.source" title="Linked Repository" class="mb-3">
            <p class="mb-1">{{ linkedRepository ? linkedRepository.alias : 'Repository unavailable' }}</p>
            <p v-if="linkedRepository" class="text-monospace text-break">
              <a v-if="linkedRepositoryHref" :href="linkedRepositoryHref" target="_blank" rel="noopener noreferrer" data-cy="linked-repository-url">{{ linkedRepository.url }}</a>
              <span v-else data-cy="linked-repository-url">{{ linkedRepository.url }}</span>
            </p>
          </b-card>

          <b-card title="Environment Variables" class="mb-3" data-cy="card-enviros">
            <div v-if="!envEditing">
              <div v-if="device.environment && Object.keys(device.environment).length">
                <table class="table table-sm table-borderless mb-2">
                  <tr v-for="(val, key) in device.environment" :key="key">
                    <td class="text-muted" style="width:200px">{{ key }}</td>
                    <td><code>{{ val }}</code></td>
                  </tr>
                </table>
                <p class="text-muted small">ssid and pass are masked here; Edit loads the stored values.</p>
              </div>
              <p v-else class="text-muted">No environment variables.</p>
              <b-button variant="secondary" size="sm" data-cy="env-edit" :disabled="envLoading" @click="editEnvironment">
                {{ envLoading ? 'Loading…' : 'Edit' }}
              </b-button>
            </div>

            <div v-else>
              <b-form-textarea
                v-model="envDraft"
                data-cy="env-draft"
                rows="10"
                spellcheck="false"
                class="text-monospace mb-2"
                aria-label="Device environment as JSON" />
              <p v-if="envError" class="text-danger small" data-cy="env-error">{{ envError }}</p>
              <p v-else-if="envConfirmClear" class="text-warning small" data-cy="env-confirm-clear">This empties the environment — {{ envLoadedCount }} variable(s) will be removed. Click again to confirm.</p>
              <p v-else class="text-muted small">A JSON object of scalar values, for example <code>{ "ssid": "my-network", "interval": 300 }</code>.</p>
              <b-button variant="primary" size="sm" class="mr-2" data-cy="env-save" :disabled="!!envError" @click="saveEnvironment">{{ envConfirmClear ? 'Confirm clear' : 'Save' }}</b-button>
              <b-button variant="secondary" size="sm" data-cy="env-cancel" @click="cancelEnvironmentEdit">Cancel</b-button>
            </div>
          </b-card>

          <!-- UI-T15/UI-T16: the note says when the ticks differ from the stored assignment; the
               save result is reported inside this card, not in the page alerts. -->
          <b-card class="mb-3" data-cy="card-transformers">
            <div class="transformer-card-head">
              <h4 class="card-title">Transformer Assignment</h4>
              <span class="unsaved-note" role="status" data-cy="transformers-dirty">{{ transformersDirty ? 'Unsaved changes' : '' }}</span>
            </div>
            <b-form-group label="Assigned transformers">
              <b-form-checkbox-group
                v-if="assignmentOptions.length"
                v-model="editForm.transformers"
                :options="assignmentOptions"
                :disabled="transformersSaving"
                stacked
                data-cy="transformer-checkboxes"
                @change="onTransformersTicked"
              />
              <p v-else class="mb-0" data-cy="transformers-empty">No transformers yet. Use Create &amp; Assign to add one.</p>
            </b-form-group>
            <b-alert variant="success" dismissible class="transformer-card-alert" :show="!!transformersMessage" data-cy="transformers-saved" @dismissed="transformersMessage = null">{{ transformersMessage }}</b-alert>
            <b-alert variant="danger" dismissible class="transformer-card-alert" :show="!!transformersError" data-cy="transformers-error" @dismissed="transformersError = null">{{ transformersError }}</b-alert>
            <div class="transformer-card-actions">
              <b-button variant="success" size="sm" data-cy="transformers-save" :disabled="!transformersDirty || transformersSaving" @click="saveTransformers">
                <template v-if="transformersSaving"><i class="fa fa-spin fa-circle-o-notch" aria-hidden="true"></i><span class="button-text">Saving…</span></template>
                <template v-else>Save Transformers</template>
              </b-button>
              <b-button variant="default" size="sm" :disabled="transformersSaving" @click="$bvModal.show('device-transformer-modal')">Create &amp; Assign</b-button>
              <b-button variant="warning" size="sm" to="/app/transformers" data-cy="manage-transformers">Manage Transformers</b-button>
            </div>
          </b-card>

          <b-card title="Build History" class="mb-3" data-cy="card-build-history">
            <div v-if="buildHistory.length">
              <table class="table table-striped table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Build ID</th>
                    <th>Status</th>
                    <th>Log</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Rows are a summary only; the full log loads only from the row's View button (G-36-3). -->
                  <tr v-for="(build, i) in buildHistory" :key="i">
                    <td>{{ build.date | fromNow }}</td>
                    <td><code>{{ build.build_id }}</code></td>
                    <td>
                      <b-badge :variant="buildStatusVariant(build.status)">{{ build.status || '—' }}</b-badge>
                    </td>
                    <td>
                      <b-button v-if="hasBuildLog(build)" size="sm" variant="link" class="p-0" data-cy="build-open-log" :aria-label="'View build log ' + build.build_id" @click="openBuildLog(build)"><i class="la la-eye" aria-hidden="true"></i> View</b-button>
                      <span v-else data-cy="build-no-log"><span aria-hidden="true">—</span><span class="sr-only">No build log</span></span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-muted mb-0">No build history.</p>
          </b-card>
        </b-col>
      </b-row>
    </div>

    <b-modal id="device-transformer-modal" title="Create & Assign Transformer" @ok="createTransformer" :ok-disabled="transformerSaving" ok-title="Create & Assign" cancel-title="Close without creating" cancel-variant="default">
      <b-alert v-if="transformerError" variant="danger" show>{{ transformerError }}</b-alert>
      <b-form-group label="Name" label-for="device-transformer-name">
        <b-form-input id="device-transformer-name" v-model="transformerForm.alias" required />
      </b-form-group>
      <b-form-group label="JavaScript" label-for="device-transformer-body">
        <b-form-textarea id="device-transformer-body" v-model="transformerForm.body" rows="8" class="text-monospace" />
      </b-form-group>
    </b-modal>
    <BuildLogDialog ref="buildLogDialog" />
    <b-modal id="transfer-modal" title="Transfer Device" @ok="transferDevice" ok-title="Transfer" ok-variant="warning">
      <p>Transfer this device to another owner.</p>
      <b-form-group label="Target owner email" label-for="transfer-to">
        <b-form-input id="transfer-to" v-model="transferForm.to" placeholder="owner@example.com" required />
      </b-form-group>
      <b-form-checkbox v-model="transferForm.mig_sources" class="mb-2">Migrate source repositories</b-form-checkbox>
      <b-form-checkbox v-model="transferForm.mig_apikeys">Migrate API keys</b-form-checkbox>
    </b-modal>
  </div>
  <div v-else-if="loading" class="text-center py-5">
    <b-spinner label="Loading device..." />
    <p class="text-muted mt-2">Loading device...</p>
  </div>
  <div v-else>
    <b-alert variant="warning" show>Device not found.</b-alert>
    <b-button to="/app/devices" variant="secondary">Back to Devices</b-button>
  </div>
</template>

<script>
import BuildLogDialog from '@/components/BuildLogDialog/BuildLogDialog';
import { mapGetters, mapActions } from 'vuex';
import moment from 'moment';
import { parseEnvironmentJSON } from '@/utils/envJson';
import { buildStatusVariant, hasBuildLog } from '@/utils/buildLog';
import { confirmLeave } from '@/utils/confirmLeave';
import { platformInfo } from '@/utils/platforms';
import { CATEGORIES, DEFAULT_CATEGORY, ICON_COUNT, iconNumber, iconFileNumber, normalizeCategory, timezoneNames, timezoneAbbr, timeInZone, cleanTags, sameSet } from '@/utils/deviceSettings';

// The medium iot icons, as on the device list (Devices.vue DEVICE_SYMBOLS). Resolved on first
// use, so the plain-node unit tests can load this file and pass their own resolver.
let deviceSymbols = null;
function deviceSymbol(raw) {
  if (!deviceSymbols) deviceSymbols = require.context('@/assets/thinx/ioticons', false, /^\.\/b_medium_\d\d\.png$/);
  return deviceSymbols('./b_medium_' + iconFileNumber(raw) + '.png');
}

export default {
  name: "DeviceDetail",
  components: { BuildLogDialog },
  filters: {
    fromNow(val) {
      if (!val) return '—';
      return moment(val).fromNow();
    }
  },
  data() {
    return {
      device: null,
      loading: true,
      error: null,
      message: null,
      // POL-01 D-17: set from the Build Firmware click until POST /build settles; not the build itself.
      buildPending: false,
      editForm: {
        alias: '', description: '', transformers: [], auto_update: false,
        keyhash: null, source: null, icon: 1, category: DEFAULT_CATEGORY, tags: [], timezone_utc: '', mesh_ids: [],
      },
      // Single-shot flag for the Auto Update switch: one PUT per toggle.
      autoUpdateSaving: false,
      // Device Settings card (Legacy parity): one write at a time per kind.
      settingsSaving: false,
      sourceSaving: false,
      meshSaving: false,
      showIcons: false,
      iconNumbers: Array.from({ length: ICON_COUNT }, (_, i) => i + 1),
      timezoneOptions: timezoneNames(),
      // Re-evaluated every minute so "It is … in the device's timezone" stays current.
      now: new Date(),
      clockTimer: null,
      transformerForm: { alias: '', body: 'var transformer = function(status, device) { return status; };' },
      transformerSaving: false,
      transformerError: null,
      // Set while the unsaved-changes confirm is open, so a second leave attempt
      // (a double click on a link) is refused instead of opening a second dialog.
      leavePrompting: false,
      // Transformer Assignment save (POL-03, D-11): single-shot flag and the card's own result.
      transformersSaving: false,
      transformersMessage: null,
      transformersError: null,
      buildHistory: [],
      transferForm: { to: '', mig_sources: false, mig_apikeys: false },
      // Environment editor. envDraft is the textarea's raw text; it only reaches
      // the device once parseEnvironmentJSON accepts it.
      envEditing: false,
      envDraft: '',
      envLoading: false,
      envLoadError: null,
      // Clearing every variable is a legitimate edit and an expensive mistake, so
      // it takes a second click. envLoadedCount is what the device had when the
      // editor opened; envConfirmClear is armed only while the draft would empty it.
      envLoadedCount: 0,
      envConfirmClear: false,
    };
  },
  watch: {
    envDraft() {
      this.envConfirmClear = false;
    },
  },
  computed: {
    // Same gate as the Legacy Auto Update row and the device list's Build action.
    buildSupported() {
      return !!this.device && platformInfo(this.device.platform).build === true;
    },
    platformKey() {
      return this.device ? platformInfo(this.device.platform).key : 'unknown';
    },
    isSigfox() {
      return this.platformKey === 'sigfox';
    },
    // Legacy: '/' + owner + '/' + udid. The device list carries the owner id.
    mqttChannel() {
      if (!this.device) return '';
      return '/' + (this.device.owner || '') + '/' + this.device.udid;
    },
    // Keys by alias, hash prefix to tell same-named keys apart. A keyhash with no key behind it
    // (deleted key) still gets an option, so the select shows it instead of going blank.
    apikeyOptions() {
      const keys = (this.getApikeys() || []).filter(k => k && typeof k.hash === 'string');
      const options = [{ value: null, text: '— No API key —' }, ...keys.map(k => ({ value: k.hash, text: (k.alias || 'Unnamed key') + ' (' + k.hash.slice(0, 6) + ')' }))];
      const current = this.device && this.device.keyhash;
      if (current && !keys.some(k => k.hash === current)) options.push({ value: current, text: '(missing key) ' + String(current).slice(0, 6) });
      return options;
    },
    sourceOptions() {
      const repos = (this.getRepositories() || []).filter(r => r && r.id);
      const options = [{ value: null, text: '— No source —' }, ...repos.map(r => ({ value: r.id, text: (r.alias || r.id) + (r.url ? ' — ' + r.url : '') }))];
      const current = this.device && this.device.source;
      if (current && !repos.some(r => r.id === current)) options.push({ value: current, text: '(missing repository) ' + current });
      return options;
    },
    categoryOptions() {
      return CATEGORIES.map(c => ({ value: c, text: c }));
    },
    meshOptions() {
      const channels = (this.getChannels() || []).filter(c => c && c.mesh_id);
      const known = new Set(channels.map(c => c.mesh_id));
      const attached = (this.device && Array.isArray(this.device.mesh_ids)) ? this.device.mesh_ids : [];
      const missing = attached.filter(id => id && !known.has(id));
      return [...channels.map(c => ({ value: c.mesh_id, text: c.alias || c.mesh_id })), ...missing.map(id => ({ value: id, text: '(missing) ' + id }))];
    },
    tagsDirty() {
      return !!this.device && !sameSet(cleanTags(this.editForm.tags), cleanTags(this.device.tags));
    },
    timezoneDirty() {
      return !!this.device && (this.editForm.timezone_utc || '').trim() !== (this.device.timezone_utc || '');
    },
    deviceTimeText() {
      const zone = this.device && this.device.timezone_utc;
      const time = zone ? timeInZone(zone, this.now) : null;
      return time ? `It is ${time} in the device's timezone.` : 'No timezone set.';
    },
    envError() {
      if (this.envLoadError) return this.envLoadError;
      const result = parseEnvironmentJSON(this.envDraft);
      return result.ok ? null : result.error;
    },
    linkedRepository() {
      return (this.getRepositories() || []).find(repo => repo.id === this.device.source) || null;
    },
    // Repository URLs are user-entered: only http(s) is ever bound to an href; SSH remotes,
    // javascript:, data: and anything unparseable stay plain text (G-35-4).
    linkedRepositoryHref() {
      const url = this.linkedRepository && this.linkedRepository.url;
      if (typeof url !== 'string') return null;
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
      } catch (e) {
        return null;
      }
    },
    transformerOptions() {
      return (this.getTransformers() || []).map(t => ({ value: t.utid, text: t.alias || t.utid }));
    },
    // Assigned utids with no transformer behind them (deleted, or the list failed to load) still get a
    // checkbox, so they can be seen and unticked instead of being re-saved invisibly (37 WR-01).
    assignmentOptions() {
      const known = new Set(this.transformerOptions.map(o => o.value));
      const assigned = [...((this.device && this.device.transformers) || []), ...(this.editForm.transformers || [])];
      const missing = [...new Set(assigned)].filter(utid => utid && !known.has(utid));
      return [...this.transformerOptions, ...missing.map(utid => ({ value: utid, text: '(missing) ' + utid }))];
    },
    // The ticks differ from the stored assignment (POL-03, D-09). Compared as sets: order and
    // duplicates do not count, and a device without a transformers array has none assigned.
    transformersDirty() {
      if (!this.device) return false;
      const ticked = new Set(this.editForm.transformers || []);
      const stored = new Set(Array.isArray(this.device.transformers) ? this.device.transformers : []);
      if (ticked.size !== stored.size) return true;
      return [...ticked].some(utid => !stored.has(utid));
    },
  },
  created() {
    this.loadDevice();
    this.clockTimer = setInterval(() => { this.now = new Date(); }, 60000);
  },
  beforeDestroy() {
    clearInterval(this.clockTimer);
  },
  // Every route leave (Manage Transformers, sidebar, breadcrumb, Back) asks first while the
  // assignment has unsaved ticks (37 IN-02, D-10). There is no page-unload prompt (D-12).
  async beforeRouteLeave(to, from, next) {
    if (!this.transformersDirty) { next(); return; }
    if (this.leavePrompting) { next(false); return; }
    this.leavePrompting = true;
    const leaving = await confirmLeave(this);
    this.leavePrompting = false;
    if (leaving) next(); else next(false);
  },
  methods: {
    buildStatusVariant,
    hasBuildLog,
    openBuildLog(build) { this.$refs.buildLogDialog.open(build); },
    ...mapGetters({ getByUdid: 'devices/getByUdid', getBuildItems: 'buildlog/getItems', getTransformers: 'transformers/getItems', getRepositories: 'repositories/getItems', getApikeys: 'apikeys/getItems', getChannels: 'channels/getItems' }),
    ...mapActions({
      loadDevices: 'devices/loadDevices',
      revokeDevices: 'devices/revokeDevices',
      buildFirmware: 'devices/buildFirmware',
      updateDevice: 'devices/updateDevice',
      fetchBuildLog: 'buildlog/fetchBuildLog',
      fetchTransformers: 'transformers/fetchItems',
      createTransformerItem: 'transformers/createItem',
      fetchRepositories: 'repositories/fetchItems',
      transferDevices: 'devices/transferDevices',
      fetchDeviceDetail: 'devices/fetchDeviceDetail',
      fetchApikeys: 'apikeys/fetchItems',
      fetchChannels: 'channels/fetchItems',
      attachSource: 'devices/attachSource',
      detachSource: 'devices/detachSource',
      attachMesh: 'devices/attachMesh',
      detachMesh: 'devices/detachMesh',
    }),
    iconSrc(raw) { return deviceSymbol(raw); },
    // A re-read never overwrites a draft the user changed that the triggering save did not write
    // (CR-01): each save first applies what it wrote to a copy of the device, so only the other
    // cards' unsaved alias, description or ticks differ from the device on screen and are kept.
    // The list is read through the throwing loader: when it fails after a stored write, the device
    // on screen (with the written values) stays instead of the stale store item (WR-05).
    async loadDevice() {
      this.loading = true;
      const udid = this.$route.params.udid;
      const results = await Promise.allSettled([this.loadDevices(), this.fetchBuildLog(), this.fetchTransformers(), this.fetchRepositories(), this.fetchApikeys(), this.fetchChannels()]);
      if (results.some(result => result.status === 'rejected')) this.error = 'Some device details could not be loaded. Refresh to retry.';
      const before = this.device;
      const keepAlias = !!before && this.editForm.alias !== before.alias;
      const keepDescription = !!before && (this.editForm.description || '') !== (before.description || '');
      const keepTransformers = !!before && this.transformersDirty;
      const keepTags = !!before && this.tagsDirty;
      const keepTimezone = !!before && this.timezoneDirty;
      if (results[0].status === 'rejected' && before) this.device = before;
      else this.device = this.getByUdid()(udid) || null;
      if (this.device) {
        if (!keepAlias) this.editForm.alias = this.device.alias;
        if (!keepDescription) this.editForm.description = this.device.description || '';
        if (!keepTransformers) this.editForm.transformers = [...(this.device.transformers || [])];
        // Saved on toggle, so there is never an unsaved draft to keep. Only a stored `true`
        // is on: the API's auto-update checks are truthy/=== true, and a missing field is off.
        this.editForm.auto_update = this.device.auto_update === true;
        // Selects, the icon and the mesh ticks save on change, so they always mirror the device;
        // tags and the timezone have a Save button and keep an unsaved draft like alias does.
        this.syncSettings();
        if (!keepTags) this.editForm.tags = cleanTags(this.device.tags);
        if (!keepTimezone) this.editForm.timezone_utc = this.device.timezone_utc || '';
        const allBuilds = this.getBuildItems() || [];
        this.buildHistory = allBuilds.filter(b => b.udid === udid);
      }
      this.loading = false;
    },
    async saveField(field) {
      const value = this.editForm[field];
      const result = await this.updateDevice({
        udid: this.device.udid,
        changes: { [field]: value },
      });
      if (result.success) {
        // A copy: this.device is the store's own item and must not be mutated in place.
        this.device = Object.assign({}, this.device, { [field]: value });
        this.message = 'Saved.';
        await this.loadDevice();
      } else {
        this.error = result.message || 'Failed to save.';
      }
    },
    // The switch's user change event (not a watcher, so loadDevice() setting it is not a save).
    // A failed save puts the switch back to the stored value.
    async saveAutoUpdate(value) {
      if (this.autoUpdateSaving) return;
      const enabled = value === true;
      this.autoUpdateSaving = true;
      let result = null;
      try {
        result = await this.updateDevice({ udid: this.device.udid, changes: { auto_update: enabled } });
      } catch (e) {
        result = null;
      }
      if (result && result.success) {
        this.device = Object.assign({}, this.device, { auto_update: enabled });
        this.message = enabled ? 'Auto Update enabled.' : 'Auto Update disabled.';
        this.autoUpdateSaving = false;
        await this.loadDevice();
      } else {
        this.editForm.auto_update = this.device.auto_update === true;
        this.error = (result && result.message) || 'Could not save Auto Update.';
        this.autoUpdateSaving = false;
      }
    },
    // The save-on-change settings back to what the device stores (after a refused write).
    syncSettings() {
      if (!this.device) return;
      this.editForm.keyhash = this.device.keyhash || null;
      this.editForm.source = this.device.source || null;
      this.editForm.icon = iconNumber(this.device.icon) || 1;
      this.editForm.category = normalizeCategory(this.device.category);
      this.editForm.mesh_ids = Array.isArray(this.device.mesh_ids) ? [...this.device.mesh_ids] : [];
    },
    // One PUT /device for a Device Settings field (API key, icon, category, tags, timezone).
    // A refused write puts the controls back to the stored values.
    async saveSetting(changes, okMessage) {
      if (this.settingsSaving || !this.device) return false;
      this.settingsSaving = true;
      let result = null;
      try {
        result = await this.updateDevice({ udid: this.device.udid, changes });
      } catch (e) {
        result = null;
      }
      this.settingsSaving = false;
      if (result && result.success) {
        this.device = Object.assign({}, this.device, changes);
        this.message = okMessage;
        await this.loadDevice();
        return true;
      }
      this.syncSettings();
      this.error = (result && typeof result.message === 'string' && result.message) || 'Could not save the device settings.';
      return false;
    },
    async pickIcon(n) {
      if (iconNumber(n) === null) return;
      if (n === iconNumber(this.device.icon)) { this.showIcons = false; return; }
      this.editForm.icon = n;
      if (await this.saveSetting({ icon: n }, 'Icon saved.')) this.showIcons = false;
    },
    async saveTags() {
      await this.saveSetting({ tags: cleanTags(this.editForm.tags) }, 'Tags saved.');
    },
    async saveTimezone() {
      const zone = (this.editForm.timezone_utc || '').trim();
      const abbr = timezoneAbbr(zone);
      if (!zone || abbr === null) {
        this.error = 'Choose a timezone from the list, for example Europe/Prague.';
        return;
      }
      await this.saveSetting({ timezone_utc: zone, timezone_abbr: abbr }, 'Timezone saved.');
    },
    // Source select: a repository attaches it (PUT /source/attach), "No source" detaches.
    async changeSource(value) {
      if (this.sourceSaving || !this.device) return;
      const sourceId = value || null;
      if (sourceId === (this.device.source || null)) return;
      this.sourceSaving = true;
      let result = null;
      try {
        result = sourceId
          ? await this.attachSource({ udid: this.device.udid, source_id: sourceId })
          : await this.detachSource({ udid: this.device.udid });
      } catch (e) {
        result = null;
      }
      this.sourceSaving = false;
      if (result && result.success) {
        this.device = Object.assign({}, this.device, { source: sourceId });
        this.message = sourceId ? 'Repository attached.' : 'Repository detached.';
        await this.loadDevice();
      } else {
        this.syncSettings();
        this.error = sourceId ? 'Could not attach the repository.' : 'Could not detach the repository.';
      }
    },
    // Mesh ticks: each newly ticked channel is attached, each unticked one detached
    // (PUT /mesh/attach, /mesh/detach), one request at a time.
    async changeMesh(selected) {
      if (this.meshSaving || !this.device) return;
      const stored = Array.isArray(this.device.mesh_ids) ? this.device.mesh_ids : [];
      const wanted = Array.isArray(selected) ? selected : [];
      const add = wanted.filter(id => !stored.includes(id));
      const remove = stored.filter(id => !wanted.includes(id));
      if (!add.length && !remove.length) return;
      this.meshSaving = true;
      const now = new Set(stored);
      let failed = 0;
      const run = async (action, mesh_id) => {
        try {
          const result = await action({ udid: this.device.udid, mesh_id });
          return !!(result && result.success);
        } catch (e) {
          return false;
        }
      };
      for (const mesh_id of add) {
        if (await run(this.attachMesh, mesh_id)) now.add(mesh_id); else failed++;
      }
      for (const mesh_id of remove) {
        if (await run(this.detachMesh, mesh_id)) now.delete(mesh_id); else failed++;
      }
      this.meshSaving = false;
      this.device = Object.assign({}, this.device, { mesh_ids: [...now] });
      if (failed) this.error = 'Could not update ' + failed + ' mesh channel(s).';
      else this.message = 'Mesh channels saved.';
      await this.loadDevice();
    },
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        this.message = 'Copied to clipboard.';
      } catch (e) {
        this.error = 'Could not copy. Select the text and copy it manually.';
      }
    },
    // One POST /build per click (D-17, UI-C05): a second click, a double click or a key repeat
    // while the request is in flight returns at once. The flag is reset however the request
    // settles; the build itself is not tracked. A button that had focus gets it back, because
    // the disabled button drops focus to the body; a mouse user's focus is never moved.
    async buildDevice() {
      if (this.buildPending) return;
      const ref = this.$refs.buildButton;
      const button = ref && ref.$el ? ref.$el : ref;
      const hadFocus = !!button && typeof document !== 'undefined' && document.activeElement === button;
      this.message = null;
      this.error = null;
      this.buildPending = true;
      let result;
      try {
        result = await this.buildFirmware({ udid: this.device.udid, source_id: this.device.source });
      } catch (e) {
        result = { success: false };
      } finally {
        this.buildPending = false;
      }
      if (result && result.success) this.message = 'Build triggered.';
      else this.error = this.buildFailure(result);
      if (hadFocus) {
        this.$nextTick(() => {
          if (typeof button.focus === 'function') button.focus();
        });
      }
    },
    // The API answers a failed /build with { success: false, response: <reason> }; the reason
    // is shown as text when it is a non-blank string, else Build failed. (44 IN-01).
    buildFailure(result) {
      const text = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);
      return (result && (text(result.message) || text(result.response))) || 'Build failed.';
    },
    async revokeDevice() {
      const confirmed = await this.$bvModal.msgBoxConfirm('Revoke this device? This cannot be undone.', {
        title: 'Confirm Revoke', okVariant: 'danger', okTitle: 'Revoke',
      });
      if (!confirmed) return;
      const result = await this.revokeDevices([this.device.udid]);
      if (result.success) {
        this.$router.push('/app/devices');
      } else {
        this.error = result.message || 'Failed to revoke device.';
      }
    },
    // Actions-card entry point: an open draft is never reloaded (that would drop
    // unsaved edits); either way the editor is scrolled into view and focused.
    async openEnvironmentEditor() {
      if (!this.envEditing) await this.editEnvironment();
      if (this.envEditing) this.focusEnvironmentDraft();
    },
    focusEnvironmentDraft() {
      this.$nextTick(() => {
        const el = this.$el && typeof this.$el.querySelector === 'function' ? this.$el.querySelector('[data-cy=env-draft]') : null;
        if (!el) return;
        if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
        if (typeof el.focus === 'function') el.focus();
      });
    },
    async editEnvironment() {
      // Re-fetching would overwrite envDraft with the stored JSON.
      if (this.envEditing || this.envLoading) return;
      this.envLoading = true;
      this.envLoadError = null;
      this.error = null;

      const detail = await this.fetchDeviceDetail({ udid: this.device.udid });

      // getDeviceDetail answers with the device document itself; an error comes
      // back as a { success: false } envelope instead. Opening the editor on a
      // failed read would show an empty object and saving it would wipe the
      // stored environment, so bail out loudly instead.
      if (!detail || typeof detail !== 'object' || detail.success === false || !detail.udid) {
        this.envLoading = false;
        this.error = 'Could not load the stored environment.';
        return;
      }

      const stored = detail.environment || {};

      if (typeof stored !== 'object' || Array.isArray(stored)) {
        this.envLoadError = 'Stored environment is not a JSON object.';
      }

      this.envDraft = JSON.stringify(stored, null, 2);
      this.envLoadedCount = Object.keys(stored).length;
      this.envConfirmClear = false;
      this.envEditing = true;
      this.envLoading = false;
    },
    cancelEnvironmentEdit() {
      this.envEditing = false;
      this.envDraft = '';
      this.envLoadError = null;
      this.envConfirmClear = false;
    },
    async saveEnvironment() {
      const parsed = parseEnvironmentJSON(this.envDraft);
      if (!parsed.ok) return;

      if (!Object.keys(parsed.value).length && this.envLoadedCount > 0 && !this.envConfirmClear) {
        this.envConfirmClear = true;
        return;
      }

      const result = await this.updateDevice({
        udid: this.device.udid,
        changes: { environment: parsed.value },
      });

      if (result.success) {
        this.message = 'Environment saved.';
        this.envEditing = false;
        this.envDraft = '';
        this.envConfirmClear = false;
        await this.loadDevice();
      } else {
        this.error = result.message || 'Failed to save the environment.';
      }
    },
    async createTransformer(event) {
      event.preventDefault();
      if (this.transformerSaving) return;
      this.transformerError = null;
      const alias = this.transformerForm.alias.trim();
      if (!alias) { this.transformerError = 'Enter a transformer name.'; return; }
      if ((this.getTransformers() || []).some(t => t.alias === alias)) {
        this.transformerError = 'A transformer with this name already exists.';
        return;
      }
      this.transformerSaving = true;
      try {
        const created = await this.createTransformerItem({ alias, body: this.transformerForm.body });
        if (!created || !created.success) throw new Error('Could not create transformer.');
        // Assign from the device's stored transformers, not from the checkboxes:
        // an unsaved checkbox change must not be written as a side effect.
        const stored = Array.isArray(this.device.transformers) ? this.device.transformers : [];
        const selected = [...new Set([...stored, created.utid])];
        const pending = [...new Set([...(this.editForm.transformers || []), created.utid])];
        const saved = await this.updateDevice({ udid: this.device.udid, changes: { transformers: selected } });
        if (!saved || !saved.success) {
          this.transformerError = 'Transformer created, but assignment failed. Tick it in the list and save to retry.';
          return;
        }
        this.$bvModal.hide('device-transformer-modal');
        this.transformerForm.alias = '';
        this.device = Object.assign({}, this.device, { transformers: selected });
        this.message = 'Transformer created and assigned.';
        await this.loadDevice();
        // loadDevice resets the checkboxes to the stored list; restore the user's unsaved
        // checkbox state (plus the new transformer) so it can still be saved or discarded.
        if (this.device) this.editForm.transformers = pending;
      } catch (e) {
        this.transformerError = e.message || 'Could not create transformer.';
      } finally {
        this.transformerSaving = false;
      }
    },
    // The checkbox group's user change event, not a watcher: loadDevice() reassigns the array
    // after a save, and that must not wipe the "Transformers saved." it just set.
    onTransformersTicked() {
      this.transformersMessage = null;
      this.transformersError = null;
    },
    async saveTransformers() {
      if (this.transformersSaving) return;
      this.transformersSaving = true;
      this.transformersMessage = null;
      this.transformersError = null;
      try {
        const sent = [...(this.editForm.transformers || [])];
        let result = null;
        try {
          result = await this.updateDevice({
            udid: this.device.udid,
            changes: { transformers: sent },
          });
        } catch (e) {
          result = null;
        }
        if (!result || !result.success) {
          // The ticks stay as they are, so the dirty note stays and a retry sends them again.
          this.transformersError = 'Could not save the transformers. Try again.';
          return;
        }
        // The stored list is what was sent, even if the re-read below fails (WR-05).
        this.device = Object.assign({}, this.device, { transformers: [...sent] });
        // Set before the reload: the write is stored even if the reload reports a problem.
        this.transformersMessage = 'Transformers saved.';
        await this.loadDevice();
      } finally {
        this.transformersSaving = false;
      }
    },
    async transferDevice(bvModalEvt) {
      bvModalEvt.preventDefault();
      if (!this.transferForm.to.trim()) return;
      const result = await this.transferDevices({
        udids: [this.device.udid],
        to: this.transferForm.to.trim(),
        mig_sources: this.transferForm.mig_sources,
        mig_apikeys: this.transferForm.mig_apikeys,
      });
      this.$bvModal.hide('transfer-modal');
      if (result.success) {
        this.$router.push('/app/devices');
      } else {
        this.error = result.message || 'Failed to transfer device.';
      }
    },
  },
};
</script>
