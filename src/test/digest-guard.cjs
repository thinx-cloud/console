// Regression guard for the AngularJS digest guard in app/js/thinx-api.js.
//
// Every handler in init() is reachable both from a jQuery .done() callback
// (outside Angular) and from a $scope.$on handler (inside a digest). A bare
// $apply() on the second path throws $rootScope:inprog and aborts the rest of
// the handler, leaving the bindings it was flushing unrendered. safeApply has
// to start a digest in the first case and stay out of the way in the second.
//
// Runs on plain node, no build and no browser: npm run test:digest

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'thinx-api.js'), 'utf8');
const declaration = source.match(/function safeApply\([\s\S]*?\n\}/);

if (!declaration) {
  console.error('FAIL: safeApply is gone from app/js/thinx-api.js');
  process.exit(1);
}

// eslint-disable-next-line no-eval
eval(declaration[0]);

let failures = 0;

function check(name, condition) {
  console.log((condition ? 'ok   ' : 'FAIL ') + name);
  if (!condition) failures++;
}

// A scope whose $apply throws the way Angular's does mid-digest.
function scopeInDigest() {
  const root = { $$phase: '$digest', $apply() { throw new Error('$rootScope:inprog'); } };
  return { $root: root, $apply() { throw new Error('$rootScope:inprog'); } };
}

function idleScope() {
  const scope = { $$phase: null, calls: 0, handed: null, $apply(fn) { scope.calls++; scope.handed = fn; if (typeof fn === 'function') fn(); } };
  scope.$root = scope;
  return scope;
}

const idle = idleScope();
safeApply(idle);
check('outside a digest: starts one', idle.calls === 1);

const withFn = idleScope();
const callback = () => {};
safeApply(withFn, callback);
check('outside a digest: hands the callback to $apply', withFn.handed === callback);

let threw = false;
try { safeApply(scopeInDigest()); } catch (e) { threw = true; }
check('inside a digest: does not call $apply', !threw);

let ran = 0;
threw = false;
try { safeApply(scopeInDigest(), () => ran++); } catch (e) { threw = true; }
check('inside a digest: still runs the callback, synchronously', ran === 1 && !threw);

threw = false;
try { safeApply(undefined); safeApply(null); } catch (e) { threw = true; }
check('missing scope: no-op instead of TypeError', !threw);

// The point of the exercise: no bare $apply() may survive in that file.
const bare = source.split('\n')
  .map((line, index) => ({ line, number: index + 1 }))
  .filter((entry) => /\$(scope|rootScope)\.\$apply\s*\(/.test(entry.line));
check('no bare $scope/$rootScope.$apply() left in thinx-api.js' +
  (bare.length ? ' (found at line ' + bare.map((e) => e.number).join(', ') + ')' : ''), bare.length === 0);

process.exit(failures ? 1 : 0);
