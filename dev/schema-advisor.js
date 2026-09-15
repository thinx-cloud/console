#!/usr/bin/env node
/*
 * Schema Evolution Advisor
 * ------------------------
 * A zero-dependency Node dev tool that protects the THiNX console (both the
 * Vue 2 client and the legacy AngularJS client) against breaking backend API
 * schema drift.
 *
 * The authoritative database schema lives in the parent `thinx-device-api`
 * repository, not here. This repo is a UI *consumer* of that schema, so the
 * advisor reasons about schema evolution from the consumer's contract
 * perspective: it statically extracts the per-entity field sets the console
 * actually reads, snapshots them into a committed baseline, and diffs the live
 * code against that baseline to classify and severity-rank changes.
 *
 * Usage:
 *   node dev/schema-advisor.js            Diff live code vs the committed baseline.
 *                                         Exits non-zero if breaking changes are found.
 *   node dev/schema-advisor.js --update   Re-extract and overwrite the baseline +
 *                                         report from the current code. Always exits 0.
 *   node dev/schema-advisor.js --json     Print the extracted model as JSON and exit.
 *   node dev/schema-advisor.js --help     Show usage.
 *
 * Design notes / intentional limitations (kept deliberately conservative):
 *   - Field extraction is heuristic, not a full JS/AST parse. It relies on two
 *     high-signal sources: Vuex `headers[].prop` declarations and member-access
 *     expressions (`alias.field`) on a small, curated set of item aliases per
 *     source file. This favours precision (few false fields) over recall.
 *   - Inferred types are name-heuristic only (see inferType). They exist to
 *     catch obvious TYPE-CHANGED drift, not to be authoritative.
 *   - RENAMED detection is a similarity heuristic over the REMOVED/ADDED sets.
 *   - Write payloads (request params like `udids`, `fingerprints`) are
 *     intentionally NOT treated as entity fields -- they are request shapes,
 *     not read contract, and including them would pollute the field sets.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'schema-baseline.json');
const REPORT_PATH = path.join(__dirname, 'SCHEMA_ADVISOR.md');

// ---------------------------------------------------------------------------
// Entity contract configuration
// ---------------------------------------------------------------------------
// Each entity lists the source files the console uses to consume it, the API
// path it maps to, and (per source) the variable aliases that hold a single
// instance of that entity. Member accesses on those aliases are extracted as
// fields. `headers: true` additionally harvests Vuex `prop:` declarations.
const ENTITIES = [
  {
    entity: 'devices',
    apiPath: '/device',
    sources: [
      { file: 'vue/src/store/devices.js', client: 'vue', headers: true, aliases: ['item', 'd'] },
      { file: 'src/app/js/controllers/DeviceController.js', client: 'legacy', aliases: ['device'] },
      { file: 'src/app/js/controllers/DevicesController.js', client: 'legacy', aliases: ['device', 'd'] },
    ],
  },
  {
    entity: 'apikeys',
    apiPath: '/apikey',
    sources: [
      { file: 'vue/src/store/apikeys.js', client: 'vue', headers: true, aliases: ['item'] },
      { file: 'src/app/js/controllers/ApikeyController.js', client: 'legacy', aliases: ['apikey', 'key'] },
    ],
  },
  {
    entity: 'rsakeys',
    apiPath: '/rsakey',
    sources: [
      { file: 'vue/src/store/rsakeys.js', client: 'vue', headers: true, aliases: ['item'] },
      { file: 'src/app/js/controllers/DeploykeyController.js', client: 'legacy', aliases: ['key', 'rsakey', 'deploykey'] },
    ],
  },
  {
    entity: 'channels',
    apiPath: '/mesh',
    sources: [
      { file: 'vue/src/store/channels.js', client: 'vue', headers: true, aliases: ['item'] },
      { file: 'src/app/js/controllers/ChannelController.js', client: 'legacy', aliases: ['channel', 'mesh', 'item'] },
    ],
  },
  {
    entity: 'enviros',
    apiPath: '/env',
    sources: [
      { file: 'vue/src/store/enviros.js', client: 'vue', headers: true, aliases: ['item'] },
      { file: 'src/app/js/controllers/EnviroController.js', client: 'legacy', aliases: ['env', 'enviro', 'item'] },
    ],
  },
  {
    entity: 'profile',
    apiPath: '/profile',
    sources: [
      { file: 'vue/src/store/profile.js', client: 'vue', aliases: ['profile', 'info'] },
      { file: 'src/app/js/controllers/UserProfileController.js', client: 'legacy', aliases: ['profile', 'info', 'user'] },
    ],
  },
];

// Identifiers that are JS built-ins, framework internals, or local plumbing --
// never real entity fields. Filtered out of member-access extraction.
const DENYLIST = new Set([
  'length', 'slice', 'substr', 'substring', 'map', 'filter', 'forEach', 'find',
  'findIndex', 'push', 'pop', 'shift', 'keys', 'values', 'entries', 'join',
  'split', 'toString', 'toFixed', 'includes', 'indexOf', 'lastIndexOf',
  'replace', 'trim', 'charAt', 'concat', 'then', 'catch', 'reduce', 'some',
  'every', 'sort', 'reverse', 'apply', 'call', 'bind', 'hasOwnProperty',
  'randomUUID', 'now', 'parse', 'stringify', 'toUpperCase', 'toLowerCase',
  'startsWith', 'endsWith', 'padStart', 'padEnd', 'match', 'test',
  'success', 'response', 'items', 'dispatch', 'commit', 'state', 'getters',
  'rootState', 'rootGetters', 'payload', 'data', 'result',
]);

const TYPE_HINTS = {
  string: new Set([
    'udid', 'id', 'hash', 'key', 'name', 'alias', 'fingerprint', 'pubkey',
    'filename', 'mesh_id', 'platform', 'base_platform', 'firmware', 'status',
    'url', 'branch', 'owner', 'username', 'first_name', 'last_name', 'email',
    'avatar', 'test_avatar', 'icon', 'category', 'description', 'source',
    'source_id', 'keyhash', 'timezone_abbr', 'message', 'mobile_phone',
    'environment', 'label', 'display', 'body',
  ]),
  date: new Set(['date', 'last_update', 'timestamp']),
  array: new Set([
    'tags', 'goals', 'transformers', 'mesh_ids', 'env_vars', 'log', 'logs',
  ]),
  object: new Set(['security', 'notifications', 'info', 'changes']),
  boolean: new Set(['auto_update', 'admin', 'important_notifications']),
  number: new Set(['timezone_offset']),
};

function inferType(name) {
  for (const [type, set] of Object.entries(TYPE_HINTS)) {
    if (set.has(name)) return type;
  }
  if (/(^|_)date$/.test(name)) return 'date';
  if (/_ids$/.test(name)) return 'array';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------
function stripCommentsAndStrings(src) {
  // Remove block/line comments and string literals (replace with spaces) so we
  // never extract fields from documentation blocks or string contents.
  const SLASH = 47, STAR = 42, DQUOTE = 34, SQUOTE = 39, BTICK = 96, BSLASH = 92;
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src.charCodeAt(i);
    const c2 = src.charCodeAt(i + 1);
    if (c === SLASH && c2 === STAR) {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === SLASH && c2 === SLASH) {
      const end = src.indexOf('\n', i + 2);
      i = end === -1 ? n : end;
      continue;
    }
    if (c === DQUOTE || c === SQUOTE || c === BTICK) {
      i++;
      while (i < n && src.charCodeAt(i) !== c) {
        if (src.charCodeAt(i) === BSLASH) i++;
        i++;
      }
      i++;
      out += ' ';
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

function stripComments(src) {
  // Remove block and line comments only; keep string literals intact so that
  // active header prop: declarations are seen but commented-out config is not.
  const SLASH = 47, STAR = 42, DQUOTE = 34, SQUOTE = 39, BTICK = 96, BSLASH = 92;
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src.charCodeAt(i);
    const c2 = src.charCodeAt(i + 1);
    if (c === SLASH && c2 === STAR) {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === SLASH && c2 === SLASH) {
      const end = src.indexOf('\n', i + 2);
      i = end === -1 ? n : end;
      continue;
    }
    if (c === DQUOTE || c === SQUOTE || c === BTICK) {
      const start = i;
      i++;
      while (i < n && src.charCodeAt(i) !== c) {
        if (src.charCodeAt(i) === BSLASH) i++;
        i++;
      }
      i++;
      out += src.slice(start, i);
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

function extractHeaderProps(rawSrc) {
  // Header props are declared as string literals (e.g. prop: 'alias').
  // \x27 = single quote, \x22 = double quote.
  rawSrc = stripComments(rawSrc);
  const props = new Set();
  const re = /\bprop\s*:\s*[\x27\x22]([A-Za-z_][A-Za-z0-9_]*)[\x27\x22]/g;
  let m;
  while ((m = re.exec(rawSrc)) !== null) {
    props.add(m[1]);
  }
  return props;
}

function extractAliasFields(code, aliases) {
  // Member accesses on a known alias: device.platform, item.alias, ...
  const fields = new Set();
  for (const alias of aliases) {
    const re = new RegExp('\\b' + alias + '\\.([A-Za-z_][A-Za-z0-9_]*)', 'g');
    let m;
    while ((m = re.exec(code)) !== null) {
      const field = m[1];
      if (!DENYLIST.has(field)) fields.add(field);
    }
  }
  return fields;
}

function extractEntity(entity) {
  // fieldName -> Set of consumer tags (client:basename)
  const fieldConsumers = new Map();
  const missingSources = [];

  for (const source of entity.sources) {
    const abs = path.join(ROOT, source.file);
    if (!fs.existsSync(abs)) {
      missingSources.push(source.file);
      continue;
    }
    const raw = fs.readFileSync(abs, 'utf8');
    const code = stripCommentsAndStrings(raw);
    const tag = source.client + ':' + path.basename(source.file);

    const found = new Set();
    if (source.headers) {
      for (const p of extractHeaderProps(raw)) found.add(p);
    }
    for (const f of extractAliasFields(code, source.aliases || [])) found.add(f);

    for (const field of found) {
      if (!fieldConsumers.has(field)) fieldConsumers.set(field, new Set());
      fieldConsumers.get(field).add(tag);
    }
  }

  const fields = {};
  for (const name of [...fieldConsumers.keys()].sort()) {
    fields[name] = {
      inferredType: inferType(name),
      consumers: [...fieldConsumers.get(name)].sort(),
    };
  }

  return { apiPath: entity.apiPath, fields, missingSources };
}

function buildModel() {
  const entities = {};
  const warnings = [];
  for (const entity of ENTITIES) {
    const extracted = extractEntity(entity);
    if (extracted.missingSources.length) {
      warnings.push(
        'Entity "' + entity.entity + '": missing source file(s): ' + extracted.missingSources.join(', ')
      );
    }
    entities[entity.entity] = {
      apiPath: extracted.apiPath,
      fields: extracted.fields,
    };
  }
  return {
    schemaAdvisorVersion: 1,
    description:
      'Console consumer-side field contract per API entity. Generated by dev/schema-advisor.js. ' +
      'Heuristic and conservative -- see the script header for limitations.',
    entities,
    _warnings: warnings,
  };
}

// ---------------------------------------------------------------------------
// Diffing
// ---------------------------------------------------------------------------
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

const RENAME_THRESHOLD = 0.6;

function diffEntity(name, baseFields, liveFields) {
  baseFields = baseFields || {};
  liveFields = liveFields || {};
  const baseNames = Object.keys(baseFields);
  const liveNames = Object.keys(liveFields);

  let removed = baseNames.filter((f) => !(f in liveFields));
  let added = liveNames.filter((f) => !(f in baseFields));
  const changes = [];

  // RENAMED heuristic: greedily pair the most-similar removed/added fields.
  const renamed = [];
  const candidates = [];
  for (const r of removed) {
    for (const a of added) {
      const s = similarity(r, a);
      if (s >= RENAME_THRESHOLD) candidates.push({ r, a, s });
    }
  }
  candidates.sort((x, y) => y.s - x.s);
  const usedR = new Set();
  const usedA = new Set();
  for (const c of candidates) {
    if (usedR.has(c.r) || usedA.has(c.a)) continue;
    usedR.add(c.r);
    usedA.add(c.a);
    renamed.push(c);
  }
  removed = removed.filter((f) => !usedR.has(f));
  added = added.filter((f) => !usedA.has(f));

  for (const r of renamed) {
    changes.push({
      kind: 'RENAMED',
      severity: 'breaking',
      entity: name,
      field: r.r,
      to: r.a,
      detail: 'field "' + r.r + '" appears renamed to "' + r.a + '" (similarity ' + r.s.toFixed(2) + ')',
    });
  }
  for (const f of removed) {
    changes.push({
      kind: 'REMOVED',
      severity: 'breaking',
      entity: name,
      field: f,
      detail: 'field "' + f + '" (consumed by ' + baseFields[f].consumers.join(', ') + ') is no longer extracted',
    });
  }
  for (const f of added) {
    changes.push({
      kind: 'ADDED',
      severity: 'info',
      entity: name,
      field: f,
      detail: 'new field "' + f + '" (' + liveFields[f].inferredType + ') consumed by ' + liveFields[f].consumers.join(', '),
    });
  }
  // TYPE-CHANGED on surviving fields.
  for (const f of baseNames) {
    if (f in liveFields) {
      const bt = baseFields[f].inferredType;
      const lt = liveFields[f].inferredType;
      if (bt !== lt) {
        changes.push({
          kind: 'TYPE-CHANGED',
          severity: 'breaking',
          entity: name,
          field: f,
          detail: 'inferred type of "' + f + '" changed: ' + bt + ' -> ' + lt,
        });
      }
    }
  }
  return changes;
}

function diffModels(baseline, live) {
  const changes = [];
  const baseEntities = baseline.entities || {};
  const liveEntities = live.entities || {};
  const allNames = new Set([...Object.keys(baseEntities), ...Object.keys(liveEntities)]);
  for (const name of [...allNames].sort()) {
    const b = baseEntities[name];
    const l = liveEntities[name];
    if (b && !l) {
      changes.push({
        kind: 'REMOVED',
        severity: 'breaking',
        entity: name,
        field: '(entire entity)',
        detail: 'entity "' + name + '" is no longer present in the live model',
      });
      continue;
    }
    if (!b && l) {
      changes.push({
        kind: 'ADDED',
        severity: 'info',
        entity: name,
        field: '(entire entity)',
        detail: 'new entity "' + name + '" present in the live model',
      });
      continue;
    }
    changes.push(...diffEntity(name, b.fields, l.fields));
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function countFields(model) {
  let total = 0;
  for (const e of Object.values(model.entities)) total += Object.keys(e.fields).length;
  return total;
}

function renderMarkdown(model, changes, mode) {
  const breaking = changes.filter((c) => c.severity === 'breaking');
  const info = changes.filter((c) => c.severity === 'info');
  const lines = [];

  lines.push('# Schema Evolution Advisor Report');
  lines.push('');
  lines.push('> Generated by `dev/schema-advisor.js`. Do not edit by hand.');
  lines.push('');
  lines.push('- **Mode:** ' + mode);
  lines.push('- **Entities tracked:** ' + Object.keys(model.entities).length);
  lines.push('- **Fields tracked:** ' + countFields(model));
  if (mode === 'diff') {
    lines.push('- **Breaking changes:** ' + breaking.length);
    lines.push('- **Informational changes:** ' + info.length);
    lines.push('- **Verdict:** ' + (breaking.length ? 'BREAKING DRIFT DETECTED' : 'no breaking drift'));
  }
  lines.push('');

  if (mode === 'diff') {
    if (!changes.length) {
      lines.push('No schema drift detected against the committed baseline.');
      lines.push('');
    } else {
      if (breaking.length) {
        lines.push('## Breaking changes');
        lines.push('');
        lines.push('| Entity | Field | Kind | Detail |');
        lines.push('| --- | --- | --- | --- |');
        for (const c of breaking) {
          lines.push('| ' + c.entity + ' | `' + c.field + '`' + (c.to ? ' -> `' + c.to + '`' : '') + ' | ' + c.kind + ' | ' + c.detail + ' |');
        }
        lines.push('');
      }
      if (info.length) {
        lines.push('## Informational changes');
        lines.push('');
        lines.push('| Entity | Field | Kind | Detail |');
        lines.push('| --- | --- | --- | --- |');
        for (const c of info) {
          lines.push('| ' + c.entity + ' | `' + c.field + '` | ' + c.kind + ' | ' + c.detail + ' |');
        }
        lines.push('');
      }
    }
  }

  lines.push('## Current contract snapshot');
  lines.push('');
  for (const name of Object.keys(model.entities).sort()) {
    const e = model.entities[name];
    lines.push('### ' + name + ' `' + e.apiPath + '`');
    lines.push('');
    const fieldNames = Object.keys(e.fields);
    if (!fieldNames.length) {
      lines.push('_No fields extracted._');
      lines.push('');
      continue;
    }
    lines.push('| Field | Inferred type | Consumers |');
    lines.push('| --- | --- | --- |');
    for (const fn of fieldNames.sort()) {
      const f = e.fields[fn];
      lines.push('| `' + fn + '` | ' + f.inferredType + ' | ' + f.consumers.join(', ') + ' |');
    }
    lines.push('');
  }

  if (model._warnings && model._warnings.length) {
    lines.push('## Warnings');
    lines.push('');
    for (const w of model._warnings) lines.push('- ' + w);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    'Field extraction is heuristic and conservative (Vuex header `prop`s + curated ' +
    'item-alias member accesses across the Vue and legacy AngularJS clients). ' +
    'Inferred types are name-based heuristics. See `dev/schema-advisor.js` for details.'
  );
  lines.push('');
  return lines.join('\n');
}

function renderConsole(model, changes, mode) {
  const breaking = changes.filter((c) => c.severity === 'breaking');
  const info = changes.filter((c) => c.severity === 'info');
  const out = [];
  out.push('Schema Evolution Advisor');
  out.push('========================');
  out.push('Entities: ' + Object.keys(model.entities).length + '  Fields: ' + countFields(model));
  if (mode === 'diff') {
    if (!changes.length) {
      out.push('Result: no schema drift detected against baseline. OK');
    } else {
      for (const c of breaking) out.push('  [BREAKING] ' + c.kind + ' ' + c.entity + '.' + c.field + (c.to ? ' -> ' + c.to : '') + ': ' + c.detail);
      for (const c of info) out.push('  [info]     ' + c.kind + ' ' + c.entity + '.' + c.field + ': ' + c.detail);
      out.push('');
      out.push('Breaking: ' + breaking.length + '  Info: ' + info.length);
      out.push(breaking.length ? 'Result: BREAKING schema drift detected.' : 'Result: only informational drift. OK');
    }
  }
  for (const w of model._warnings || []) out.push('  (warning) ' + w);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// JSON serialisation (stable key order for clean diffs)
// ---------------------------------------------------------------------------
function stableStringify(model) {
  const ordered = {
    schemaAdvisorVersion: model.schemaAdvisorVersion,
    description: model.description,
    entities: {},
  };
  for (const name of Object.keys(model.entities).sort()) {
    const e = model.entities[name];
    const fields = {};
    for (const fn of Object.keys(e.fields).sort()) fields[fn] = e.fields[fn];
    ordered.entities[name] = { apiPath: e.apiPath, fields };
  }
  return JSON.stringify(ordered, null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function printHelp() {
  console.log(
    [
      'Schema Evolution Advisor',
      '',
      'Usage:',
      '  node dev/schema-advisor.js            Diff live code vs committed baseline (CI gate).',
      '  node dev/schema-advisor.js --update   Overwrite baseline + report from current code.',
      '  node dev/schema-advisor.js --json     Print extracted model as JSON.',
      '  node dev/schema-advisor.js --help     Show this help.',
      '',
      'Exit codes: 0 = ok / no breaking drift, 1 = breaking drift or error.',
    ].join('\n')
  );
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const model = buildModel();

  if (args.includes('--json')) {
    process.stdout.write(stableStringify(model));
    process.exit(0);
  }

  if (args.includes('--update')) {
    fs.writeFileSync(BASELINE_PATH, stableStringify(model));
    const md = renderMarkdown(model, [], 'baseline');
    fs.writeFileSync(REPORT_PATH, md);
    console.log('Baseline written to ' + path.relative(ROOT, BASELINE_PATH));
    console.log('Report written to   ' + path.relative(ROOT, REPORT_PATH));
    console.log(renderConsole(model, [], 'baseline'));
    process.exit(0);
  }

  // Default: diff against baseline.
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(
      'No baseline found at ' + path.relative(ROOT, BASELINE_PATH) + '.\n' +
      'Run `node dev/schema-advisor.js --update` to create one.'
    );
    process.exit(1);
  }

  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (err) {
    console.error('Failed to parse baseline: ' + err.message);
    process.exit(1);
  }

  const changes = diffModels(baseline, model);
  const md = renderMarkdown(model, changes, 'diff');
  fs.writeFileSync(REPORT_PATH, md);
  console.log(renderConsole(model, changes, 'diff'));
  console.log('\nReport written to ' + path.relative(ROOT, REPORT_PATH));

  const breaking = changes.filter((c) => c.severity === 'breaking');
  process.exit(breaking.length ? 1 : 0);
}

main();
