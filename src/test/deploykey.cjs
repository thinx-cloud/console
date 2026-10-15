// Legacy deploy-key create (DeploykeyController.js), v1.18 Phase 48 D-09, UI-C18, 35 IN-03/IN-04/IN-08.
// Plain node, no build: `node test/deploykey.cjs` from src/, or `node ../src/test/deploykey.cjs` from vue/.
// Runs the real controller in a vm sandbox with stub angular, $, toastr and Thinx. Prints `ok   <name>` or
// `FAIL <name>` per case and exits non-zero on any FAIL.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../app/js/controllers/DeploykeyController.js'), 'utf8');
const keyNamesSource = fs.readFileSync(path.join(__dirname, '../../vue/src/utils/keyNames.js'), 'utf8');

const CREATE_FAILED = 'Could not generate the deploy key. Try again.';
const FALLBACK = 'This name is not allowed. Choose a different name.';
const SENTENCES = {
  empty: 'Enter a name for the key.',
  too_long: 'The name is longer than 120 characters.',
  control_chars: 'The name contains a control character, such as a tab or a line break.',
  line_separator: 'The name contains a hidden line or paragraph separator.',
  bidi: 'The name contains a hidden direction-override character.',
  invisible: 'The name contains an invisible character, such as a zero-width space.',
  reserved: 'This name is reserved for the key\'s default label. Choose a different name.',
};
const ALLOWED = new Set(['Key created.', CREATE_FAILED, FALLBACK, ...Object.values(SENTENCES)]);
const FORBIDDEN = ['invalid_key_name', 'key_failed', 'ssh-rsa', 'Firmware', 'Fire', '[object Object]', 'undefined'];

// Every toast body and every .text() value from every scenario, for D9.
const seen = [];

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (error) {
    failures++;
    const message = error && error.message ? String(error.message).split('\n')[0] : String(error);
    console.log('FAIL ' + name + ' (' + message + ')');
  }
}

// One create attempt. `response` goes to .done, `failWith` (a jqXHR stand-in) to .fail instead.
// A throw from a .done callback propagates and skips .always, as with jQuery's unwrapped callbacks.
function scenario({ response, failWith, name = ' Firmware ', throwInSuccess = false } = {}) {
  let controller, sentName, calls = 0, refreshed = 0, digests = 0, threw = null;
  const emitted = [], texts = [], shows = [];
  const toasts = { success: [], error: [], warning: [] };
  const $ = selector => ({
    text(value) { texts.push({ selector, value }); seen.push(value); return this; },
    show() { shows.push(selector); return this; },
  });
  const toastr = {
    success(message) { toasts.success.push(message); seen.push(message); if (throwInSuccess) throw new Error('toast failed'); },
    error(message, title, options) { toasts.error.push({ message, title, options }); seen.push(message); },
    warning(message) { toasts.warning.push(message); seen.push(message); },
  };
  const context = {
    angular: { module: () => ({ controller: (n, arr) => { controller = arr[arr.length - 1]; } }) },
    console: { log() {} },
    $,
    toastr,
    Thinx: {
      createDeploykey: n => {
        sentName = n;
        calls++;
        return {
          done(fn) { if (!failWith) fn(response); return this; },
          fail(fn) { if (failWith) fn(failWith); return this; },
          always(fn) { fn(); return this; },
        };
      },
      deploykeyList: () => {
        refreshed++;
        return { done(fn) { fn({ success: true, response: [] }); return this; }, fail() { return this; } };
      },
    },
  };
  vm.runInNewContext(source, context);
  const scope = { $on() {}, $emit: (...args) => emitted.push(args), $applyAsync: () => digests++ };
  controller({}, scope, {});
  scope.resetModal();
  scope.deploykeyName = name;
  try { scope.createDeploykey(); } catch (error) { threw = error; }
  const warnings = texts.filter(t => t.selector === '.msg-warning').map(t => t.value);
  return { scope, sentName, calls, refreshed, digests, emitted, texts, warnings, shows, toasts, threw };
}

// One readable failure: the sentence once in the warning text and once as the error toast, no refresh.
function assertShown(r, sentence) {
  assert.equal(r.threw, null, 'no throw');
  assert.deepEqual(r.warnings, [sentence], 'warning text');
  assert.ok(r.shows.includes('.msg-warning'), 'warning shown');
  assert.deepEqual(r.toasts.error.map(t => t.message), [sentence], 'error toast');
  assert.equal(r.toasts.success.length, 0, 'no success toast');
  assert.equal(r.refreshed, 0, 'no list refresh');
  assert.equal(r.scope.creatingDeploykey, false, 'creatingDeploykey reset');
}

const SUCCESS = { success: true, response: { name: 'Firmware', date: '2026-10-09', pubkey: 'ssh-rsa x' } };

check('D1 success: trimmed name, pubkey, date, one toast, one refresh, reset', () => {
  const r = scenario({ response: SUCCESS });
  assert.equal(r.threw, null);
  assert.equal(r.sentName, 'Firmware');
  assert.equal(r.scope.deploykeyValue, 'ssh-rsa x');
  assert.equal(r.scope.deploykeyCreated, '2026-10-09');
  assert.deepEqual(r.toasts.success, ['Key created.']);
  assert.equal(r.toasts.error.length, 0);
  assert.equal(r.refreshed, 1);
  assert.ok(r.emitted.some(e => e[0] === 'updateDeploykeys'), 'updateDeploykeys emitted');
  assert.equal(r.scope.creatingDeploykey, false);
  assert.ok(r.digests >= 1);
});

check('D2 success reply without a key or pubkey, or a string body, is a failure', () => {
  for (const response of [{ success: true }, { success: true, response: { name: 'x' } }, '{"success":true,"response":{"pubkey":"k"}}']) {
    assertShown(scenario({ response }), CREATE_FAILED);
  }
});

check('D3 .done invalid_key_name shows the sentence for its reason, the fallback otherwise', () => {
  for (const [reason, sentence] of Object.entries(SENTENCES)) {
    assertShown(scenario({ response: { success: false, response: 'invalid_key_name', reason } }), sentence);
  }
  assertShown(scenario({ response: { success: false, response: 'invalid_key_name', reason: 'weird' } }), FALLBACK);
  assertShown(scenario({ response: { success: false, response: 'invalid_key_name' } }), FALLBACK);
  assertShown(scenario({ response: { success: false, response: 'invalid_key_name', reason: 'toString' } }), FALLBACK);
});

check('D4 .done other refusal shows the generic sentence', () => {
  assertShown(scenario({ response: { success: false, response: 'key_failed' } }), CREATE_FAILED);
});

check('D5 .fail with invalid_key_name in responseJSON: sentence, xhrFailed, reset, never [object Object]', () => {
  const jqXHR = { status: 400, responseJSON: { success: false, response: 'invalid_key_name', reason: 'too_long' } };
  const r = scenario({ failWith: jqXHR });
  assertShown(r, SENTENCES.too_long);
  const failed = r.emitted.filter(e => e[0] === 'xhrFailed');
  assert.equal(failed.length, 1, 'one xhrFailed');
  assert.equal(failed[0][1], jqXHR, 'xhrFailed carries the jqXHR');
  assert.ok(r.texts.every(t => typeof t.value === 'string' && t.value !== '[object Object]'), 'text is a sentence');
});

check('D6 .fail without responseJSON (network) shows the generic sentence', () => {
  const jqXHR = { status: 0, statusText: 'error' };
  const r = scenario({ failWith: jqXHR });
  assertShown(r, CREATE_FAILED);
  assert.ok(r.emitted.some(e => e[0] === 'xhrFailed' && e[1] === jqXHR), 'xhrFailed emitted');
});

check('D7 client check refuses control characters and 121 units before sending; 120 units are sent', () => {
  for (const name of ['Fire\tware', 'Fire\nware', 'Fire\u007Fware', 'Fire\u0000ware']) {
    const r = scenario({ name });
    assert.equal(r.calls, 0, 'no request for ' + JSON.stringify(name));
    assertShown(r, SENTENCES.control_chars);
  }
  const long = scenario({ name: 'a'.repeat(121) });
  assert.equal(long.calls, 0, 'no request for 121 units');
  assertShown(long, SENTENCES.too_long);
  const padded = scenario({ name: '  ' + 'a'.repeat(120) + '  ', response: SUCCESS });
  assert.equal(padded.calls, 1, '120 units after trim are sent');
  assert.equal(padded.sentName, 'a'.repeat(120));
});

check('D8 a throw while handling the reply still resets and shows the generic sentence', () => {
  const r = scenario({ response: SUCCESS, throwInSuccess: true });
  assert.equal(r.threw, null, 'no throw escapes');
  assert.equal(r.scope.creatingDeploykey, false);
  assert.deepEqual(r.warnings, [CREATE_FAILED]);
  assert.deepEqual(r.toasts.error.map(t => t.message), [CREATE_FAILED]);
});

check('D9 every toast and warning is a fixed sentence with no reply field, key name or reason code', () => {
  assert.ok(seen.length > 0);
  for (const value of seen) {
    const text = String(value);
    assert.ok(typeof value === 'string', 'not a string: ' + text);
    assert.ok(ALLOWED.has(text), 'not a fixed sentence: ' + text);
    for (const bad of FORBIDDEN) assert.ok(!text.includes(bad), 'contains ' + bad + ': ' + text);
  }
});

check('D10 sentences match vue/src/utils/keyNames.js; no control-character regular expression', () => {
  const evalLiteral = text => vm.runInNewContext('(' + text + ')');
  const vueTable = keyNamesSource.match(/const MESSAGES = (\{[\s\S]*?\n\});/);
  const vueFallback = keyNamesSource.match(/export function keyNameMessage[\s\S]*?:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*;/);
  assert.ok(vueTable && vueFallback, 'keyNames.js parsed');
  const legacyTable = source.match(/KEY_NAME_MESSAGES\s*=\s*(\{[\s\S]*?\});/);
  const legacyFallback = source.match(/KEY_NAME_FALLBACK\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
  assert.ok(legacyTable, 'KEY_NAME_MESSAGES in the controller');
  assert.ok(legacyFallback, 'KEY_NAME_FALLBACK in the controller');
  assert.deepEqual(JSON.parse(JSON.stringify(evalLiteral(legacyTable[1]))), JSON.parse(JSON.stringify(evalLiteral(vueTable[1]))));
  assert.equal(evalLiteral(legacyFallback[1]), evalLiteral(vueFallback[1]));
  assert.deepEqual(JSON.parse(JSON.stringify(evalLiteral(vueTable[1]))), SENTENCES, 'harness table matches keyNames.js');
  assert.ok(source.includes('charCodeAt'), 'code units compared as numbers');
  assert.ok(!/\\x[01][0-9a-f]|\\x7f|\\u00[01][0-9a-f]|\\u007f|\\c[A-Z]|\[\\0/i.test(source), 'no control-character regex');
});

if (failures > 0) {
  console.log(failures + ' Legacy deploy-key check(s) failed.');
  process.exitCode = 1;
} else {
  console.log('Legacy deploy-key create: all checks passed.');
}
