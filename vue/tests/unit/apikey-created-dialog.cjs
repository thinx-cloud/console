// Unit test for the one-time "copy your new API key" dialog (quick 261004-22d).
//
// POST /api/v2/apikey answers { success: true, response: { api_key, hash } }
// (lib/router.apikey.js setAPIKey). Apikeys.vue used to read result.response.key,
// which the server never sends, so createdKey stayed null and the dialog that
// shows the key exactly once never opened.
//
// This evaluates the real SFC's script with its imports stubbed and drives
// create() with a fake component instance. Plain node, no build: npm run test:unit

const fs = require('fs');
const path = require('path');
const compiler = require('vue-template-compiler');

const SFC = path.join(__dirname, '..', '..', 'src', 'pages', 'Apikeys', 'Apikeys.vue');
const script = compiler.parseComponent(fs.readFileSync(SFC, 'utf8')).script.content;

const body = script
  .replace(/^import\s+List\s+from\s+['"][^'"]+['"];?\s*$/m, 'const List = {};')
  .replace(/^import\s+\{\s*mapGetters,\s*mapActions\s*\}\s+from\s+['"]vuex['"];?\s*$/m,
    'const mapGetters = () => ({}); const mapActions = () => ({});')
  .replace(/export\s+default\s+/, 'module.exports = ');

const mod = { exports: {} };
new Function('module', 'exports', body)(mod, mod.exports);
const component = mod.exports;

let failures = 0;
function check(name, ok) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures++;
}

function instance(result) {
  const shown = [];
  const hidden = [];
  const vm = Object.assign(component.data(), {
    form: { alias: 'my key' },
    createItem: async () => result,
    loadData: () => {},
    $bvModal: { show: (id) => shown.push(id), hide: (id) => hidden.push(id) },
  });
  return { vm, shown, hidden };
}

const evt = { preventDefault() {} };
const KEY = 'k'.repeat(64); // fixture, not a real key

(async () => {
  {
    const { vm, shown } = instance({ success: true, response: { api_key: KEY, hash: 'h'.repeat(64) } });
    await component.methods.create.call(vm, evt);
    check('server shape {api_key, hash}: createdKey is the new key', vm.createdKey === KEY);
    check('server shape {api_key, hash}: result dialog opens', shown.includes('apikey-result-modal'));
    check('alias field is cleared', vm.form.alias === '');
  }
  {
    const { vm, shown } = instance({ success: true, response: { hash: 'h'.repeat(64) } });
    await component.methods.create.call(vm, evt);
    check('no key in response: no dialog', vm.createdKey === null && !shown.includes('apikey-result-modal'));
  }
  {
    const { vm, shown } = instance({ success: false, message: 'set_api_key_failed' });
    await component.methods.create.call(vm, evt);
    check('failure: error shown, no dialog', vm.error === 'set_api_key_failed' && !shown.includes('apikey-result-modal'));
  }
  if (failures) {
    console.log(`${failures} FAIL`);
    process.exit(1);
  }
  console.log('apikey-created-dialog: all ok');
})();
