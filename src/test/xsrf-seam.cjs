// Regression guard for the classic dashboard XSRF seam in app/js/thinx-api.js
// (Phase 25 D-18).
//
// The dashboard talks to the API with plain $.ajax and does not load
// assets/thinx/csrf.js, so without its own $.ajaxSetup beforeSend every
// cookie-session mutation goes out without X-XSRF-TOKEN and 403s once the API
// guards that route. The seam must echo the XSRF-TOKEN cookie, read at send
// time, on API-bound calls only: never to a foreign origin such as gravatar.
//
// Loads thinx-api.js into a vm context with a stub jQuery. Runs on plain node,
// no build and no browser: npm run test:xsrf

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const API_BASE = 'https://rtm.thinx.cloud/api';
const raw = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'thinx-api.js'), 'utf8');

let failures = 0;

function check(name, condition) {
  console.log((condition ? 'ok   ' : 'FAIL ') + name);
  if (!condition) failures++;
}

// Evaluates thinx-api.js with urlBase set to `base` and returns every options
// object handed to $.ajaxSetup, in call order, plus the fake document.
function load(base) {
  const setups = [];
  const noop = new Proxy(function () {}, {
    get: (target, prop) => (prop === 'ajaxSetup' ? (options) => { setups.push(options); } : noop),
    apply: () => noop
  });
  const document = { cookie: '' };
  const context = vm.createContext({ $: noop, jQuery: noop, document, window: {}, console });
  vm.runInContext(raw.replace('<ENV::apiBaseUrl>', base), context, { filename: 'thinx-api.js' });
  return { setups, document };
}

// Calls the recorded beforeSend for `url` and returns the headers it set.
function send(beforeSend, url) {
  const headers = {};
  const xhr = { setRequestHeader(name, value) { headers[name] = value; } };
  beforeSend.call({}, xhr, { url });
  return headers;
}

const prod = load(API_BASE);
const seamIndex = prod.setups.findIndex((options) => options && typeof options.beforeSend === 'function');
check('thinx-api.js registers a $.ajaxSetup beforeSend', seamIndex !== -1);

if (seamIndex !== -1) {
  const beforeSend = prod.setups[seamIndex].beforeSend;
  const withToken = 'x-thx-core=s%3Aabc; XSRF-TOKEN=tok%2Evalue; other=1';

  prod.document.cookie = withToken;
  let h = send(beforeSend, API_BASE + '/user/profile');
  check('urlBase call carries X-XSRF-TOKEN = decoded cookie value', h['X-XSRF-TOKEN'] === 'tok.value');

  h = send(beforeSend, '/api/user/profile');
  check('relative call carries X-XSRF-TOKEN', h['X-XSRF-TOKEN'] === 'tok.value');

  h = send(beforeSend, 'https://www.gravatar.com/avatar/x');
  check('foreign origin (gravatar) gets no X-XSRF-TOKEN', !('X-XSRF-TOKEN' in h));

  h = send(beforeSend, '//evil.example/api/user/profile');
  check('protocol-relative foreign URL gets no X-XSRF-TOKEN', !('X-XSRF-TOKEN' in h));

  h = send(beforeSend, '/\\evil.example/api/user/profile');
  check('backslash protocol-relative foreign URL gets no X-XSRF-TOKEN', !('X-XSRF-TOKEN' in h));

  h = send(beforeSend, 'https://rtm.thinx.cloud.evil.example/api/user/profile');
  check('look-alike host sharing the urlBase prefix gets no X-XSRF-TOKEN', !('X-XSRF-TOKEN' in h));

  h = send(beforeSend, undefined);
  check('missing settings.url sets no header and does not throw', !('X-XSRF-TOKEN' in h));

  prod.document.cookie = 'x-thx-core=s%3Aabc; other=1';
  h = send(beforeSend, API_BASE + '/user/profile');
  const h2 = send(beforeSend, '/api/user/profile');
  check('no XSRF-TOKEN cookie: no header for any URL', !('X-XSRF-TOKEN' in h) && !('X-XSRF-TOKEN' in h2));

  prod.document.cookie = 'XSRF-TOKEN=rotated';
  h = send(beforeSend, API_BASE + '/user/delete');
  check('cookie is read at send time (rotation is picked up)', h['X-XSRF-TOKEN'] === 'rotated');

  const first = prod.setups[0];
  check('first $.ajaxSetup keeps contentType and withCredentials, issued before the seam',
    seamIndex > 0 && first.contentType === 'application/json; charset=utf-8' &&
    first.xhrFields && first.xhrFields.withCredentials === true && typeof first.beforeSend === 'undefined');

  const local = load('http://localhost:7442');
  const localSeam = local.setups.findIndex((options) => options && typeof options.beforeSend === 'function');
  check('localhost build: contentType setup still issued first, seam still registered',
    localSeam > 0 && local.setups[0].contentType === 'application/json; charset=utf-8' &&
    typeof local.setups[0].xhrFields === 'undefined');

  check('exactly one beforeSend in thinx-api.js', (raw.match(/beforeSend/g) || []).length === 1);
}

process.exit(failures ? 1 : 0);
