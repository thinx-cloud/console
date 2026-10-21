// Unit test for the Cypress CI JUnit reporter (v1.18 Phase 48, plan 48-07, CI-07).
//
// Origin: CircleCI pipeline 5675, job 16066 (test-vue-console). After device-detail.spec.js
// Cypress 9.7.0's bundled mocha-junit-reporter 2.0.0 threw a TypeError from its `end`
// handler (index.js:411, flush -> getXml), and that uncaught error ended `cypress run`:
// specs 6 to 11 never started. The spec had started with "Timed out waiting for the
// browser to connect. Retrying...", so the events of more than one runner reached one
// reporter and each runner's `end` flushed it again. getXml replaces every testcase time
// with a string in place, so the second flush calls a number method on a string.
//
//   R0  control: the bundled reporter, fed suite, pass, end and end again, still throws
//       that TypeError on the second end (`skip R0` when the Cypress cache has no bundled
//       reporter, `note R0` when it no longer throws; neither is a failure). The line
//       prints only the check name and the reporter version, never the caught message:
//       CI log checks treat that message text as the crash signal.
//   J1  cases go to the suite of their own parent (the bundled reporter files a test
//       under whichever suite started last), with testsuites totals
//   J2  a repeated end rewrites one file with identical bytes and never throws
//   J3  non-numeric durations render as 0, numbers as seconds with three decimals
//   J4  a hook failure (a plain-object copy of the test carrying the hook title) is one
//       testcase with a failure child
//   J5  XML escaping, ANSI sequences and control code units are removed
//   J6  a write error is logged, never thrown
//   J7  a root suite without a spec file writes junit-spec-<n>.xml
//
// The reporters are driven through a fake runner: a Node EventEmitter with a stats object,
// suites and tests shaped like the Mocha objects Cypress's server builds per spec.
//
// Plain node, offline, no browser: npm run test:unit

const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

const REPORTER = path.join(__dirname, '..', '..', 'cypress', 'reporters', 'junit.js');

let failures = 0;

function firstLine(err) {
  return String(err && err.message ? err.message : err).split('\n')[0];
}

function check(name, fn) {
  try {
    const detail = fn();
    console.log('ok   ' + name + (typeof detail === 'string' ? ' (' + detail + ')' : ''));
  } catch (err) {
    failures++;
    console.log('FAIL ' + name + ' (' + firstLine(err) + ')');
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Fake Mocha objects and runner
// ---------------------------------------------------------------------------

function titlePathOf(node) {
  const own = node.title ? [node.title] : [];
  if (!node.parent || node.parent.root) return own;
  return node.parent.titlePath().concat(own);
}

function makeSuite(title, parent, file) {
  const suite = {
    title,
    parent,
    root: !parent,
    suites: [],
    tests: [],
    titlePath() { return titlePathOf(this); },
    fullTitle() { return this.titlePath().join(' '); },
  };
  if (!parent && file !== undefined) suite.file = file;
  if (parent) parent.suites.push(suite);
  return suite;
}

function makeTest(title, parent, duration, state) {
  const test = {
    title,
    parent,
    duration,
    state,
    slow() { return 75; },
    titlePath() { return titlePathOf(this); },
    fullTitle() { return this.titlePath().join(' '); },
  };
  parent.tests.push(test);
  return test;
}

function makeRunner() {
  const runner = new EventEmitter();
  runner.stats = { suites: 0, tests: 0, passes: 0, pending: 0, failures: 0 };
  return runner;
}

// Replace console.log / console.error while fn runs; the captured lines are pushed to
// `lines`, so the unit log carries no reporter output and J6 can assert on it.
function captured(lines, fn) {
  const log = console.log;
  const error = console.error;
  console.log = (...a) => { lines.push(a.join(' ')); };
  console.error = (...a) => { lines.push(a.join(' ')); };
  try {
    return fn();
  } finally {
    console.log = log;
    console.error = error;
  }
}

function withTmp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cy-junit-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function newReporter(runner, dir, lines, mochaFile) {
  const Reporter = require(REPORTER);
  const file = mochaFile || path.join(dir, 'junit-[spec].xml');
  return captured(lines, () => new Reporter(runner, { reporterOptions: { mochaFile: file } }));
}

function emit(runner, lines, ...args) {
  return captured(lines, () => runner.emit(...args));
}

function xmlFiles(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.xml')).sort();
}

function attr(tag, name) {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : undefined;
}

// [{ tag, cases: [{ tag, body }] }] for every <testsuite> element.
function testsuites(xml) {
  const out = [];
  const re = /<testsuite\s[^>]*>([\s\S]*?)<\/testsuite>/g;
  let m;
  while ((m = re.exec(xml))) {
    const tag = /<testsuite\s[^>]*>/.exec(m[0])[0];
    const cases = [];
    const cre = /<testcase\s[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g;
    let c;
    while ((c = cre.exec(m[1]))) {
      cases.push({ tag: /<testcase\s[^>]*?\/?>/.exec(c[0])[0], body: c[2] || '' });
    }
    out.push({ tag, cases });
  }
  return out;
}

function rootTag(xml) {
  const m = /<testsuites\s[^>]*>/.exec(xml);
  assert(m, 'no <testsuites> element');
  return m[0];
}

// ---------------------------------------------------------------------------
// R0: the bundled reporter's crash, kept as a control
// ---------------------------------------------------------------------------

function cypressCacheDir() {
  if (process.env.CYPRESS_CACHE_FOLDER) return process.env.CYPRESS_CACHE_FOLDER;
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'Cypress');
  return path.join(os.homedir(), '.cache', 'Cypress');
}

function bundledReporterDir() {
  let version;
  try {
    version = require('cypress/package.json').version;
  } catch (err) {
    return null;
  }
  const base = path.join(cypressCacheDir(), version);
  const app = process.platform === 'darwin'
    ? path.join(base, 'Cypress.app', 'Contents', 'Resources', 'app')
    : path.join(base, 'Cypress', 'resources', 'app');
  const dir = path.join(app, 'node_modules', 'mocha-junit-reporter');
  return fs.existsSync(path.join(dir, 'index.js')) ? dir : null;
}

(function r0() {
  const name = 'R0 bundled junit reporter throws on a repeated end';
  const dir = bundledReporterDir();
  if (!dir) {
    console.log('skip ' + name + ' (no bundled mocha-junit-reporter in the Cypress cache)');
    return;
  }
  let version = '?';
  try { version = require(path.join(dir, 'package.json')).version; } catch (err) { /* keep ? */ }
  const lines = [];
  try {
    withTmp((tmp) => {
      const Bundled = require(dir);
      const runner = makeRunner();
      const root = makeSuite('', undefined, 'cypress/integration/r0.spec.js');
      const suite = makeSuite('outer', root);
      const test = makeTest('passes', suite, 12, 'passed');
      captured(lines, () => new Bundled(runner, { reporterOptions: { mochaFile: path.join(tmp, 'junit-r0.xml') } }));
      emit(runner, lines, 'start');
      emit(runner, lines, 'suite', root);
      emit(runner, lines, 'suite', suite);
      emit(runner, lines, 'pass', test);
      emit(runner, lines, 'end');
      let thrown = null;
      try {
        emit(runner, lines, 'end');
      } catch (err) {
        thrown = err;
      }
      if (thrown && thrown instanceof TypeError && /_attr\.time\.toFixed is not a function/.test(thrown.message)) {
        console.log('ok   ' + name + ' (mocha-junit-reporter ' + version + ')');
      } else if (thrown) {
        failures++;
        console.log('FAIL ' + name + ' (mocha-junit-reporter ' + version + ' threw an unexpected error)');
      } else {
        console.log('note ' + name + ' (mocha-junit-reporter ' + version + ' no longer throws)');
      }
    });
  } catch (err) {
    failures++;
    console.log('FAIL ' + name + ' (mocha-junit-reporter ' + version + ' could not be driven)');
  }
})();

// ---------------------------------------------------------------------------
// J1..J7: the in-repo reporter
// ---------------------------------------------------------------------------

check('J1 cases sit in their own suite, totals tests 3 failures 1 skipped 1', () => withTmp((dir) => {
  const lines = [];
  const runner = makeRunner();
  const root = makeSuite('', undefined, 'cypress/integration/x.spec.js');
  const outer = makeSuite('outer', root);
  const t1 = makeTest('t1', outer, 10, 'passed');
  const nested = makeSuite('nested', outer);
  const t2 = makeTest('t2', nested, 20, 'failed');
  const t3 = makeTest('t3', outer, undefined, 'pending');
  newReporter(runner, dir, lines);
  emit(runner, lines, 'start');
  emit(runner, lines, 'suite', root);
  emit(runner, lines, 'suite', outer);
  emit(runner, lines, 'pass', t1);
  emit(runner, lines, 'suite', nested);
  emit(runner, lines, 'fail', t2, new Error('t2 broke'));
  emit(runner, lines, 'suite end', nested);
  emit(runner, lines, 'pending', t3);
  emit(runner, lines, 'suite end', outer);
  emit(runner, lines, 'suite end', root);
  emit(runner, lines, 'end');
  const files = xmlFiles(dir);
  assert(files.length === 1 && files[0] === 'junit-x.spec.js.xml', 'files: ' + files.join(','));
  const xml = fs.readFileSync(path.join(dir, files[0]), 'utf8');
  const top = rootTag(xml);
  assert(attr(top, 'tests') === '3' && attr(top, 'failures') === '1' && attr(top, 'skipped') === '1', 'totals: ' + top);
  const suites = testsuites(xml);
  const byName = Object.fromEntries(suites.map((s) => [attr(s.tag, 'name'), s.cases.map((c) => attr(c.tag, 'name'))]));
  assert(JSON.stringify(byName.outer) === JSON.stringify(['t1', 't3']), 'outer: ' + JSON.stringify(byName.outer));
  assert(JSON.stringify(byName['outer nested']) === JSON.stringify(['t2']), 'nested: ' + JSON.stringify(byName['outer nested']));
  const t2case = suites.find((s) => attr(s.tag, 'name') === 'outer nested').cases[0];
  assert(/<failure\s/.test(t2case.body), 't2 has no failure child');
  const t3case = suites.find((s) => attr(s.tag, 'name') === 'outer').cases[1];
  assert(/<skipped\s*\/>/.test(t3case.body), 't3 has no skipped child');
  assert(lines.filter((l) => l.startsWith('[junit-reporter] wrote ')).length === 1, 'write lines: ' + lines.length);
}));

check('J2 a repeated end rewrites one file with identical bytes', () => withTmp((dir) => {
  const lines = [];
  const runner = makeRunner();
  const root = makeSuite('', undefined, 'cypress/integration/device-detail.spec.js');
  const suite = makeSuite('Device Detail feature', root);
  const t = makeTest('passes', suite, 12, 'passed');
  newReporter(runner, dir, lines);
  emit(runner, lines, 'start');
  emit(runner, lines, 'suite', root);
  emit(runner, lines, 'suite', suite);
  emit(runner, lines, 'pass', t);
  emit(runner, lines, 'end');
  const files = xmlFiles(dir);
  assert(files.length === 1, 'files after first end: ' + files.join(','));
  const first = fs.readFileSync(path.join(dir, files[0]));
  emit(runner, lines, 'end');
  emit(runner, lines, 'end');
  const after = fs.readdirSync(dir);
  assert(after.length === 1 && after[0] === files[0], 'files after three ends: ' + after.join(','));
  assert(first.equals(fs.readFileSync(path.join(dir, files[0]))), 'bytes changed on a repeated end');
}));

check('J3 non-numeric durations give 0.000, 1234 ms gives 1.234', () => withTmp((dir) => {
  const lines = [];
  const runner = makeRunner();
  const root = makeSuite('', undefined, 'cypress/integration/durations.spec.js');
  const suite = makeSuite('durations', root);
  const values = { undef: undefined, nul: null, nan: NaN, str: '12', num: 1234 };
  const tests = Object.entries(values).map(([k, v]) => makeTest(k, suite, v, 'passed'));
  newReporter(runner, dir, lines);
  emit(runner, lines, 'start');
  emit(runner, lines, 'suite', root);
  emit(runner, lines, 'suite', suite);
  tests.forEach((t) => emit(runner, lines, 'pass', t));
  emit(runner, lines, 'end');
  const xml = fs.readFileSync(path.join(dir, xmlFiles(dir)[0]), 'utf8');
  const times = Object.fromEntries(testsuites(xml)[0].cases.map((c) => [attr(c.tag, 'name'), attr(c.tag, 'time')]));
  const want = { undef: '0.000', nul: '0.000', nan: '0.000', str: '0.000', num: '1.234' };
  assert(JSON.stringify(times) === JSON.stringify(want), JSON.stringify(times));
}));

check('J4 a hook failure copy is one testcase with a failure child', () => withTmp((dir) => {
  const lines = [];
  const runner = makeRunner();
  const root = makeSuite('', undefined, 'cypress/integration/device-detail.spec.js');
  const outer = makeSuite('Device Detail feature', root);
  const inner = makeSuite('once on the detail page', outer);
  const test = makeTest('Should display device info section (DEVI-11)', inner, undefined, 'failed');
  const hookTitle = '"before each" hook for "Should display device info section (DEVI-11)"';
  const copy = Object.assign({}, test, { title: hookTitle, fullTitle: test.fullTitle });
  newReporter(runner, dir, lines);
  emit(runner, lines, 'start');
  emit(runner, lines, 'suite', root);
  emit(runner, lines, 'suite', outer);
  emit(runner, lines, 'suite', inner);
  emit(runner, lines, 'fail', copy, new Error('cy.wait() timed out waiting for getBuildLog'));
  emit(runner, lines, 'end');
  const xml = fs.readFileSync(path.join(dir, xmlFiles(dir)[0]), 'utf8');
  const cases = testsuites(xml).flatMap((s) => s.cases);
  assert(cases.length === 1, 'cases: ' + cases.length);
  const escaped = '&quot;before each&quot; hook for &quot;Should display device info section (DEVI-11)&quot;';
  assert(attr(cases[0].tag, 'name') === escaped, 'name: ' + attr(cases[0].tag, 'name'));
  const failure = /<failure\s[^>]*>/.exec(cases[0].body);
  assert(failure && attr(failure[0], 'message') === 'cy.wait() timed out waiting for getBuildLog', 'failure: ' + cases[0].body.slice(0, 120));
}));

check('J5 escaping, ANSI sequences and control code units', () => withTmp((dir) => {
  const lines = [];
  const runner = makeRunner();
  const root = makeSuite('', undefined, 'cypress/integration/escape.spec.js');
  const nasty = 'a<b>c&d"e\'f ' + String.fromCharCode(27) + '[31mred' + String.fromCharCode(27) + '[0m '
    + String.fromCharCode(1) + 'x' + String.fromCharCode(8) + 'y';
  const suite = makeSuite('suite ' + nasty, root);
  const t = makeTest('test ' + nasty, suite, 5, 'failed');
  const err = new Error('message ' + nasty + '\nsecond line');
  err.stack = 'Error: stack ' + nasty + '\n    at here';
  newReporter(runner, dir, lines);
  emit(runner, lines, 'start');
  emit(runner, lines, 'suite', root);
  emit(runner, lines, 'suite', suite);
  emit(runner, lines, 'fail', t, err);
  emit(runner, lines, 'end');
  const xml = fs.readFileSync(path.join(dir, xmlFiles(dir)[0]), 'utf8');
  for (const entity of ['&lt;', '&gt;', '&amp;', '&quot;', '&apos;']) {
    assert(xml.includes(entity), 'missing ' + entity);
  }
  assert(xml.includes('test a&lt;b&gt;c&amp;d&quot;e&apos;f red xy'), 'test name not cleaned as expected');
  for (let i = 0; i < xml.length; i++) {
    const c = xml.charCodeAt(i);
    assert(c !== 0x1B, 'ESC code unit at ' + i);
    assert(c >= 0x20 || c === 0x09 || c === 0x0A || c === 0x0D, 'control code unit 0x' + c.toString(16) + ' at ' + i);
  }
}));

check('J6 a write error is logged once and never thrown', () => withTmp((dir) => {
  const lines = [];
  const blocker = path.join(dir, 'blocker');
  fs.writeFileSync(blocker, 'a regular file');
  const runner = makeRunner();
  const root = makeSuite('', undefined, 'cypress/integration/write.spec.js');
  const suite = makeSuite('write', root);
  const t = makeTest('passes', suite, 1, 'passed');
  newReporter(runner, dir, lines, path.join(blocker, 'junit-[spec].xml'));
  emit(runner, lines, 'start');
  emit(runner, lines, 'suite', root);
  emit(runner, lines, 'suite', suite);
  emit(runner, lines, 'pass', t);
  emit(runner, lines, 'end');
  const errs = lines.filter((l) => l.startsWith('[junit-reporter] could not write'));
  assert(errs.length === 1, 'could-not-write lines: ' + errs.length);
}));

check('J7 a root suite without a file writes junit-spec-<n>.xml', () => withTmp((dir) => {
  const lines = [];
  const runner = makeRunner();
  const root = makeSuite('', undefined, undefined);
  const suite = makeSuite('anonymous', root);
  const t = makeTest('passes', suite, 1, 'passed');
  newReporter(runner, dir, lines);
  emit(runner, lines, 'start');
  emit(runner, lines, 'suite', root);
  emit(runner, lines, 'suite', suite);
  emit(runner, lines, 'pass', t);
  emit(runner, lines, 'end');
  const files = xmlFiles(dir);
  assert(files.length === 1 && /^junit-spec-\d+\.xml$/.test(files[0]), 'files: ' + files.join(','));
}));

process.exit(failures ? 1 : 0);
