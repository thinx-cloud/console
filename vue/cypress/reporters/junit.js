// JUnit reporter for `cypress run` in CI (v1.18 Phase 48, plan 48-07, CI-07).
//
// Why it exists: Cypress 9.7.0's bundled mocha-junit-reporter 2.0.0 formats every testcase
// time in place when it writes, so a second `end` event on the same reporter calls a number
// method on a string and throws. In CircleCI pipeline 5675 (job 16066) a browser relaunch
// made more than one runner report into one reporter, the second `end` threw, and that
// uncaught error ended the whole run after spec 5.
//
// This reporter keeps plain records with numeric times and renders the XML from them on
// every `end`, so a repeated `end` rewrites the same file with the same bytes. It writes one
// deterministic file per spec (mochaFile with [spec] = the spec file's basename), keeps every
// pass / fail / pending event as it came (no de-duplication, so a later pass cannot hide an
// earlier failure) and catches and logs its own errors: it never throws into Cypress.
// Node built-ins only; no npm dependency.
//
// `cy:test:ci` in package.json loads it by path:
//   cypress run --reporter cypress/reporters/junit.js --reporter-options 'mochaFile=...'
// Cypress constructs it once per spec as `new Reporter(runner, { reporterOptions })` in its
// server process. Unit checks: tests/unit/cypress-junit-reporter.cjs.

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MOCHA_FILE = 'cypress/results/junit-[spec].xml';
const LOG_PREFIX = '[junit-reporter]';

let anonymousSpecs = 0;

// Attribute values and text nodes: drop ANSI CSI sequences, control code units other than
// tab / LF / CR and the non-characters U+FFFE / U+FFFF, then escape the five XML specials.
// Code units are compared as numbers on purpose (no control characters in a regex literal,
// Codacy no-control-regex; same approach as src/utils/keyNames.js).
function clean(value) {
  const s = String(value ?? '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x1B) {
      // CSI: ESC '[' parameter / intermediate bytes (0x20..0x3F) then one final byte (0x40..0x7E).
      if (s.charCodeAt(i + 1) === 0x5B) {
        let j = i + 2;
        while (j < s.length && s.charCodeAt(j) >= 0x20 && s.charCodeAt(j) <= 0x3F) j++;
        if (j < s.length && s.charCodeAt(j) >= 0x40 && s.charCodeAt(j) <= 0x7E) {
          i = j;
          continue;
        }
      }
      continue; // a lone ESC is a control code unit: drop it
    }
    if (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D) continue;
    if (c === 0xFFFE || c === 0xFFFF) continue;
    if (c === 0x26) out += '&amp;';
    else if (c === 0x3C) out += '&lt;';
    else if (c === 0x3E) out += '&gt;';
    else if (c === 0x22) out += '&quot;';
    else if (c === 0x27) out += '&apos;';
    else out += s[i];
  }
  return out;
}

function seconds(ms) {
  return (ms / 1000).toFixed(3);
}

function attrs(pairs) {
  return pairs.map(([k, v]) => ' ' + k + '="' + clean(v) + '"').join('');
}

// Pure: records -> XML string. A record is { name, file, timestamp, cases }, a case is
// { name, classname, file, ms, failure: { message, type, body } | null, skipped }.
function renderXml(records) {
  const suites = records.filter((r) => r.cases.length > 0);
  const count = (cases, pick) => cases.filter(pick).length;
  const sum = (cases) => cases.reduce((t, c) => t + c.ms, 0);
  const all = suites.flatMap((r) => r.cases);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  lines.push('<testsuites' + attrs([
    ['name', 'Cypress'],
    ['tests', all.length],
    ['failures', count(all, (c) => c.failure)],
    ['skipped', count(all, (c) => c.skipped)],
    ['time', seconds(sum(all))],
  ]) + '>');
  for (const r of suites) {
    lines.push('  <testsuite' + attrs([
      ['name', r.name],
      ['file', r.file],
      ['timestamp', r.timestamp],
      ['tests', r.cases.length],
      ['failures', count(r.cases, (c) => c.failure)],
      ['skipped', count(r.cases, (c) => c.skipped)],
      ['time', seconds(sum(r.cases))],
    ]) + '>');
    for (const c of r.cases) {
      const open = '    <testcase' + attrs([
        ['name', c.name],
        ['classname', c.classname],
        ['file', c.file],
        ['time', seconds(c.ms)],
      ]);
      if (c.failure) {
        lines.push(open + '>');
        lines.push('      <failure' + attrs([['message', c.failure.message], ['type', c.failure.type]]) + '>'
          + clean(c.failure.body) + '</failure>');
        lines.push('    </testcase>');
      } else if (c.skipped) {
        lines.push(open + '>');
        lines.push('      <skipped/>');
        lines.push('    </testcase>');
      } else {
        lines.push(open + '/>');
      }
    }
    lines.push('  </testsuite>');
  }
  lines.push('</testsuites>');
  return lines.join('\n') + '\n';
}

function safeCall(fn, fallback) {
  try {
    const v = fn();
    return v === undefined ? fallback : v;
  } catch (err) {
    return fallback;
  }
}

function suiteTitle(suite) {
  const full = safeCall(() => (typeof suite.fullTitle === 'function' ? suite.fullTitle() : undefined), undefined);
  if (typeof full === 'string' && full) return full;
  const parts = [];
  for (let s = suite; s && !s.root; s = s.parent) {
    if (s.title) parts.unshift(String(s.title));
  }
  return parts.join(' ');
}

function rootOf(runnable) {
  let node = runnable;
  for (let guard = 0; node && node.parent && !node.root && guard < 1000; guard++) node = node.parent;
  return node && node.root ? node : null;
}

function JunitReporter(runner, options) {
  const opts = (options && options.reporterOptions) || {};
  this.mochaFile = typeof opts.mochaFile === 'string' && opts.mochaFile ? opts.mochaFile : DEFAULT_MOCHA_FILE;
  this.records = new Map();
  this.rootFile = undefined;
  this.specLabel = undefined;
  this.target = undefined;

  const guard = (event, fn) => (...args) => {
    try {
      fn(...args);
    } catch (err) {
      console.error(LOG_PREFIX + ' could not record ' + event + ': ' + (err && err.message));
    }
  };

  runner.on('suite', guard('suite', (suite) => {
    if (!suite) return;
    if (suite.root) {
      if (this.rootFile === undefined && suite.file) this.rootFile = String(suite.file);
      return;
    }
    this.recordFor(suite);
  }));
  runner.on('pass', guard('pass', (test) => this.addCase(test, null, false)));
  runner.on('fail', guard('fail', (test, err) => this.addCase(test, err || {}, false)));
  runner.on('pending', guard('pending', (test) => this.addCase(test, null, true)));
  runner.on('end', () => this.write());
}

JunitReporter.prototype.file = function () {
  return this.rootFile === undefined ? '' : this.rootFile;
};

JunitReporter.prototype.label = function () {
  if (this.specLabel === undefined) {
    this.specLabel = this.rootFile ? path.basename(this.rootFile) : 'spec-' + (++anonymousSpecs);
  }
  return this.specLabel;
};

JunitReporter.prototype.recordFor = function (suite) {
  const key = suite || this;
  let record = this.records.get(key);
  if (!record) {
    if (suite && this.rootFile === undefined) {
      const root = rootOf(suite);
      if (root && root.file) this.rootFile = String(root.file);
    }
    record = {
      name: !suite || suite.root ? this.label() : suiteTitle(suite),
      file: this.file(),
      timestamp: new Date().toISOString().slice(0, 19),
      cases: [],
    };
    this.records.set(key, record);
  }
  return record;
};

JunitReporter.prototype.addCase = function (test, err, skipped) {
  const t = test || {};
  const record = this.recordFor(t.parent);
  const ms = typeof t.duration === 'number' && Number.isFinite(t.duration) && t.duration >= 0 ? t.duration : 0;
  let failure = null;
  if (err) {
    const message = String(err.message ?? '').split('\n')[0];
    failure = {
      message,
      type: err.name ?? '',
      body: err.stack || String(err.message ?? ''),
    };
  }
  record.cases.push({
    name: String(t.title ?? ''),
    classname: record.name,
    file: record.file,
    ms,
    failure,
    skipped: !!skipped,
  });
};

JunitReporter.prototype.write = function () {
  let shown = this.mochaFile;
  try {
    if (this.target === undefined) {
      this.target = path.resolve(this.mochaFile.split('[spec]').join(this.label()));
    }
    shown = path.relative(process.cwd(), this.target) || this.target;
    const records = Array.from(this.records.values());
    const xml = renderXml(records);
    fs.mkdirSync(path.dirname(this.target), { recursive: true });
    fs.writeFileSync(this.target, xml, 'utf8');
    const cases = records.flatMap((r) => r.cases);
    console.log(LOG_PREFIX + ' wrote ' + shown + ' (' + cases.length + ' tests, '
      + cases.filter((c) => c.failure).length + ' failures, '
      + cases.filter((c) => c.skipped).length + ' skipped)');
  } catch (err) {
    try {
      console.error(LOG_PREFIX + ' could not write ' + shown + ': ' + (err && err.message));
    } catch (ignored) {
      // never throw into Cypress
    }
  }
};

JunitReporter.renderXml = renderXml;

module.exports = JunitReporter;
