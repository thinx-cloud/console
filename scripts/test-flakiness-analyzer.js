#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, '.flakiness-reports');
const DEFAULT_RUNS = 5;
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

const PROJECTS = {
  vue: {
    name: 'vue',
    packageDir: path.join(ROOT_DIR, 'vue'),
    cypressDir: path.join(ROOT_DIR, 'vue', 'cypress'),
    fixturePath: path.join(ROOT_DIR, 'vue', 'cypress', 'fixtures', 'thinx.json'),
    cypressBin: path.join(ROOT_DIR, 'vue', 'node_modules', '.bin', process.platform === 'win32' ? 'cypress.cmd' : 'cypress'),
    credentialKeys: {
      user: ['CYPRESS_THINX_TEST_USER', 'THINX_TEST_USER', 'CYPRESS_LOGIN_USERNAME', 'LOGIN_USERNAME'],
      password: ['CYPRESS_THINX_TEST_PASSWORD', 'THINX_TEST_PASSWORD', 'CYPRESS_LOGIN_PASSWORD', 'LOGIN_PASSWORD']
    }
  },
  src: {
    name: 'src',
    packageDir: path.join(ROOT_DIR, 'src'),
    cypressDir: path.join(ROOT_DIR, 'src', 'cypress'),
    fixturePath: path.join(ROOT_DIR, 'src', 'cypress', 'fixtures', 'thinx.json'),
    cypressBin: path.join(ROOT_DIR, 'src', 'node_modules', '.bin', process.platform === 'win32' ? 'cypress.cmd' : 'cypress'),
    credentialKeys: {
      user: ['CYPRESS_THINX_TEST_USER', 'THINX_TEST_USER'],
      password: ['CYPRESS_THINX_TEST_PASSWORD', 'THINX_TEST_PASSWORD']
    }
  }
};

function parseArgs(argv) {
  const options = {
    project: process.env.FLAKE_PROJECT || 'all',
    runs: numberFrom(process.env.FLAKE_RUNS, DEFAULT_RUNS),
    spec: process.env.FLAKE_SPEC || '',
    outDir: process.env.FLAKE_OUT_DIR || DEFAULT_OUT_DIR,
    staticOnly: boolFrom(process.env.FLAKE_STATIC_ONLY, false),
    skipDynamicWithoutCredentials: boolFrom(process.env.FLAKE_SKIP_DYNAMIC_WITHOUT_CREDS, true),
    failOnStaticErrors: boolFrom(process.env.FLAKE_FAIL_ON_STATIC_ERRORS, true),
    requireDynamic: boolFrom(process.env.FLAKE_REQUIRE_DYNAMIC, false),
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--project') {
      options.project = next();
    } else if (arg.startsWith('--project=')) {
      options.project = arg.slice('--project='.length);
    } else if (arg === '--runs') {
      options.runs = numberFrom(next(), DEFAULT_RUNS);
    } else if (arg.startsWith('--runs=')) {
      options.runs = numberFrom(arg.slice('--runs='.length), DEFAULT_RUNS);
    } else if (arg === '--spec') {
      options.spec = next();
    } else if (arg.startsWith('--spec=')) {
      options.spec = arg.slice('--spec='.length);
    } else if (arg === '--out-dir') {
      options.outDir = next();
    } else if (arg.startsWith('--out-dir=')) {
      options.outDir = arg.slice('--out-dir='.length);
    } else if (arg === '--static-only' || arg === '--scan-only' || arg === '--skip-dynamic') {
      options.staticOnly = true;
    } else if (arg === '--run-dynamic') {
      options.staticOnly = false;
    } else if (arg === '--skip-dynamic-without-credentials') {
      options.skipDynamicWithoutCredentials = true;
    } else if (arg === '--run-without-credentials' || arg === '--no-skip-dynamic-without-credentials') {
      options.skipDynamicWithoutCredentials = false;
    } else if (arg === '--no-fail-on-static') {
      options.failOnStaticErrors = false;
    } else if (arg === '--fail-on-static') {
      options.failOnStaticErrors = true;
    } else if (arg === '--require-dynamic') {
      options.requireDynamic = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.runs = Math.max(1, options.runs);
  options.outDir = path.resolve(ROOT_DIR, options.outDir);
  return options;
}

function numberFrom(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boolFrom(value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function printHelp() {
  console.log(`Test flakiness analyzer

Usage:
  node scripts/test-flakiness-analyzer.js [options]

Options:
  --project vue|src|all              Static scan scope. Dynamic runs are Vue-only.
  --static-only, --scan-only         Run static checks only.
  --runs <count>                     Repeated Cypress run count. Default: ${DEFAULT_RUNS}.
  --spec <pattern>                   Pass a Cypress --spec filter to dynamic runs.
  --out-dir <path>                   Report/artifact directory. Default: .flakiness-reports.
  --run-without-credentials          Attempt dynamic runs even when login credentials are missing.
  --require-dynamic                  Exit non-zero if dynamic execution is skipped.
  --no-fail-on-static                Do not fail on focused-test findings.

Environment mirrors:
  FLAKE_PROJECT, FLAKE_STATIC_ONLY, FLAKE_RUNS, FLAKE_SPEC, FLAKE_OUT_DIR,
  FLAKE_SKIP_DYNAMIC_WITHOUT_CREDS, FLAKE_REQUIRE_DYNAMIC
`);
}

function selectedProjects(projectName) {
  if (projectName === 'all') return [PROJECTS.vue, PROJECTS.src];
  if (PROJECTS[projectName]) return [PROJECTS[projectName]];
  throw new Error(`Unsupported project "${projectName}". Expected vue, src, or all.`);
}

function listCypressFiles(project) {
  if (!fs.existsSync(project.cypressDir)) return [];

  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['fixtures', 'screenshots', 'videos', 'downloads'].includes(entry.name)) continue;
        walk(fullPath);
      } else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  };

  walk(project.cypressDir);
  return files.sort();
}

function scanProjects(projects) {
  const findings = [];
  const files = [];

  for (const project of projects) {
    for (const filePath of listCypressFiles(project)) {
      const source = fs.readFileSync(filePath, 'utf8');
      const relPath = relativePath(filePath);
      files.push(relPath);
      findings.push(...scanFile(project.name, relPath, source));
    }
  }

  return {
    files,
    findings,
    summary: summarizeStaticFindings(findings)
  };
}

function scanFile(project, relPath, source) {
  const findings = [];
  const executableSource = maskCommentsPreservingLength(source);
  const regexChecks = [
    {
      check: 'focused-test',
      severity: 'error',
      regex: /\b(?:it|describe|context)\s*\.\s*only\s*\(/g,
      message: 'Focused Cypress test or suite prevents the full suite from running.'
    },
    {
      check: 'skipped-test',
      severity: 'warning',
      regex: /\b(?:xit|xdescribe|xcontext)\s*\(/g,
      message: 'Skipped Cypress test or suite reduces repeat-run coverage.'
    },
    {
      check: 'skipped-test',
      severity: 'warning',
      regex: /\b(?:it|describe|context)\s*\.\s*skip\s*\(/g,
      message: 'Skipped Cypress test or suite reduces repeat-run coverage.'
    },
    {
      check: 'runtime-skip',
      severity: 'info',
      regex: /\bthis\s*\.\s*skip\s*\(\s*\)/g,
      message: 'Runtime skip can hide environment-sensitive coverage from repeated runs.'
    },
    {
      check: 'fixed-wait',
      severity: 'warning',
      regex: /\bcy\s*\.\s*wait\s*\(\s*\d+/g,
      message: 'Fixed cy.wait duration can hide race conditions or introduce timing flakes.'
    },
    {
      check: 'fixed-wait',
      severity: 'warning',
      regex: /\bbrowser\s*\.\s*sleep\s*\(\s*\d+/g,
      message: 'Fixed browser.sleep duration can hide race conditions or introduce timing flakes.'
    },
    {
      check: 'credential-dependent',
      severity: 'info',
      regex: /\bcy\s*\.\s*login(?:AsAdmin)?\s*\(/g,
      message: 'Test depends on login credentials or live account state.'
    },
    {
      check: 'credential-dependent',
      severity: 'info',
      regex: /\bCypress\s*\.\s*env\s*\(\s*['"][^'"]*(?:USER|PASS|PASSWORD|TOKEN|KEY)[^'"]*['"]\s*\)/g,
      message: 'Test reads credential-like Cypress environment variables.'
    },
    {
      check: 'credential-dependent',
      severity: 'info',
      regex: /\b(?:data|fixtures)\s*\.\s*(?:username|password|email)\b/g,
      message: 'Test reads credential-like fixture values.'
    },
    {
      check: 'localhost-url',
      severity: 'warning',
      regex: /['"]https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^'"]*['"]/g,
      message: 'Direct localhost URL assumption can make specs less portable than baseUrl-relative visits.'
    }
  ];

  for (const check of regexChecks) {
    let match;
    while ((match = check.regex.exec(executableSource)) !== null) {
      findings.push(makeFinding(project, relPath, source, match.index, check));
    }
  }

  for (const block of collectTestBlocks(source)) {
    const stripped = stripComments(block.body).replace(/[;\s]/g, '');
    if (/TODO/i.test(block.body) && stripped.length === 0) {
      findings.push(makeFinding(project, relPath, source, block.index, {
        check: 'todo-only-test',
        severity: 'warning',
        message: `Test "${block.title || 'untitled'}" contains only TODO comments.`
      }));
    }
  }

  return findings.sort((a, b) => a.line - b.line || a.check.localeCompare(b.check));
}

function maskCommentsPreservingLength(source) {
  let result = '';
  let index = 0;
  let quote = '';
  let inLineComment = false;
  let inBlockComment = false;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      result += char === '\n' ? '\n' : ' ';
      if (char === '\n') inLineComment = false;
      index += 1;
      continue;
    }

    if (inBlockComment) {
      result += char === '\n' ? '\n' : ' ';
      if (char === '*' && next === '/') {
        result += ' ';
        index += 2;
        inBlockComment = false;
      } else {
        index += 1;
      }
      continue;
    }

    if (quote) {
      result += char;
      if (char === '\\') {
        if (next !== undefined) result += next;
        index += 2;
      } else {
        if (char === quote) quote = '';
        index += 1;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      result += '  ';
      index += 2;
      inLineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      result += '  ';
      index += 2;
      inBlockComment = true;
      continue;
    }

    if (['"', "'", '`'].includes(char)) {
      quote = char;
    }

    result += char;
    index += 1;
  }

  return result;
}

function makeFinding(project, relPath, source, index, check) {
  return {
    project,
    file: relPath,
    line: lineForIndex(source, index),
    check: check.check,
    severity: check.severity,
    message: check.message,
    snippet: lineAt(source, index).trim()
  };
}

function collectTestBlocks(source) {
  const blocks = [];
  const testRegex = /\b(?:it\s*(?:\.\s*(?:only|skip))?|xit)\s*\(/g;
  let match;

  while ((match = testRegex.exec(source)) !== null) {
    const callStart = match.index;
    const title = readFirstStringArgument(source, testRegex.lastIndex);
    const bodyStart = source.indexOf('{', title ? title.endIndex : testRegex.lastIndex);
    if (bodyStart === -1) continue;

    const nextTest = source.slice(testRegex.lastIndex).search(/\b(?:it\s*(?:\.\s*(?:only|skip))?|xit)\s*\(/);
    if (nextTest !== -1 && testRegex.lastIndex + nextTest < bodyStart) continue;

    const bodyEnd = findMatchingBrace(source, bodyStart);
    if (bodyEnd === -1) continue;

    blocks.push({
      index: callStart,
      title: title ? title.value : '',
      body: source.slice(bodyStart + 1, bodyEnd)
    });
  }

  return blocks;
}

function readFirstStringArgument(source, startIndex) {
  let index = startIndex;
  while (index < source.length && /\s/.test(source[index])) index += 1;

  const quote = source[index];
  if (!['"', "'", '`'].includes(quote)) return null;

  let value = '';
  index += 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') {
      value += source.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === quote) {
      return { value, endIndex: index + 1 };
    }
    value += char;
    index += 1;
  }

  return null;
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (['"', "'", '`'].includes(char)) {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function summarizeStaticFindings(findings) {
  const bySeverity = {};
  const byCheck = {};
  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
    byCheck[finding.check] = (byCheck[finding.check] || 0) + 1;
  }
  return {
    total: findings.length,
    bySeverity,
    byCheck,
    blocking: findings.filter(finding => finding.severity === 'error').length
  };
}

function runVueDynamic(options) {
  const project = PROJECTS.vue;
  const runCount = options.runs;
  const skipped = (reason, details) => ({
    attempted: false,
    skipped: true,
    reason,
    details: details || {},
    runsRequested: runCount,
    runs: [],
    specs: [],
    tests: []
  });

  const credentialStatus = checkCredentials(project);
  if (!credentialStatus.ready && options.skipDynamicWithoutCredentials) {
    return skipped('missing-credentials', {
      missing: credentialStatus.missing,
      hint: 'Set CYPRESS_THINX_TEST_USER and CYPRESS_THINX_TEST_PASSWORD, or pass --run-without-credentials to force execution.'
    });
  }

  if (!fs.existsSync(project.cypressBin)) {
    return skipped('missing-cypress-binary', {
      path: relativePath(project.cypressBin),
      hint: 'Run yarn install or npm install inside vue/ before repeated Cypress analysis.'
    });
  }

  const verify = spawnSync(project.cypressBin, ['verify'], {
    cwd: project.packageDir,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 5
  });

  if (verify.status !== 0) {
    return skipped('cypress-verify-failed', {
      exitCode: verify.status,
      message: tail([verify.stdout, verify.stderr].join('\n'), 2000)
    });
  }

  const runs = [];
  const startedAt = Date.now();

  for (let index = 1; index <= runCount; index += 1) {
    const runDir = path.join(options.outDir, `cypress-run-${String(index).padStart(2, '0')}`);
    fs.mkdirSync(runDir, { recursive: true });

    const args = [
      'run',
      '--reporter',
      'json',
      '--config',
      `video=false,screenshotsFolder=${path.join(runDir, 'screenshots')},videosFolder=${path.join(runDir, 'videos')},trashAssetsBeforeRuns=false`
    ];

    if (options.spec) {
      args.push('--spec', options.spec);
    }

    const runStartedAt = Date.now();
    const result = spawnSync(project.cypressBin, args, {
      cwd: project.packageDir,
      env: process.env,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 30
    });

    const durationMs = Date.now() - runStartedAt;
    fs.writeFileSync(path.join(runDir, 'stdout.log'), result.stdout || '');
    fs.writeFileSync(path.join(runDir, 'stderr.log'), result.stderr || '');

    const payloads = extractMochaJsonPayloads(result.stdout || '');
    const parsed = payloads.length > 0;
    runs.push({
      run: index,
      exitCode: result.status,
      durationMs,
      command: `cypress ${args.join(' ')}`,
      parsed,
      parseError: parsed ? '' : 'No Mocha JSON payload found in Cypress stdout.',
      stdoutPath: relativePath(path.join(runDir, 'stdout.log')),
      stderrPath: relativePath(path.join(runDir, 'stderr.log')),
      stats: parsed ? mergeMochaStats(payloads) : {},
      tests: parsed ? payloads.flatMap(normalizeMochaTests) : [],
      setupOutputTail: parsed ? '' : tail([result.stdout, result.stderr].join('\n'), 2000)
    });
  }

  const aggregation = aggregateRuns(runs);
  return {
    attempted: true,
    skipped: false,
    reason: '',
    runsRequested: runCount,
    durationMs: Date.now() - startedAt,
    specFilter: options.spec || '',
    runs,
    specs: aggregation.specs,
    tests: aggregation.tests,
    summary: aggregation.summary
  };
}

function checkCredentials(project) {
  const fixture = readJson(project.fixturePath) || {};
  const hasUser = project.credentialKeys.user.some(key => Boolean(process.env[key])) || Boolean(fixture.username);
  const hasPassword = project.credentialKeys.password.some(key => Boolean(process.env[key])) || Boolean(fixture.password);
  const missing = [];

  if (!hasUser) missing.push('CYPRESS_THINX_TEST_USER');
  if (!hasPassword) missing.push('CYPRESS_THINX_TEST_PASSWORD');

  return {
    ready: missing.length === 0,
    missing
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function extractMochaJsonPayloads(output) {
  const cleaned = stripAnsi(output || '');
  const payloads = [];
  let searchStart = 0;

  while (searchStart < cleaned.length) {
    const remainder = cleaned.slice(searchStart);
    const offset = remainder.search(/\{\s*"stats"\s*:/);
    if (offset === -1) break;

    const start = searchStart + offset;
    const end = findMatchingJsonBrace(cleaned, start);
    if (end === -1) break;

    try {
      payloads.push(JSON.parse(cleaned.slice(start, end + 1)));
    } catch (error) {
      // Keep scanning. Cypress may print unrelated brace-heavy output.
    }

    searchStart = end + 1;
  }

  return payloads;
}

function findMatchingJsonBrace(source, openIndex) {
  let depth = 0;
  let quote = '';

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"') {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function normalizeMochaTests(result) {
  const tests = [];
  const seen = new Set();

  const add = (test, status) => {
    if (!test) return;
    const file = normalizeTestFile(test.file || result.file || '');
    const fullTitle = test.fullTitle || test.title || 'unknown test';
    const key = `${status}:${file}:${fullTitle}`;
    if (seen.has(key)) return;
    seen.add(key);

    tests.push({
      spec: file || 'unknown spec',
      title: test.title || fullTitle,
      fullTitle,
      status,
      durationMs: Number.isFinite(test.duration) ? test.duration : 0,
      failureMessage: status === 'failed' ? firstFailureMessage(test.err) : '',
      failureCategory: status === 'failed' ? classifyFailure(firstFailureMessage(test.err)) : ''
    });
  };

  for (const test of result.passes || []) add(test, 'passed');
  for (const test of result.failures || []) add(test, 'failed');
  for (const test of result.pending || []) add(test, 'skipped');

  if (tests.length === 0 && Array.isArray(result.tests)) {
    for (const test of result.tests) {
      const state = test.state === 'passed' ? 'passed' : test.state === 'failed' ? 'failed' : 'skipped';
      add(test, state);
    }
  }

  return tests;
}

function mergeMochaStats(payloads) {
  const totals = {
    payloads: payloads.length,
    suites: 0,
    tests: 0,
    passes: 0,
    pending: 0,
    failures: 0,
    duration: 0
  };

  for (const payload of payloads) {
    const stats = payload.stats || {};
    totals.suites += Number(stats.suites) || 0;
    totals.tests += Number(stats.tests) || 0;
    totals.passes += Number(stats.passes) || 0;
    totals.pending += Number(stats.pending) || 0;
    totals.failures += Number(stats.failures) || 0;
    totals.duration += Number(stats.duration) || 0;
  }

  return totals;
}

function normalizeTestFile(filePath) {
  if (!filePath) return '';
  if (path.isAbsolute(filePath)) return relativePath(filePath);
  return filePath.replace(/\\/g, '/');
}

function firstFailureMessage(err) {
  if (!err) return '';
  return String(err.message || err.estack || err.stack || '').split('\n').slice(0, 6).join('\n').trim();
}

function classifyFailure(message) {
  const value = String(message || '').toLowerCase();
  if (!value) return 'unknown';
  if (/credential|password|username|cypress_thinx_test|admin_user|admin_pass/.test(value)) return 'missing-credentials';
  if (/timed out|timeout|retrying/.test(value)) return 'timeout';
  if (/expected|assert|should/.test(value)) return 'assertion';
  if (/econnrefused|err_connection|network|cy\.visit|status code|xhr|fetch/.test(value)) return 'network-or-server';
  if (/detached|element.*not.*found|cannot read propert|undefined/.test(value)) return 'selector-or-dom';
  if (/uncaught|script error|syntaxerror|typeerror|referenceerror/.test(value)) return 'app-error';
  return 'unknown';
}

function aggregateRuns(runs) {
  const byTest = new Map();
  const bySpec = new Map();

  for (const run of runs) {
    for (const test of run.tests) {
      const testKey = `${test.spec}::${test.fullTitle}`;
      if (!byTest.has(testKey)) {
        byTest.set(testKey, {
          spec: test.spec,
          title: test.title,
          fullTitle: test.fullTitle,
          passCount: 0,
          failCount: 0,
          skipCount: 0,
          durationsMs: [],
          firstFailureMessage: '',
          failureCategories: new Set()
        });
      }

      const testAgg = byTest.get(testKey);
      if (test.status === 'passed') testAgg.passCount += 1;
      if (test.status === 'failed') testAgg.failCount += 1;
      if (test.status === 'skipped') testAgg.skipCount += 1;
      if (test.durationMs) testAgg.durationsMs.push(test.durationMs);
      if (test.failureMessage && !testAgg.firstFailureMessage) testAgg.firstFailureMessage = test.failureMessage;
      if (test.failureCategory) testAgg.failureCategories.add(test.failureCategory);

      if (!bySpec.has(test.spec)) {
        bySpec.set(test.spec, {
          spec: test.spec,
          passCount: 0,
          failCount: 0,
          skipCount: 0,
          durationsMs: [],
          firstFailureMessage: '',
          failureCategories: new Set()
        });
      }

      const specAgg = bySpec.get(test.spec);
      if (test.status === 'passed') specAgg.passCount += 1;
      if (test.status === 'failed') specAgg.failCount += 1;
      if (test.status === 'skipped') specAgg.skipCount += 1;
      if (test.durationMs) specAgg.durationsMs.push(test.durationMs);
      if (test.failureMessage && !specAgg.firstFailureMessage) specAgg.firstFailureMessage = test.failureMessage;
      if (test.failureCategory) specAgg.failureCategories.add(test.failureCategory);
    }
  }

  const tests = Array.from(byTest.values()).map(finalizeAggregate);
  const specs = Array.from(bySpec.values()).map(finalizeAggregate);

  return {
    tests,
    specs,
    summary: {
      totalTests: tests.length,
      flakyTests: tests.filter(test => test.classification === 'flaky').length,
      consistentlyFailingTests: tests.filter(test => test.classification === 'consistently-failing').length,
      intermittentlySkippedTests: tests.filter(test => test.classification === 'intermittently-skipped').length,
      unparsedRuns: runs.filter(run => !run.parsed).length
    }
  };
}

function finalizeAggregate(aggregate) {
  const failureCategories = Array.from(aggregate.failureCategories).sort();
  const result = {
    ...aggregate,
    durationStatsMs: durationStats(aggregate.durationsMs),
    failureCategories,
    classification: classifyAggregate(aggregate)
  };

  delete result.durationsMs;
  return result;
}

function classifyAggregate(aggregate) {
  if (aggregate.passCount > 0 && aggregate.failCount > 0) return 'flaky';
  if (aggregate.failCount > 0) return 'consistently-failing';
  if (aggregate.passCount > 0 && aggregate.skipCount > 0) return 'intermittently-skipped';
  if (aggregate.skipCount > 0) return 'always-skipped';
  return 'passed';
}

function durationStats(values) {
  if (!values.length) {
    return { count: 0, min: 0, max: 0, average: 0 };
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average: Math.round(sum / sorted.length)
  };
}

function writeReports(report, outDir) {
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'latest.json');
  const mdPath = path.join(outDir, 'latest.md');

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report));

  return {
    json: jsonPath,
    markdown: mdPath
  };
}

function renderMarkdown(report) {
  const lines = [];
  const staticSummary = report.static.summary;
  const dynamic = report.dynamic;

  lines.push('# Test Flakiness Report');
  lines.push('');
  lines.push(`Generated: ${report.meta.generatedAt}`);
  lines.push(`Static scope: ${report.meta.projects.join(', ')}`);
  lines.push(`Dynamic scope: ${report.meta.dynamicScope}`);
  lines.push('');
  lines.push('## Static Findings');
  lines.push('');
  lines.push(`Total findings: ${staticSummary.total}`);
  lines.push(`Blocking findings: ${staticSummary.blocking}`);
  lines.push('');
  lines.push('| Check | Count |');
  lines.push('|:--|--:|');
  for (const [check, count] of Object.entries(staticSummary.byCheck).sort()) {
    lines.push(`| ${check} | ${count} |`);
  }
  if (!Object.keys(staticSummary.byCheck).length) {
    lines.push('| none | 0 |');
  }

  lines.push('');
  lines.push('### Highest Signal Static Findings');
  lines.push('');
  lines.push('| Severity | Check | Location | Message |');
  lines.push('|:--|:--|:--|:--|');
  for (const finding of report.static.findings.slice(0, 40)) {
    lines.push(`| ${finding.severity} | ${finding.check} | ${finding.file}:${finding.line} | ${escapeTable(finding.message)} |`);
  }
  if (!report.static.findings.length) {
    lines.push('| none | none | n/a | No static findings. |');
  }

  lines.push('');
  lines.push('## Dynamic Repeated Runs');
  lines.push('');

  if (dynamic.skipped) {
    lines.push(`Dynamic execution skipped: ${dynamic.reason}`);
    if (dynamic.details && dynamic.details.hint) lines.push('');
    if (dynamic.details && dynamic.details.hint) lines.push(dynamic.details.hint);
  } else {
    lines.push(`Runs requested: ${dynamic.runsRequested}`);
    lines.push(`Runs parsed: ${dynamic.runs.filter(run => run.parsed).length}`);
    lines.push(`Unparsed runs: ${dynamic.summary.unparsedRuns}`);
    lines.push(`Flaky tests: ${dynamic.summary.flakyTests}`);
    lines.push(`Consistently failing tests: ${dynamic.summary.consistentlyFailingTests}`);
    lines.push('');
    lines.push('| Classification | Spec | Test | Pass | Fail | Skip | First failure category |');
    lines.push('|:--|:--|:--|--:|--:|--:|:--|');
    for (const test of dynamic.tests.filter(test => test.classification !== 'passed').slice(0, 40)) {
      lines.push(`| ${test.classification} | ${test.spec} | ${escapeTable(test.fullTitle)} | ${test.passCount} | ${test.failCount} | ${test.skipCount} | ${test.failureCategories.join(', ') || 'n/a'} |`);
    }
    if (!dynamic.tests.some(test => test.classification !== 'passed')) {
      lines.push('| passed | all parsed specs | n/a | n/a | 0 | 0 | n/a |');
    }
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function relativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
}

function lineForIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

function lineAt(source, index) {
  const start = source.lastIndexOf('\n', index) + 1;
  const end = source.indexOf('\n', index);
  return source.slice(start, end === -1 ? source.length : end);
}

function tail(value, maxLength) {
  const text = stripAnsi(String(value || '')).trim();
  if (text.length <= maxLength) return text;
  return text.slice(text.length - maxLength);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }

  const projects = selectedProjects(options.project);
  const staticReport = scanProjects(projects);
  const shouldRunDynamic = !options.staticOnly && projects.some(project => project.name === 'vue');
  const dynamicReport = shouldRunDynamic
    ? runVueDynamic(options)
    : {
      attempted: false,
      skipped: true,
      reason: options.staticOnly ? 'static-only' : 'dynamic-supported-for-vue-only',
      details: {},
      runsRequested: options.runs,
      runs: [],
      specs: [],
      tests: []
    };

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      rootDir: ROOT_DIR,
      projects: projects.map(project => project.name),
      dynamicScope: shouldRunDynamic ? 'vue' : 'none',
      options: {
        project: options.project,
        runs: options.runs,
        spec: options.spec,
        staticOnly: options.staticOnly,
        skipDynamicWithoutCredentials: options.skipDynamicWithoutCredentials
      }
    },
    static: staticReport,
    dynamic: dynamicReport
  };

  const outputs = writeReports(report, options.outDir);

  console.log(`Static findings: ${staticReport.summary.total} (${staticReport.summary.blocking} blocking)`);
  if (dynamicReport.skipped) {
    console.log(`Dynamic runs skipped: ${dynamicReport.reason}`);
  } else {
    console.log(`Dynamic runs parsed: ${dynamicReport.runs.filter(run => run.parsed).length}/${dynamicReport.runsRequested}`);
    console.log(`Flaky tests: ${dynamicReport.summary.flakyTests}`);
  }
  console.log(`JSON report: ${relativePath(outputs.json)}`);
  console.log(`Markdown report: ${relativePath(outputs.markdown)}`);

  if (options.requireDynamic && dynamicReport.skipped) return 1;
  if (options.failOnStaticErrors && staticReport.summary.blocking > 0) return 1;
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
