// Shared stand-ins for DeviceDetail.vue's imports, for the unit tests that evaluate its script
// with the import lines stripped (milestone-v116, close-out-v118, audit-gaps-v118,
// build-log-search, transformers-enviros). The real src/utils/deviceSettings.js and
// src/utils/platforms.js are evaluated here; require.context (webpack only) is faked so the
// icon resolves to 'sym:b_medium_NN.png'.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');

function evalModule(rel) {
  const source = fs.readFileSync(path.join(SRC, rel), 'utf8');
  const names = [];
  const code = source
    .replace(/^import .*;?$/gm, '')
    .replace(/^export (const|function|let) (\w+)/gm, (m, kind, name) => { names.push(name); return kind + ' ' + name; });
  return new Function(code + '\nreturn {' + names.join(', ') + '};')();
}

let cached = null;
module.exports = function deviceDetailDeps() {
  if (!cached) {
    cached = Object.assign(
      {},
      evalModule('utils/deviceSettings.js'),
      { platformInfo: evalModule('utils/platforms.js').platformInfo },
      { require: { context: () => (p) => 'sym:' + String(p).replace(/^\.\//, '') } },
    );
  }
  return cached;
};
