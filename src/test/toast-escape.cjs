// Device-supplied notification fields must not reach toastr as HTML.
//
// The classic console's websocket handler (parseNotification in
// app/js/controllers/LogviewController.js) renders notification frames with
// toastr, and toastr treats both its message and its title as HTML. Since
// quick 261003-vn3 actionable frames reach the device owner's sockets, and a
// transferred device's previous owner can still publish them, so msg.body,
// msg.title, msg.nid and JSON.stringify(msg.body) are attacker-controlled.
// The CSP stops inline script, but not fake prompts, links or overlays.
//
// This check loads the real controller into a vm with fake angular, jQuery,
// toastr and WebSocket, feeds frames through wss.onmessage and inspects what
// reaches toastr and jQuery.
//
// Plain node, no build and no browser: npm run test:toast

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'app', 'js', 'controllers', 'LogviewController.js');
const source = fs.readFileSync(file, 'utf8');

let failures = 0;

function check(name, condition) {
  console.log((condition ? 'ok   ' : 'FAIL ') + name);
  if (!condition) failures++;
}

function decode(html) {
  return html
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#96;/g, '`')
    .replace(/&amp;/g, '&');
}

// Only the markup we put there ourselves may contain these characters.
function noRawMarkup(text) {
  return typeof text === 'string' && !/[<>"'`]/.test(text);
}

function load() {
  const state = { toasts: [], selectors: [], handlers: {}, emits: [], socket: null };

  const element = {
    on(event, fn) { state.handlers[this.selector] = fn; return this; },
    parent() { return { slideToggle() {} }; },
    val() { return 'typed reply'; },
  };

  function $(selector) {
    state.selectors.push(selector);
    return Object.assign(Object.create(element), { selector });
  }

  // Records every property that gets called, so toastr["constructor"] or
  // toastr["clear"] are caught instead of silently resolving on a plain object.
  const toastr = new Proxy({}, {
    get(target, key) {
      return function (...args) { state.toasts.push({ method: String(key), args }); return {}; };
    },
  });

  function FakeWebSocket(url) { this.url = url; this.send = function () {}; }

  const chain = { done() { return chain; }, fail() { return chain; } };
  let controller = null;

  const sandbox = {
    console,
    $,
    toastr,
    WebSocket: FakeWebSocket,
    window: { WebSocket: FakeWebSocket },
    Thinx: { deviceList() { return chain; }, getBuildHistory() { return chain; } },
    angular: { module() { return { controller(name, deps) { controller = deps[deps.length - 1]; } }; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: file });

  let loaded = null;
  const $rootScope = {
    profile: { owner: 'owner-1' },
    meta: { notifications: [], deviceBuilds: {} },
    logdata: { watchers: {} },
    $on() { return function () {}; },
    $digest() {},
  };
  const $scope = {
    $on(event, fn) { if (event === '$viewContentLoaded') loaded = fn; },
    $emit(event, value) { state.emits.push([event, value]); },
    $apply() {},
  };

  controller($rootScope, $scope, {});
  loaded();

  state.sandbox = sandbox;
  state.send = function (msg) {
    state.toasts.length = 0;
    state.selectors.length = 0;
    state.emits.length = 0;
    state.handlers = {};
    $rootScope.wss.onmessage({ data: JSON.stringify({ notification: msg }) });
  };
  state.click = function (selector) {
    const handler = state.handlers[selector];
    if (handler) handler.call($('<clicked>'), {});
    return !!handler;
  };
  return state;
}

const env = load();
const PAYLOAD = '<img src=x onerror=alert(1)>';
const NID = '0fa1c4c0-2f53-11ee-9e3a-5b1a1d0c1a2b';

// --- the escape helper ----------------------------------------------------

const escape = env.sandbox.thinxEscapeHtml;
check('thinxEscapeHtml is defined in LogviewController.js', typeof escape === 'function');
if (typeof escape === 'function') {
  check('escapes & < > " \' and backtick',
    escape('&<>"\'`') === '&amp;&lt;&gt;&quot;&#39;&#96;');
  check('leaves plain text alone', escape('Build ok, 100%') === 'Build ok, 100%');
  check('null/undefined become empty, not "undefined"', escape(undefined) === '' && escape(null) === '');
}

// --- plain notifications --------------------------------------------------

env.send({ type: 'info', title: 'Hello', body: 'Build ok' });
check('plain: legitimate frame still toasts once via info', env.toasts.length === 1 && env.toasts[0].method === 'info');
check('plain: body reads the same as before', env.toasts[0] && decode(env.toasts[0].args[0]) === JSON.stringify('Build ok'));
check('plain: title unchanged', env.toasts[0] && env.toasts[0].args[1] === 'Hello');

env.send({ type: 'error', title: PAYLOAD, body: PAYLOAD + ' "q" \'s\' `b`' });
const plain = env.toasts[0] || { args: [] };
check('plain: hostile body is escaped', env.toasts.length === 1 && noRawMarkup(plain.args[0]));
check('plain: hostile body still reads the same', decode(plain.args[0] || '') === JSON.stringify(PAYLOAD + ' "q" \'s\' `b`'));
check('plain: hostile title is escaped', noRawMarkup(plain.args[1]) && decode(plain.args[1]) === PAYLOAD);

env.send({ type: 'warning', body: { nested: PAYLOAD } });
check('plain: object body JSON is escaped', env.toasts.length === 1 && noRawMarkup(env.toasts[0].args[0]) &&
  decode(env.toasts[0].args[0]) === JSON.stringify({ nested: PAYLOAD }));

// --- status notifications -------------------------------------------------

env.send({ type: 'success', body: { status: PAYLOAD } });
const status = env.toasts[0] || { args: [] };
check('status: toasts once via success', env.toasts.length === 1 && status.method === 'success');
check('status: JSON body is escaped and reads the same', noRawMarkup(status.args[0]) &&
  decode(status.args[0]) === JSON.stringify({ status: PAYLOAD }));
check('status: fixed title', status.args[1] === 'Device Status Update');

// --- toastr method allowlist ----------------------------------------------

for (const type of ['constructor', 'remove', 'clear', 'options', '__proto__', 'toString', 'getContainer', 'subscribe']) {
  env.send({ type, title: 't', body: 'b' });
  check('plain: msg.type "' + type + '" never reaches toastr', env.toasts.length === 0);
  env.send({ type, body: { status: 'ok' } });
  check('status: msg.type "' + type + '" never reaches toastr', env.toasts.length === 0);
}

// --- actionable: yes/no ---------------------------------------------------

env.send({ type: 'actionable', response_type: 'bool', nid: NID, title: 'Update?', body: 'Install firmware 1.2?' });
const bool = env.toasts[0] || { args: [] };
check('bool: legitimate frame toasts once via info', env.toasts.length === 1 && bool.method === 'info');
check('bool: markup unchanged for plain text',
  bool.args[0] === 'Install firmware 1.2?<br><br>' + NID + '<br><br>' +
  '<div><button type="button" id="okBtn-' + NID + '" class="btn btn-success toastr-ok-btn">Yes</button>' +
  '<button type="button" id="cancelBtn-' + NID + '" class="btn btn-danger toastr-cancel-btn" style="margin: 0 8px 0 8px">No</button></div>');
check('bool: title unchanged', bool.args[1] === 'Update?');
check('bool: Yes button wired and answers true',
  env.click('#okBtn-' + NID) && env.emits.some(([e, v]) => e === 'submitNotificationResponse' && v === true));
env.emits.length = 0;
check('bool: No button wired and answers false',
  env.click('#cancelBtn-' + NID) && env.emits.some(([e, v]) => e === 'submitNotificationResponse' && v === false));

env.send({ type: 'actionable', response_type: 'bool', nid: NID, title: PAYLOAD, body: PAYLOAD });
const hostileBool = env.toasts[0] || { args: [] };
check('bool: hostile body escaped', env.toasts.length === 1 &&
  typeof hostileBool.args[0] === 'string' && !hostileBool.args[0].includes('<img') &&
  hostileBool.args[0].startsWith('&lt;img src=x onerror=alert(1)&gt;<br><br>'));
check('bool: hostile title escaped', noRawMarkup(hostileBool.args[1]) && decode(hostileBool.args[1]) === PAYLOAD);

// --- actionable: string input ---------------------------------------------

env.send({ type: 'actionable', response_type: 'string', nid: 'nid-0000', title: 'Name?', body: 'Device name' });
const input = env.toasts[0] || { args: [] };
check('string: legitimate frame toasts once via warning', env.toasts.length === 1 && input.method === 'warning');
check('string: markup unchanged for plain text',
  input.args[0] === 'Device name<br><br>nid-0000<br><br>' +
  '<div><input class="toastr-input" name="reply-nid-0000" value=""/></div><br>' +
  '<div><button type="button" id="sendBtn-nid-0000" class="btn btn-success toastr-send-btn">Send</button></div>');
check('string: Send button wired and submits the typed reply',
  env.click('#sendBtn-nid-0000') &&
  env.selectors.includes('input[name=reply-nid-0000]') &&
  env.emits.some(([e, v]) => e === 'submitNotificationResponse' && v === 'typed reply'));

env.send({ type: 'actionable', response_type: 'string', nid: 'nid-0000', title: PAYLOAD, body: PAYLOAD });
check('string: hostile body and title escaped', env.toasts.length === 1 &&
  !env.toasts[0].args[0].includes('<img') && noRawMarkup(env.toasts[0].args[1]));

// --- actionable: nid validation -------------------------------------------

const badNids = [
  ['markup', 'x"><img src=x>'],
  ['quote', "a'b"],
  ['space', 'a b'],
  ['selector', 'a],#x'],
  ['empty', ''],
  ['129 chars', 'a'.repeat(129)],
  ['missing', undefined],
  ['object', { toString() { return 'ok'; } }],
];
for (const [label, nid] of badNids) {
  for (const response_type of ['bool', 'string']) {
    env.send({ type: 'actionable', response_type, nid, title: 't', body: 'b' });
    check('actionable ' + response_type + ': nid ' + label + ' drops the toast',
      env.toasts.length === 0 && env.selectors.length === 0);
  }
}

env.send({ type: 'actionable', response_type: 'bool', nid: 'A_b-9'.repeat(25) + 'xyz', title: 't', body: 'b' });
check('actionable: 128-char nid still accepted', env.toasts.length === 1);

// --- static guard ---------------------------------------------------------

const handler = source.slice(source.indexOf('function parseNotification('));
check('no toastr call indexed by msg.type', !/toastr\s*\[\s*msg\.type\s*\]/.test(handler));

process.exit(failures ? 1 : 0);
