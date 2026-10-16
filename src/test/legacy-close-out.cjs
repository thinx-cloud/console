// Legacy console close-out checks, v1.18 Phase 48 D-09 (UI-C19, UI-C20, 35 IN-05, 43-REVIEW IN-04,
// 43-UI-REVIEW fix 3).
//
// - DevicesController: the THiNX Builder toast after a build reads Build queued. / Build started.
//   and never carries a reply field (the build reply has no status field); a refused build shows
//   Build failed. (48-REVIEW WR-04).
// - LogviewController: a Build Status frame for a device with no build history does not throw; a socket
//   first opened from the log overlay sends {init} before the logtail; wsstailLog does not send on a
//   connecting socket.
// - thinx-api.js updateDeploykeys: the deploykey goal follows goals.length > 0 like its siblings.
//
// Loads the real files into vm sandboxes with stub angular, jQuery, toastr, Thinx and WebSocket.
// Plain node, no build and no browser: `node test/legacy-close-out.cjs` from src/, or
// `node ../src/test/legacy-close-out.cjs` from vue/. Prints `ok   <name>` / `FAIL <name>` per case and
// exits non-zero on any FAIL.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');

const controllers = path.join(__dirname, '..', 'app', 'js', 'controllers');
const devicesFile = path.join(controllers, 'DevicesController.js');
const logviewFile = path.join(controllers, 'LogviewController.js');
const apiFile = path.join(__dirname, '..', 'app', 'js', 'thinx-api.js');
const devicesSource = fs.readFileSync(devicesFile, 'utf8');
const logviewSource = fs.readFileSync(logviewFile, 'utf8');
const apiSource = fs.readFileSync(apiFile, 'utf8');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (error) {
    failures++;
    let message = error && error.message ? String(error.message).split('\n')[0] : String(error);
    if (error && error.code === 'ERR_ASSERTION' && error.generatedMessage) {
      message += ' actual: ' + String(JSON.stringify(error.actual)).slice(0, 120);
    }
    console.log('FAIL ' + name + ' (' + message + ')');
  }
}

// A jQuery element stand-in: every method is a chainable no-op.
const element = new Proxy({}, { get: () => () => element });

// Records every toastr property that gets called.
function recordingToastr(toasts) {
  return new Proxy({}, {
    get(target, key) {
      return function (...args) { toasts.push({ method: String(key), args }); return {}; };
    },
  });
}

// --- DevicesController ($scope.build) ----------------------------------------------------------

function loadDevices(reply) {
  const toasts = [], emits = [];
  const chain = { done() { return chain; }, fail() { return chain; } };
  let controller = null;
  const sandbox = {
    console: { log() {}, error() {} },
    $: () => element,
    angular: { module() { return { controller(name, deps) { controller = deps[deps.length - 1]; } }; }, element: () => element },
    toastr: recordingToastr(toasts),
    App: { initAjax() {} },
    Thinx: new Proxy({
      init() {},
      build() { return { done(fn) { fn(reply); return this; }, fail() { return this; } }; },
      getBuildHistory() { return chain; },
    }, { get: (target, key) => (key in target ? target[key] : () => chain) }),
  };
  vm.createContext(sandbox);
  vm.runInContext(devicesSource, sandbox, { filename: devicesFile });
  const $rootScope = {
    settings: { layout: {} },
    getSourceById: () => ({ alias: 'source-1' }),
    meta: { builds: {} },
    profile: { info: { goals: ['build'] } },
    $on() { return function () {}; },
  };
  const $scope = { $on() {}, $emit: (...args) => emits.push(args), $apply() {}, $applyAsync() {} };
  controller($rootScope, $scope, {}, function () {});
  $scope.build('u1', 's1');
  return { toasts, emits };
}

const TOAST_TAIL = '<br><br>Click to show build log...';

function builderToast(r) {
  assert.equal(r.toasts.length, 1, 'exactly one toast');
  const toast = r.toasts[0];
  assert.equal(toast.method, 'info');
  assert.equal(toast.args[1], 'THiNX Builder');
  return toast;
}

// --- LogviewController ------------------------------------------------------------------------

function loadLogview({ deviceBuilds } = {}) {
  const state = { toasts: [], emits: [], sockets: [] };
  function FakeWebSocket(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.send = function (data) {
      if (this.readyState !== 1) throw new Error('InvalidStateError: still in CONNECTING state');
      this.sent.push(data);
    };
    state.sockets.push(this);
  }
  const chain = { done() { return chain; }, fail() { return chain; } };
  let controller = null;
  const sandbox = {
    console: { log() {}, error() {} },
    $: () => element,
    toastr: recordingToastr(state.toasts),
    WebSocket: FakeWebSocket,
    window: { WebSocket: FakeWebSocket },
    setInterval: () => 1,
    clearInterval() {},
    Thinx: { deviceList() { return chain; }, getBuildHistory() { return chain; } },
    angular: { module() { return { controller(name, deps) { controller = deps[deps.length - 1]; } }; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(logviewSource, sandbox, { filename: logviewFile });
  let loaded = null;
  const meta = { notifications: [] };
  if (deviceBuilds !== undefined) meta.deviceBuilds = deviceBuilds;
  const $rootScope = {
    profile: { owner: 'owner-1' },
    meta,
    logdata: { watchers: {} },
    $on() { return function () {}; },
    $digest() {},
  };
  const $scope = {
    $on(event, fn) { if (event === '$viewContentLoaded') loaded = fn; },
    $emit: (...args) => state.emits.push(args),
    $apply() {},
  };
  controller($rootScope, $scope, {});
  state.$rootScope = $rootScope;
  state.viewLoaded = () => loaded();
  state.frame = msg => $rootScope.wss.onmessage({ data: JSON.stringify({ notification: msg }) });
  return state;
}

// --- thinx-api.js (Thinx.init listeners) ------------------------------------------------------

function loadApi(profile) {
  const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
  const context = vm.createContext({ $: noop, jQuery: noop, document: { cookie: '' }, window: {}, console });
  vm.runInContext(apiSource.replace('<ENV::apiBaseUrl>', 'https://rtm.thinx.cloud/api'), context, { filename: apiFile });
  const handlers = {}, emits = [];
  const $rootScope = {
    $on(name, fn) { handlers[name] = fn; return function () {}; },
    $apply(fn) { if (typeof fn === 'function') fn(); },
  };
  if (profile !== undefined) $rootScope.profile = profile;
  const $scope = {
    $on() { return function () {}; },
    $emit: (...args) => emits.push(args),
    $apply(fn) { if (typeof fn === 'function') fn(); },
  };
  vm.runInContext('Thinx', context).init($rootScope, $scope);
  return {
    $rootScope,
    emits,
    deploykeys: data => handlers.updateDeploykeys({ stopPropagation() {} }, data),
  };
}

const KEYS = { success: true, response: [{ name: 'k1', filename: 'owner-1' }] };

// --- checks -----------------------------------------------------------------------------------

check('G1 queued build: Build queued. toast with unchanged title, options and log click', () => {
  const r = loadDevices({ success: true, build_id: 'b1', response: 'queued' });
  const toast = builderToast(r);
  assert.equal(toast.args[0], 'Build queued.' + TOAST_TAIL);
  const options = toast.args[2];
  assert.equal(options.timeOut, 3000);
  assert.equal(options.extendedTimeOut, 5000);
  assert.equal(options.tapToDismiss, false);
  assert.equal(options.closeButton, false);
  assert.equal(options.progressBar, true);
  assert.equal(typeof options.onclick, 'function');
  r.emits.length = 0;
  options.onclick();
  assert.deepEqual(r.emits, [['showLogOverlay', 'b1']]);
});

check('G2 any other reply: Build started. toast without undefined or a reply value', () => {
  for (const response of ['started', undefined, {}, '<img src=x onerror=alert(1)>']) {
    const reply = { success: true, build_id: 'b2' };
    if (response !== undefined) reply.response = response;
    const toast = builderToast(loadDevices(reply));
    assert.equal(toast.args[0], 'Build started.' + TOAST_TAIL);
    assert.ok(!toast.args[0].includes('undefined'), 'no undefined');
    assert.ok(!toast.args[0].includes('<img'), 'no reply value');
  }
});

check('G9 refused build: one Build failed. error toast, never undefined or a reply value (48-REVIEW WR-04)', () => {
  for (const reply of [{ success: false }, { success: false, response: '<img src=x onerror=alert(1)>' }, { success: false, status: 'x' }]) {
    const r = loadDevices(reply);
    assert.equal(r.toasts.length, 1, 'exactly one toast');
    const toast = r.toasts[0];
    assert.equal(toast.method, 'error');
    assert.equal(toast.args[0], 'Build failed.');
    assert.equal(toast.args[1], '<ENV::loginPageTitle>');
    assert.equal(toast.args[2].timeOut, 5000);
  }
});

check('G3 Build Status frame for a device with no history: array initialised, toast shown', () => {
  const other = [{ build_id: 'b0' }];
  const env = loadLogview({ deviceBuilds: { 'u-old': other } });
  env.viewLoaded();
  const frame = { udid: 'u-new', body: 'Building...', type: 'info', build_id: 'b9' };
  env.frame(frame);
  const builds = env.$rootScope.meta.deviceBuilds;
  assert.ok(Array.isArray(builds['u-new']), 'array for u-new');
  assert.equal(builds['u-new'].length, 1);
  assert.equal(builds['u-new'][0].build_id, 'b9');
  assert.equal(env.toasts.filter(t => t.method === 'info').length, 1, 'toast shown');
  env.frame(frame);
  assert.equal(builds['u-new'].length, 2, 'second frame appends');
  env.frame({ udid: 'u-old', body: 'Completed', type: 'success', build_id: 'b0' });
  assert.equal(builds['u-old'], other, 'existing array kept');
  assert.equal(other.length, 2, 'existing array grows');
  const bare = loadLogview();
  bare.viewLoaded();
  bare.frame(frame);
  assert.equal(bare.$rootScope.meta.deviceBuilds['u-new'].length, 1, 'map initialised when missing');
});

check('G4 first socket from the log overlay sends {init} then the logtail on open', () => {
  const env = loadLogview({ deviceBuilds: {} });
  assert.equal(env.$rootScope.wss, undefined);
  env.$rootScope.showLog('b1');
  const wss = env.$rootScope.wss;
  assert.ok(wss, 'socket opened');
  assert.deepEqual(wss.sent, [], 'nothing sent while connecting');
  wss.readyState = 1;
  wss.onopen();
  assert.deepEqual(wss.sent, [
    JSON.stringify({ init: 'owner-1' }),
    JSON.stringify({ logtail: { owner_id: 'owner-1', build_id: 'b1' } }),
  ]);
});

check('G5 socket opened by the view with no build selected sends only {init}', () => {
  const env = loadLogview({ deviceBuilds: {} });
  env.viewLoaded();
  const wss = env.$rootScope.wss;
  wss.readyState = 1;
  wss.onopen();
  assert.deepEqual(wss.sent, [JSON.stringify({ init: 'owner-1' })]);
});

check('G6 wsstailLog sends nothing on a connecting socket and one frame on an open one', () => {
  const env = loadLogview({ deviceBuilds: {} });
  env.viewLoaded();
  const wss = env.$rootScope.wss;
  env.$rootScope.wsstailLog('b2');
  assert.deepEqual(wss.sent, [], 'nothing sent while connecting');
  assert.equal(env.$rootScope.modalBuildId, 'b2');
  wss.readyState = 1;
  env.$rootScope.wsstailLog('b2');
  assert.deepEqual(wss.sent, [JSON.stringify({ logtail: { owner_id: 'owner-1', build_id: 'b2' } })]);
});

check('G7 updateDeploykeys records the goal only for a non-empty goals array, null-safe', () => {
  const empty = loadApi({ info: { goals: [] } });
  empty.deploykeys(KEYS);
  assert.deepEqual(empty.$rootScope.profile.info.goals, [], 'empty goals untouched');
  assert.equal(empty.emits.filter(e => e[0] === 'saveProfileChanges').length, 0, 'no save for empty goals');
  const started = loadApi({ info: { goals: ['build'] } });
  started.deploykeys(KEYS);
  assert.deepEqual(started.$rootScope.profile.info.goals, ['build', 'deploykey']);
  // The emitted array comes from the vm realm: compare by value, not by prototype.
  assert.equal(JSON.stringify(started.emits.filter(e => e[0] === 'saveProfileChanges')), JSON.stringify([['saveProfileChanges', ['goals']]]));
  for (const profile of [undefined, {}, { info: {} }]) {
    const r = loadApi(profile);
    r.deploykeys(KEYS);
    assert.equal(r.emits.length, 0, 'no emit for ' + JSON.stringify(profile));
  }
  const refused = loadApi({ info: { goals: ['build'] } });
  refused.deploykeys({ success: false, response: 'nope' });
  assert.equal(refused.emits.length, 0, 'no emit for a refusal');
  assert.deepEqual(refused.$rootScope.profile.info.goals, ['build']);
});

check('G8 source: no status-field toast, {init} always on open, goals.length > 0', () => {
  assert.ok(!devicesSource.includes('response.status + "<br>'), 'DevicesController builds the toast from response.status');
  assert.ok(!/toastr\.error\(\s*response\./.test(devicesSource), 'DevicesController passes a reply field to toastr.error');
  assert.ok(devicesSource.includes('Build queued.'), 'Build queued. in DevicesController');
  const onopen = logviewSource.match(/\$rootScope\.wss\.onopen = function\(\) \{([\s\S]*?)\n {8}\};/);
  assert.ok(onopen, 'wss.onopen found');
  assert.ok(onopen[1].includes('$rootScope.wssinit()'), 'wss.onopen calls wssinit()');
  assert.ok(!/\belse\b/.test(onopen[1]), 'no else branch in wss.onopen');
  assert.ok(logviewSource.includes('Array.isArray( $rootScope.meta.deviceBuilds[ msg.udid ] )'), 'deviceBuilds guard');
  const region = apiSource.match(/function updateDeploykeys\([\s\S]*?\n {2}\}\n/);
  assert.ok(region, 'updateDeploykeys found');
  assert.ok(region[0].includes('goals.length > 0'), 'goals.length > 0 in updateDeploykeys');
});

if (failures > 0) {
  console.log(failures + ' Legacy close-out check(s) failed.');
  process.exitCode = 1;
} else {
  console.log('Legacy close-out: all checks passed.');
}
