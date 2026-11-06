// Unit test for the Device Detail settings that mirror the Legacy device view
// (services/console/src/app/views/device.html): Auto Update, API key, source, icon,
// category, tags, timezone, mesh channels and the MQTT channel.
//
// Plain node, offline, no browser: npm run test:unit

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const compiler = require('vue-template-compiler');
const Vue = require('vue/dist/vue.runtime.common.js');
const deviceDetailDeps = require('./device-detail-deps.cjs');

Vue.config.productionTip = false;
Vue.config.devtools = false;
Vue.config.ignoredElements = [/^b-/];

const SRC = path.join(__dirname, '..', '..', 'src');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

let failures = 0;
const asyncChecks = [];
function check(name, fn) {
  try { fn(); console.log('ok   ' + name); } catch (err) { failures++; console.log('FAIL ' + name + ' (' + String(err && err.message).split('\n')[0] + ')'); }
}
function checkAsync(name, fn) { asyncChecks.push([name, fn]); }

const S = deviceDetailDeps();

// DeviceDetail.vue's component definition, imports replaced by stand-ins.
function loadDeviceDetail() {
  const sfc = compiler.parseComponent(read('pages/Devices/DeviceDetail.vue'));
  assert.deepEqual(compiler.compile(sfc.template.content).errors, [], 'template compiles');
  const code = sfc.script.content.replace(/^import .*;?$/gm, '').replace(/export default /, 'module.exports.default = ');
  const deps = Object.assign({
    mapGetters: () => ({}), mapActions: () => ({}), BuildLogDialog: {}, moment: () => ({ fromNow: () => '' }),
    parseEnvironmentJSON: () => ({ ok: true }), buildStatusVariant: () => 'secondary', hasBuildLog: () => false,
    confirmLeave: async () => true,
  }, S);
  const mod = { exports: {} };
  new Function('module', ...Object.keys(deps), code)(mod, ...Object.values(deps));
  return { def: mod.exports.default, template: sfc.template.content };
}
const page = loadDeviceDetail();

// A plain vm: data + computed as getters + methods, with overrides.
function vmFor(device, overrides = {}) {
  const vm = Object.assign(page.def.data.call({}), { device, $route: { params: { udid: device.udid } } });
  for (const [name, fn] of Object.entries(page.def.computed)) Object.defineProperty(vm, name, { get: () => fn.call(vm), configurable: true });
  for (const [name, fn] of Object.entries(page.def.methods)) vm[name] = fn.bind(vm);
  Object.assign(vm, { getApikeys: () => [], getChannels: () => [], getRepositories: () => [], getTransformers: () => [], loadDevice: async () => { vm.loads = (vm.loads || 0) + 1; } }, overrides);
  return vm;
}

// ---------------------------------------------------------------- utils

check('iconNumber accepts 1..73 numbers and "NN" strings, nothing else', () => {
  assert.equal(S.iconNumber(7), 7);
  assert.equal(S.iconNumber('07'), 7);
  assert.equal(S.iconNumber(73), 73);
  for (const bad of [0, 74, -1, 'x', null, undefined, {}, [], 1.5]) assert.equal(S.iconNumber(bad), bad === 1.5 ? 1 : null, String(bad));
  assert.equal(S.iconFileNumber(null), '01');
  assert.equal(S.iconFileNumber(9), '09');
});

check('normalizeCategory keeps the Legacy categories and falls back to grey-mint', () => {
  assert.equal(S.normalizeCategory('blue'), 'blue');
  assert.equal(S.normalizeCategory('pink'), 'grey-mint');
  assert.equal(S.normalizeCategory(undefined), 'grey-mint');
  assert.equal(S.CATEGORIES.length, 7);
});

check('timezoneAbbr / timeInZone know IANA zones and reject the rest', () => {
  const at = new Date(Date.UTC(2026, 0, 15, 12, 5));
  assert.equal(S.timezoneAbbr('UTC', at), 'UTC');
  assert.ok(S.timezoneAbbr('Europe/Prague', at), 'Prague has a short name');
  assert.equal(S.timezoneAbbr('Mars/Olympus', at), null);
  assert.equal(S.timezoneAbbr('', at), null);
  assert.equal(S.timezoneAbbr(42, at), null);
  assert.equal(S.timeInZone('Europe/Prague', at), '15. 1. 13:05');
  assert.equal(S.timeInZone('nope', at), null);
});

check('cleanTags trims, drops empties, non-strings and duplicates; sameSet ignores order', () => {
  assert.deepEqual(S.cleanTags([' a', 'b', '', 'a', 3, null, 'c ']), ['a', 'b', 'c']);
  assert.deepEqual(S.cleanTags('a'), []);
  assert.ok(S.sameSet(['a', 'b'], ['b', 'a']));
  assert.ok(!S.sameSet(['a'], ['a', 'b']));
  assert.ok(S.sameSet(undefined, []));
});

// ---------------------------------------------------------------- template

check('template: Auto Update switch is gated on buildSupported and saves on change', () => {
  const t = page.template;
  assert.match(t, /<b-form-group\s+v-if="buildSupported"\s+label="Auto Update"/);
  assert.match(t, /<b-form-checkbox[^>]*v-model="editForm.auto_update"[^>]*\bswitch\b[^>]*@change="saveAutoUpdate"/s);
});

check('template: Device Settings card has API key, source, icon, category, tags, timezone and mesh controls', () => {
  const card = page.template.slice(page.template.indexOf('data-cy="card-device-settings"'));
  for (const cy of ['apikey-select', 'source-select', 'device-icon-toggle', 'category-select', 'tags-input', 'tags-save', 'timezone-input', 'timezone-save', 'manage-channels']) {
    assert.ok(card.includes('data-cy="' + cy + '"'), cy);
  }
  assert.ok(page.template.includes('data-cy="mqtt-channel"'), 'mqtt channel');
  assert.ok(page.template.includes('data-cy="transformer-error"'), 'transformer error');
});

// ---------------------------------------------------------------- computed

check('buildSupported follows the platform build flag (Sigfox is vendor firmware)', () => {
  assert.equal(vmFor({ udid: 'u', platform: 'arduino:esp8266' }).buildSupported, true);
  assert.equal(vmFor({ udid: 'u', platform: 'sigfox' }).buildSupported, false);
  assert.equal(vmFor({ udid: 'u', platform: 'sigfox' }).isSigfox, true);
});

check('mqttChannel is /owner/udid as in Legacy', () => {
  assert.equal(vmFor({ udid: 'dev1', owner: 'own1' }).mqttChannel, '/own1/dev1');
});

check('apikeyOptions lists keys by alias and hash prefix, plus a missing stored key', () => {
  const vm = vmFor({ udid: 'u', keyhash: 'deadbeefcafe' }, { getApikeys: () => [{ alias: 'k1', hash: 'abcdef123456' }, { alias: 'nohash' }] });
  assert.deepEqual(vm.apikeyOptions.map(o => o.value), [null, 'abcdef123456', 'deadbeefcafe']);
  assert.equal(vm.apikeyOptions[1].text, 'k1 (abcdef)');
  assert.match(vm.apikeyOptions[2].text, /^\(missing key\)/);
});

check('meshOptions lists channels and keeps attached ids with no channel', () => {
  const vm = vmFor({ udid: 'u', mesh_ids: ['m1', 'gone'] }, { getChannels: () => [{ mesh_id: 'm1', alias: 'One' }, { mesh_id: 'm2' }] });
  assert.deepEqual(vm.meshOptions, [{ value: 'm1', text: 'One' }, { value: 'm2', text: 'm2' }, { value: 'gone', text: '(missing) gone' }]);
});

check('tagsDirty / timezoneDirty compare the drafts with the stored device', () => {
  const vm = vmFor({ udid: 'u', tags: ['a', 'b'], timezone_utc: 'Europe/Prague' });
  vm.editForm.tags = ['b', 'a']; vm.editForm.timezone_utc = 'Europe/Prague';
  assert.equal(vm.tagsDirty, false); assert.equal(vm.timezoneDirty, false);
  vm.editForm.tags = ['a']; vm.editForm.timezone_utc = 'UTC';
  assert.equal(vm.tagsDirty, true); assert.equal(vm.timezoneDirty, true);
});

// ---------------------------------------------------------------- methods

checkAsync('saveAutoUpdate sends a boolean, reloads on success and reverts the switch on failure', async () => {
  const sent = [];
  const vm = vmFor({ udid: 'u', auto_update: false }, { updateDevice: async (p) => { sent.push(p); return { success: true }; } });
  vm.editForm.auto_update = true;
  await vm.saveAutoUpdate(true);
  assert.deepEqual(sent, [{ udid: 'u', changes: { auto_update: true } }]);
  assert.equal(vm.device.auto_update, true);
  assert.equal(vm.loads, 1);
  assert.equal(vm.autoUpdateSaving, false);

  const bad = vmFor({ udid: 'u', auto_update: true }, { updateDevice: async () => ({ success: false, message: 'nope' }) });
  bad.editForm.auto_update = false;
  await bad.saveAutoUpdate(false);
  assert.equal(bad.editForm.auto_update, true, 'switch back to stored');
  assert.equal(bad.error, 'nope');
  assert.equal(bad.autoUpdateSaving, false);
});

checkAsync('saveSetting writes the change, and a refused write resets the selects to the stored values', async () => {
  const vm = vmFor({ udid: 'u', category: 'blue', keyhash: 'k1' }, { updateDevice: async () => ({ success: false }) });
  vm.syncSettings();
  vm.editForm.category = 'green';
  vm.editForm.keyhash = null;
  const ok = await vm.saveSetting({ category: 'green' }, 'Category saved.');
  assert.equal(ok, false);
  assert.equal(vm.editForm.category, 'blue');
  assert.equal(vm.editForm.keyhash, 'k1');
  assert.equal(vm.error, 'Could not save the device settings.');
  assert.equal(vm.settingsSaving, false);

  const sent = [];
  const good = vmFor({ udid: 'u', category: 'blue' }, { updateDevice: async (p) => { sent.push(p); return { success: true }; } });
  assert.equal(await good.saveSetting({ category: 'green' }, 'Category saved.'), true);
  assert.deepEqual(sent, [{ udid: 'u', changes: { category: 'green' } }]);
  assert.equal(good.device.category, 'green');
  assert.equal(good.message, 'Category saved.');
});

checkAsync('saveTimezone refuses an unknown zone and sends timezone_utc with its abbreviation', async () => {
  const sent = [];
  const vm = vmFor({ udid: 'u' }, { updateDevice: async (p) => { sent.push(p); return { success: true }; } });
  vm.editForm.timezone_utc = 'Mars/Olympus';
  await vm.saveTimezone();
  assert.equal(sent.length, 0);
  assert.match(vm.error, /Choose a timezone/);
  vm.editForm.timezone_utc = ' UTC ';
  await vm.saveTimezone();
  assert.deepEqual(sent, [{ udid: 'u', changes: { timezone_utc: 'UTC', timezone_abbr: 'UTC' } }]);
});

checkAsync('saveTags sends the cleaned list', async () => {
  const sent = [];
  const vm = vmFor({ udid: 'u', tags: [] }, { updateDevice: async (p) => { sent.push(p); return { success: true }; } });
  vm.editForm.tags = [' a ', 'a', 'b'];
  await vm.saveTags();
  assert.deepEqual(sent[0].changes, { tags: ['a', 'b'] });
});

checkAsync('pickIcon saves a new icon and closes the picker; the same icon only closes it', async () => {
  const sent = [];
  const vm = vmFor({ udid: 'u', icon: 3 }, { updateDevice: async (p) => { sent.push(p); return { success: true }; } });
  vm.showIcons = true;
  await vm.pickIcon(3);
  assert.equal(sent.length, 0); assert.equal(vm.showIcons, false);
  vm.showIcons = true;
  await vm.pickIcon(12);
  assert.deepEqual(sent[0].changes, { icon: 12 }); assert.equal(vm.showIcons, false);
  await vm.pickIcon(999);
  assert.equal(sent.length, 1, 'out-of-range icon is ignored');
});

checkAsync('changeSource attaches a repository, detaches on "No source" and reverts on failure', async () => {
  const calls = [];
  const vm = vmFor({ udid: 'u', platform: 'arduino', source: null }, {
    attachSource: async (p) => { calls.push(['attach', p]); return { success: true }; },
    detachSource: async (p) => { calls.push(['detach', p]); return { success: true }; },
  });
  await vm.changeSource('src1');
  assert.deepEqual(calls[0], ['attach', { udid: 'u', source_id: 'src1' }]);
  assert.equal(vm.device.source, 'src1');
  await vm.changeSource(null);
  assert.deepEqual(calls[1], ['detach', { udid: 'u' }]);
  assert.equal(vm.device.source, null);

  const bad = vmFor({ udid: 'u', source: 'src1' }, { attachSource: async () => ({ success: false }) });
  bad.editForm.source = 'src2';
  await bad.changeSource('src2');
  assert.equal(bad.editForm.source, 'src1');
  assert.equal(bad.error, 'Could not attach the repository.');
  assert.equal(bad.sourceSaving, false);
});

checkAsync('changeMesh attaches ticked and detaches unticked channels and counts failures', async () => {
  const calls = [];
  const vm = vmFor({ udid: 'u', mesh_ids: ['m1', 'm2'] }, {
    attachMesh: async (p) => { calls.push(['attach', p.mesh_id]); return { success: p.mesh_id !== 'bad' }; },
    detachMesh: async (p) => { calls.push(['detach', p.mesh_id]); return { success: true }; },
  });
  await vm.changeMesh(['m1', 'm3', 'bad']);
  assert.deepEqual(calls, [['attach', 'm3'], ['attach', 'bad'], ['detach', 'm2']]);
  assert.deepEqual(vm.device.mesh_ids.sort(), ['m1', 'm3']);
  assert.equal(vm.error, 'Could not update 1 mesh channel(s).');
  assert.equal(vm.meshSaving, false);
});

(async () => {
  for (const [name, fn] of asyncChecks) {
    try { await fn(); console.log('ok   ' + name); } catch (err) { failures++; console.log('FAIL ' + name + ' (' + String(err && err.message).split('\n')[0] + ')'); }
  }
  if (failures) { console.log('device-settings: ' + failures + ' failure(s)'); process.exit(1); }
  console.log('device-settings: all ok');
})();
