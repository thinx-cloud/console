#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { createRequire } = require('module');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, '.flake-reports', 'latest');

const SUITES = {
  vue: {
    name: 'vue',
    label: 'Vue Cypress',
    projectDir: path.join(ROOT_DIR, 'vue'),
    cypressDir: path.join(ROOT_DIR, 'vue', 'cypress'),
    configFile: path.join(ROOT_DIR, 'vue', 'cypress.json'),
    dynamic: true
  },
  legacy: {
    name: 'legacy',
    label: 'Legacy Cypress',
    projectDir: path.join(ROOT_DIR, 'src'),
    cypressDir: path.join(ROOT_DIR, 'src', 'cypress'),
    configFile: path.join(ROOT_DIR, 'src', 'cypress.json'),
    dynamic: false
  }
};

const STATIC_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const TEST_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const CREDENTIAL_ENV_NAMES = new Set([
  'THINX_TEST_USER',
  'THINX_TEST_PASSWORD',
  'LOGIN_USERNAME',
  'LOGIN_PASSWORD',
  'ADMIN_USER',
  'ADMIN_PASS'
]);

async function main() {
  const options = parseArgs(process.argv.slice(2), process.env);

  if (options.help) {
    console.log(helpText());
    return;
  }

  const suites = selectedSuites(options.suite);
  const report = {
    generatedAt: new Date().toISOString(),
    root: slash(ROOT_DIR),
    options: publicOptions(options),
    static: scanStatic(suites),
    dynamic: {
      status: 'not-requested',
      suite: 'vue',
      reason: 'Dynamic execution was not requested.'
    }
  };

  if (!options.staticOnly && !options.skipDynamic && options.suite !== 'legacy') {
    report.dynamic = await runVueDynamicAnalysis(options);
  } else if (options.staticOnly) {
    report.dynamic = {
      status: 'not-requested',
      suite: 'vue',
      reason: 'Static-only scan requested.'
    };
  } else if (options.skipDynamic) {
    report.dynamic = {
      status: 'not-requested',
      suite: 'vue',
      reason: 'Dynamic execution skipped by CLI or environment.'
    };
  } else if (options.suite === 'legacy') {
    report.dynamic = {
      status: 'not-requested',
      suite: 'vue',
      reason: 'Legacy suite supports static analysis only.'
    };
  }

  report.summary = buildSummary(report);
  writeReports(report, options.outDir);
  printConsoleSummary(report, options.outDir);
}

function parseArgs(argv, env) {
  const options = {
    suite: env.FLAKE_SUITE || 'all',
    runs: positiveInt(env.FLAKE_RUNS || env.CYPRESS_FLAKE_RUNS, 5),
    spec: env.FLAKE_SPEC || env.CYPRESS_SPEC || '',
    outDir: env.FLAKE_OUT_DIR ? resolveUserPath(env.FLAKE_OUT_DIR) : DEFAULT_OUT_DIR,
    staticOnly: truthy(env.FLAKE_STATIC_ONLY),
    skipDynamic: truthy(env.FLAKE_SKIP_DYNAMIC),
    skipMissingCredentials: !falsey(env.FLAKE_SKIP_MISSING_CREDENTIALS),
    skipUnavailableServer: !falsey(env.FLAKE_SKIP_UNAVAILABLE_SERVER),
    skipServerCheck: truthy(env.FLAKE_SKIP_SERVER_CHECK),
    browser: env.FLAKE_BROWSER || '',
    quiet: !falsey(env.FLAKE_QUIET_CYPRESS),
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--static-only' || arg === '--scan-only') {
      options.staticOnly = true;
    } else if (arg === '--skip-dynamic') {
      options.skipDynamic = true;
    } else if (arg === '--skip-missing-credentials') {
      options.skipMissingCredentials = true;
    } else if (arg === '--no-skip-missing-credentials' || arg === '--require-credentials' || arg === '--fail-on-missing-credentials') {
      options.skipMissingCredentials = false;
    } else if (arg === '--skip-unavailable-server') {
      options.skipUnavailableServer = true;
    } else if (arg === '--no-skip-unavailable-server' || arg === '--require-server') {
      options.skipUnavailableServer = false;
    } else if (arg === '--skip-server-check') {
      options.skipServerCheck = true;
    } else if (arg === '--runs') {
      options.runs = positiveInt(next(), 5);
    } else if (arg.startsWith('--runs=')) {
      options.runs = positiveInt(arg.slice('--runs='.length), 5);
    } else if (arg === '--spec') {
      options.spec = next();
    } else if (arg.startsWith('--spec=')) {
      options.spec = arg.slice('--spec='.length);
    } else if (arg === '--out-dir') {
      options.outDir = resolveUserPath(next());
    } else if (arg.startsWith('--out-dir=')) {
      options.outDir = resolveUserPath(arg.slice('--out-dir='.length));
    } else if (arg === '--suite') {
      options.suite = next();
    } else if (arg.startsWith('--suite=')) {
      options.suite = arg.slice('--suite='.length);
    } else if (arg === '--browser') {
      options.browser = next();
    } else if (arg.startsWith('--browser=')) {
      options.browser = arg.slice('--browser='.length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.suite = String(options.suite || 'all').toLowerCase();
  if (!['all', 'vue', 'legacy'].includes(options.suite)) {
    throw new Error(`Invalid --suite value: ${options.suite}`);
  }
  options.runs = Math.max(1, options.runs);
  return options;
}

function helpText() {
  return [
    'Usage: node scripts/cypress-flake-analyzer.js [options]',
    '',
    'Static checks cover vue/cypress and src/cypress by default.',
    'Dynamic repeated execution is Vue-only and runs when prerequisites are available.',
    '',
    'Options:',
    '  --static-only, --scan-only        Write reports from static checks only.',
    '  --runs <n>                       Repeated Vue Cypress runs. Default: 5.',
    '  --spec <path-or-glob>            Cypress spec filter for dynamic runs.',
    '  --suite <all|vue|legacy>         Static suite scope. Default: all.',
    '  --out-dir <dir>                  Report directory. Default: .flake-reports/latest.',
    '  --skip-dynamic                   Do not run Cypress dynamically.',
    '  --require-credentials            Fail setup when selected specs need missing login creds.',
    '  --require-server                 Fail setup when the Vue app is unreachable.',
    '  --skip-server-check              Let Cypress perform the baseUrl check.',
    '  --browser <name>                 Browser passed to Cypress.',
    '',
    'Environment controls mirror the option names:',
    '  FLAKE_RUNS, FLAKE_SPEC, FLAKE_SUITE, FLAKE_OUT_DIR, FLAKE_STATIC_ONLY,',
    '  FLAKE_SKIP_DYNAMIC, FLAKE_SKIP_MISSING_CREDENTIALS,',
    '  FLAKE_SKIP_UNAVAILABLE_SERVER, FLAKE_SKIP_SERVER_CHECK, FLAKE_BROWSER.'
  ].join('\n');
}

function selectedSuites(suiteName) {
  if (suiteName === 'all') return [SUITES.vue, SUITES.legacy];
  return [SUITES[suiteName]];
}

function publicOptions(options) {
  return {
    suite: options.suite,
    runs: options.runs,
    spec: options.spec || null,
    outDir: slash(path.relative(ROOT_DIR, options.outDir) || '.'),
    staticOnly: options.staticOnly,
    skipDynamic: options.skipDynamic,
    skipMissingCredentials: options.skipMissingCredentials,
    skipUnavailableServer: options.skipUnavailableServer,
    skipServerCheck: options.skipServerCheck,
    browser: options.browser || null
  };
}

function scanStatic(suites) {
  const scannedFiles = [];
  const findings = [];

  for (const suite of suites) {
    const files = discoverStaticFiles(suite);
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      scannedFiles.push({
        suite: suite.name,
        file: relative(file)
      });
      findings.push(...scanStaticFile(suite, file, source));
    }
  }

  return {
    scannedFiles,
    findings,
    totals: summarizeFindings(findings)
  };
}

function discoverStaticFiles(suite) {
  const files = [];
  if (fs.existsSync(suite.cypressDir)) {
    for (const file of walkFiles(suite.cypressDir)) {
      if (STATIC_EXTENSIONS.has(path.extname(file))) {
        files.push(file);
      }
    }
  }
  if (fs.existsSync(suite.configFile)) {
    files.push(suite.configFile);
  }
  return files.sort();
}

function scanStaticFile(suite, file, source) {
  const views = createCodeViews(source);
  const findings = [];
  const add = (kind, severity, message, index, details) => {
    findings.push(makeFinding(suite, file, source, kind, severity, message, index, details));
  };

  findMatches(views.syntax, /\b(?:it|describe|context)\s*\.\s*only\s*\(/g, (match) => {
    add('focused-test', 'error', 'Focused Cypress test prevents the full suite from running.', match.index);
  });

  findMatches(views.syntax, /\b(?:xit|xdescribe|xcontext)\s*\(/g, (match) => {
    add('skipped-test', 'warning', 'Skipped Cypress test is present.', match.index);
  });

  findMatches(views.syntax, /\b(?:it|describe|context)\s*\.\s*skip\s*\(/g, (match) => {
    add('skipped-test', 'warning', 'Skipped Cypress test is present.', match.index);
  });

  findMatches(views.syntax, /\bthis\s*\.\s*skip\s*\(/g, (match) => {
    add('runtime-skip', 'info', 'Runtime skip is present; confirm it is environment-gated and intentional.', match.index);
  });

  findMatches(views.syntax, /\bcy\s*\.\s*wait\s*\(\s*(\d+)/g, (match) => {
    add('fixed-wait', 'warning', `Fixed cy.wait(${match[1]}) can hide or cause timing flakiness.`, match.index, {
      milliseconds: Number(match[1])
    });
  });

  findMatches(views.syntax, /\bcy\s*\.\s*(login|loginAsAdmin)\s*\(/g, (match) => {
    const admin = match[1] === 'loginAsAdmin';
    add('credential-dependent-test', 'info', admin
      ? 'Test uses admin credentials.'
      : 'Test uses configured login credentials.', match.index, {
      command: `cy.${match[1]}`
    });
  });

  findMatches(views.commentless, /\bCypress\s*\.\s*env\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, (match) => {
    if (CREDENTIAL_ENV_NAMES.has(match[1])) {
      add('credential-dependent-test', 'info', `Test reads Cypress credential env ${match[1]}.`, match.index, {
        env: match[1]
      });
    }
  });

  findMatches(views.commentless, /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^\s'"`)]*/g, (match) => {
    add('direct-localhost-url', 'warning', 'Direct localhost URL assumption is present.', match.index, {
      url: match[0]
    });
  });

  findings.push(...findTodoOnlyTests(suite, file, source, views));
  return findings;
}

function findTodoOnlyTests(suite, file, source, views) {
  const findings = [];
  const testDeclaration = /\bit\s*(?:\.\s*only)?\s*\(/g;
  let match;
  while ((match = testDeclaration.exec(views.syntax)) !== null) {
    const openBrace = views.syntax.indexOf('{', match.index);
    if (openBrace === -1) continue;
    const closeBrace = findMatchingBrace(views.syntax, openBrace);
    if (closeBrace === -1) continue;

    const bodyOriginal = source.slice(openBrace + 1, closeBrace);
    const bodySyntax = views.syntax.slice(openBrace + 1, closeBrace);
    const hasTodo = /\b(?:TODO|FIXME|TBD|PENDING)\b/i.test(bodyOriginal);
    const hasExecutableSignal = /\b(?:cy|expect|assert|should|return|throw|Cypress)\b/.test(bodySyntax);

    if (hasTodo && !hasExecutableSignal) {
      const title = extractFirstString(source, match.index) || 'untitled test';
      findings.push(makeFinding(
        suite,
        file,
        source,
        'todo-only-test',
        'warning',
        `Active test body appears to contain only TODO/pending comments: ${title}`,
        match.index,
        { title }
      ));
    }
    testDeclaration.lastIndex = closeBrace + 1;
  }
  return findings;
}

async function runVueDynamicAnalysis(options) {
  const suite = SUITES.vue;
  const dynamic = {
    status: 'preflight',
    suite: 'vue',
    runsRequested: options.runs,
    runsCompleted: 0,
    spec: options.spec || null,
    prerequisites: {},
    runIssues: [],
    tests: []
  };

  const cypressLoad = loadCypress(suite.projectDir);
  dynamic.prerequisites.cypressModule = cypressLoad.ok
    ? { ok: true }
    : { ok: false, reason: cypressLoad.error };

  if (!cypressLoad.ok) {
    return skippedOrSetupError(dynamic, true, 'Cypress is not installed for vue/. Run cd vue && yarn first.');
  }

  const specs = selectedVueSpecs(options.spec);
  const credentialRequirements = analyzeCredentialRequirements(specs);
  const credentials = readVueCredentials();
  dynamic.prerequisites.specs = specs.map(relative);
  dynamic.prerequisites.credentials = {
    requiresUserLogin: credentialRequirements.requiresUserLogin,
    requiresAdminLogin: credentialRequirements.requiresAdminLogin,
    hasUser: Boolean(credentials.user),
    hasPassword: Boolean(credentials.password),
    hasAdminUser: Boolean(credentials.adminUser),
    hasAdminPass: Boolean(credentials.adminPass),
    missing: []
  };

  if (credentialRequirements.requiresUserLogin) {
    if (!credentials.user) dynamic.prerequisites.credentials.missing.push('CYPRESS_THINX_TEST_USER or CYPRESS_LOGIN_USERNAME');
    if (!credentials.password) dynamic.prerequisites.credentials.missing.push('CYPRESS_THINX_TEST_PASSWORD or CYPRESS_LOGIN_PASSWORD');
  }

  if (dynamic.prerequisites.credentials.missing.length > 0 && options.skipMissingCredentials) {
    return skippedOrSetupError(
      dynamic,
      true,
      `Selected Vue specs need login credentials: ${dynamic.prerequisites.credentials.missing.join(', ')}.`
    );
  } else if (dynamic.prerequisites.credentials.missing.length > 0) {
    return skippedOrSetupError(
      dynamic,
      false,
      `Selected Vue specs need login credentials: ${dynamic.prerequisites.credentials.missing.join(', ')}.`
    );
  }

  const config = loadJson(suite.configFile) || {};
  const baseUrl = config.baseUrl || '';
  dynamic.prerequisites.baseUrl = { url: baseUrl || null };

  if (baseUrl && !options.skipServerCheck) {
    const server = await checkUrl(baseUrl, 5000);
    dynamic.prerequisites.baseUrl = {
      url: baseUrl,
      ok: server.ok,
      statusCode: server.statusCode || null,
      error: server.error || null
    };
    if (!server.ok && options.skipUnavailableServer) {
      return skippedOrSetupError(
        dynamic,
        true,
        `Vue app is not reachable at ${baseUrl}. Start it with cd vue && yarn serve, or run the analyzer behind start-server-and-test.`
      );
    } else if (!server.ok) {
      return skippedOrSetupError(
        dynamic,
        false,
        `Vue app is not reachable at ${baseUrl}. Start it with cd vue && yarn serve, or run the analyzer behind start-server-and-test.`
      );
    }
  }

  const aggregate = new Map();
  const rawRunDir = path.join(options.outDir, 'runs');
  fs.mkdirSync(rawRunDir, { recursive: true });

  dynamic.status = 'running';
  for (let iteration = 1; iteration <= options.runs; iteration += 1) {
    const startedAt = new Date().toISOString();
    try {
      const result = await cypressLoad.cypress.run(cypressRunOptions(options));
      dynamic.runsCompleted += 1;
      writeJson(path.join(rawRunDir, `run-${String(iteration).padStart(2, '0')}.json`), result);
      collectRunOutcomes(result, iteration, aggregate, dynamic.runIssues);
      dynamic.runIssues.push(...collectResultIssues(result, iteration));
    } catch (error) {
      const message = errorMessage(error);
      dynamic.runIssues.push({
        iteration,
        startedAt,
        type: 'cypress-run-error',
        category: inferFailureCategory(message),
        message
      });
      break;
    }
  }

  dynamic.tests = finalizeOutcomes(aggregate);
  dynamic.status = dynamic.runsCompleted > 0 ? 'completed' : 'setup-error';
  if (dynamic.status === 'setup-error' && !dynamic.reason) {
    dynamic.reason = firstIssueMessage(dynamic.runIssues) || 'Cypress did not complete any dynamic runs.';
  }
  dynamic.totals = summarizeDynamic(dynamic.tests, dynamic.runIssues);
  return dynamic;
}

function skippedOrSetupError(dynamic, shouldSkip, reason) {
  dynamic.reason = reason;
  dynamic.status = shouldSkip ? 'skipped' : 'setup-error';
  dynamic.totals = summarizeDynamic([], dynamic.runIssues);
  return dynamic;
}

function cypressRunOptions(options) {
  const suite = SUITES.vue;
  const runOptions = {
    project: suite.projectDir,
    configFile: suite.configFile,
    headless: true,
    quiet: options.quiet,
    config: {
      video: false
    }
  };

  if (options.spec) {
    runOptions.spec = resolveCypressSpec(options.spec, suite.projectDir);
  }
  if (options.browser) {
    runOptions.browser = options.browser;
  }
  return runOptions;
}

function selectedVueSpecs(specFilter) {
  const integrationDir = path.join(SUITES.vue.cypressDir, 'integration');
  const files = fs.existsSync(integrationDir)
    ? walkFiles(integrationDir).filter((file) => TEST_EXTENSIONS.has(path.extname(file)))
    : [];
  const selected = files.filter((file) => matchesSpecFilter(file, specFilter, SUITES.vue.projectDir));
  return specFilter ? selected.sort() : files.sort();
}

function analyzeCredentialRequirements(files) {
  const result = {
    requiresUserLogin: false,
    requiresAdminLogin: false
  };

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const views = createCodeViews(source);
    if (/\bcy\s*\.\s*login\s*\(/.test(views.syntax)) {
      result.requiresUserLogin = true;
    }
    if (/\bcy\s*\.\s*loginAsAdmin\s*\(/.test(views.syntax)) {
      result.requiresAdminLogin = true;
    }
  }
  return result;
}

function readVueCredentials() {
  const fixture = loadJson(path.join(SUITES.vue.cypressDir, 'fixtures', 'thinx.json')) || {};
  return {
    user: firstEnvValue(['THINX_TEST_USER', 'LOGIN_USERNAME']) || fixture.username || '',
    password: firstEnvValue(['THINX_TEST_PASSWORD', 'LOGIN_PASSWORD']) || fixture.password || '',
    adminUser: firstEnvValue(['ADMIN_USER']) || '',
    adminPass: firstEnvValue(['ADMIN_PASS']) || ''
  };
}

function firstEnvValue(names) {
  for (const name of names) {
    if (process.env[`CYPRESS_${name}`]) return process.env[`CYPRESS_${name}`];
    if (process.env[name]) return process.env[name];
  }
  return '';
}

function loadCypress(projectDir) {
  try {
    const localRequire = createRequire(path.join(projectDir, 'package.json'));
    return { ok: true, cypress: localRequire('cypress') };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function collectRunOutcomes(result, iteration, aggregate, runIssues) {
  for (const run of result.runs || []) {
    const spec = specName(run);
    if (!Array.isArray(run.tests)) continue;

    for (const test of run.tests) {
      const title = testTitle(test);
      const key = `${spec}::${title}`;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          spec,
          title,
          passCount: 0,
          failCount: 0,
          skipCount: 0,
          durations: [],
          firstFailureMessage: null,
          firstFailureIteration: null,
          observedStates: []
        });
      }
      const entry = aggregate.get(key);
      const state = normalizeTestState(test.state);
      entry.observedStates.push({ iteration, state });

      if (state === 'passed') entry.passCount += 1;
      if (state === 'failed') entry.failCount += 1;
      if (state === 'skipped') entry.skipCount += 1;

      const duration = testDuration(test);
      if (duration !== null) entry.durations.push(duration);

      if (state === 'failed' && !entry.firstFailureMessage) {
        entry.firstFailureMessage = failureMessage(test);
        entry.firstFailureIteration = iteration;
      }
    }

    if (run.error) {
      runIssues.push({
        iteration,
        spec,
        type: 'spec-error',
        category: inferFailureCategory(String(run.error)),
        message: truncate(String(run.error), 1000)
      });
    }
  }
}

function collectResultIssues(result, iteration) {
  const issues = [];
  if (result.status && result.status !== 'finished') {
    issues.push({
      iteration,
      type: 'run-status',
      category: inferFailureCategory(result.message || result.status),
      message: truncate(result.message || result.status, 1000)
    });
  }
  if (result.error) {
    issues.push({
      iteration,
      type: 'run-error',
      category: inferFailureCategory(String(result.error)),
      message: truncate(String(result.error), 1000)
    });
  }
  return issues;
}

function finalizeOutcomes(aggregate) {
  return Array.from(aggregate.values())
    .map((entry) => {
      const failureCategory = entry.firstFailureMessage
        ? inferFailureCategory(entry.firstFailureMessage)
        : null;
      return {
        spec: entry.spec,
        title: entry.title,
        passCount: entry.passCount,
        failCount: entry.failCount,
        skipCount: entry.skipCount,
        totalObserved: entry.passCount + entry.failCount + entry.skipCount,
        flaky: entry.passCount > 0 && entry.failCount > 0,
        classification: classifyOutcome(entry),
        durationMs: durationStats(entry.durations),
        firstFailureMessage: entry.firstFailureMessage,
        firstFailureIteration: entry.firstFailureIteration,
        failureCategory,
        observedStates: entry.observedStates
      };
    })
    .sort((a, b) => {
      if (a.flaky !== b.flaky) return a.flaky ? -1 : 1;
      if (a.failCount !== b.failCount) return b.failCount - a.failCount;
      return `${a.spec} ${a.title}`.localeCompare(`${b.spec} ${b.title}`);
    });
}

function classifyOutcome(entry) {
  if (entry.passCount > 0 && entry.failCount > 0) return 'flaky';
  if (entry.failCount > 0 && entry.passCount === 0) return 'consistently-failing';
  if (entry.skipCount > 0 && entry.passCount === 0 && entry.failCount === 0) return 'skipped';
  if (entry.skipCount > 0) return 'mixed-with-skips';
  return 'stable';
}

function inferFailureCategory(message) {
  const text = String(message || '');
  if (/Set CYPRESS_.*(?:PASSWORD|PASS|USER)|missing.*credential|credential/i.test(text)) {
    return 'missing-credentials';
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ERR_CONNECTION|could not verify.*server|baseUrl|failed trying to load|app is not reachable/i.test(text)) {
    return 'app-unavailable';
  }
  if (/cy\.request|xhr|fetch|status code|HTTP|net::ERR/i.test(text)) {
    return 'network';
  }
  if (/AssertionError|expected|expect\(/i.test(text)) {
    return 'assertion';
  }
  if (/Expected to find element|cy\.get\(\)|selector|element.*never|Timed out retrying.*find/i.test(text)) {
    return 'selector-timeout';
  }
  if (/Timed out retrying|timeout|timed out/i.test(text)) {
    return 'command-timeout';
  }
  if (/browser|Chrome|Electron|DISPLAY|Cypress failed to start/i.test(text)) {
    return 'browser-setup';
  }
  return 'unknown';
}

function buildSummary(report) {
  const staticTotals = report.static.totals;
  const dynamicTotals = report.dynamic.totals || {};
  return {
    staticFindings: staticTotals.total,
    staticByKind: staticTotals.byKind,
    dynamicStatus: report.dynamic.status,
    dynamicRunsCompleted: report.dynamic.runsCompleted || 0,
    flakyTests: dynamicTotals.flakyTests || 0,
    failingTests: dynamicTotals.failingTests || 0,
    skippedTests: dynamicTotals.skippedTests || 0
  };
}

function summarizeFindings(findings) {
  const totals = {
    total: findings.length,
    bySeverity: {},
    byKind: {}
  };
  for (const finding of findings) {
    totals.bySeverity[finding.severity] = (totals.bySeverity[finding.severity] || 0) + 1;
    totals.byKind[finding.kind] = (totals.byKind[finding.kind] || 0) + 1;
  }
  return totals;
}

function summarizeDynamic(tests, runIssues) {
  return {
    totalTests: tests.length,
    flakyTests: tests.filter((test) => test.flaky).length,
    failingTests: tests.filter((test) => test.failCount > 0).length,
    skippedTests: tests.filter((test) => test.skipCount > 0).length,
    runIssues: runIssues.length
  };
}

function writeReports(report, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  writeJson(path.join(outDir, 'report.json'), report);
  fs.writeFileSync(path.join(outDir, 'summary.md'), renderMarkdown(report), 'utf8');
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Cypress Flakiness Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Root: \`${report.root}\``);
  lines.push('');
  lines.push('## Static scan');
  lines.push('');
  lines.push(`Scanned files: ${report.static.scannedFiles.length}`);
  lines.push(`Findings: ${report.static.totals.total}`);
  lines.push('');
  lines.push('| Kind | Count |');
  lines.push('| --- | ---: |');
  for (const [kind, count] of Object.entries(report.static.totals.byKind).sort()) {
    lines.push(`| ${kind} | ${count} |`);
  }
  if (Object.keys(report.static.totals.byKind).length === 0) {
    lines.push('| none | 0 |');
  }

  const topFindings = report.static.findings.slice(0, 40);
  lines.push('');
  lines.push('### First static findings');
  lines.push('');
  if (topFindings.length === 0) {
    lines.push('No static flakiness signals found.');
  } else {
    lines.push('| Severity | Kind | Location | Message |');
    lines.push('| --- | --- | --- | --- |');
    for (const finding of topFindings) {
      lines.push(`| ${finding.severity} | ${finding.kind} | \`${finding.file}:${finding.line}\` | ${escapeTable(finding.message)} |`);
    }
  }

  lines.push('');
  lines.push('## Dynamic repeated runs');
  lines.push('');
  lines.push(`Status: ${report.dynamic.status}`);
  if (report.dynamic.reason) {
    lines.push(`Reason: ${report.dynamic.reason}`);
  }
  if (report.dynamic.runsRequested) {
    lines.push(`Runs completed/requested: ${report.dynamic.runsCompleted || 0}/${report.dynamic.runsRequested}`);
  }

  if (Array.isArray(report.dynamic.tests) && report.dynamic.tests.length > 0) {
    const notable = report.dynamic.tests.filter((test) => test.flaky || test.failCount > 0 || test.skipCount > 0).slice(0, 40);
    lines.push('');
    lines.push('### Notable dynamic outcomes');
    lines.push('');
    if (notable.length === 0) {
      lines.push('No flaky, failing, or skipped tests observed in repeated runs.');
    } else {
      lines.push('| Classification | Spec | Test | Pass | Fail | Skip | Category |');
      lines.push('| --- | --- | --- | ---: | ---: | ---: | --- |');
      for (const test of notable) {
        lines.push(`| ${test.classification} | \`${test.spec}\` | ${escapeTable(test.title)} | ${test.passCount} | ${test.failCount} | ${test.skipCount} | ${test.failureCategory || ''} |`);
      }
    }
  }

  if (Array.isArray(report.dynamic.runIssues) && report.dynamic.runIssues.length > 0) {
    lines.push('');
    lines.push('### Run issues');
    lines.push('');
    lines.push('| Iteration | Type | Category | Message |');
    lines.push('| ---: | --- | --- | --- |');
    for (const issue of report.dynamic.runIssues.slice(0, 20)) {
      lines.push(`| ${issue.iteration || ''} | ${issue.type || ''} | ${issue.category || ''} | ${escapeTable(issue.message || '')} |`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function printConsoleSummary(report, outDir) {
  const jsonPath = relative(path.join(outDir, 'report.json'));
  const mdPath = relative(path.join(outDir, 'summary.md'));
  console.log(`Wrote Cypress flakiness reports to ${relative(outDir)}`);
  console.log(`- ${jsonPath}`);
  console.log(`- ${mdPath}`);
  console.log(`Static findings: ${report.static.totals.total}`);
  console.log(`Dynamic status: ${report.dynamic.status}`);
  if (report.dynamic.reason) {
    console.log(`Dynamic reason: ${report.dynamic.reason}`);
  }
  if (report.dynamic.totals) {
    console.log(`Dynamic flaky/failing tests: ${report.dynamic.totals.flakyTests}/${report.dynamic.totals.failingTests}`);
  }
}

function createCodeViews(source) {
  let commentless = '';
  let syntax = '';
  let index = 0;
  let state = 'code';
  let quote = '';

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        commentless += '  ';
        syntax += '  ';
        index += 2;
        state = 'line-comment';
        continue;
      }
      if (char === '/' && next === '*') {
        commentless += '  ';
        syntax += '  ';
        index += 2;
        state = 'block-comment';
        continue;
      }
      if (char === '\'' || char === '"' || char === '`') {
        quote = char;
        commentless += char;
        syntax += ' ';
        index += 1;
        state = 'string';
        continue;
      }
      commentless += char;
      syntax += char;
      index += 1;
      continue;
    }

    if (state === 'line-comment') {
      if (char === '\n') {
        commentless += '\n';
        syntax += '\n';
        state = 'code';
      } else {
        commentless += ' ';
        syntax += ' ';
      }
      index += 1;
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        commentless += '  ';
        syntax += '  ';
        index += 2;
        state = 'code';
        continue;
      }
      if (char === '\n') {
        commentless += '\n';
        syntax += '\n';
      } else {
        commentless += ' ';
        syntax += ' ';
      }
      index += 1;
      continue;
    }

    if (state === 'string') {
      commentless += char;
      syntax += char === '\n' ? '\n' : ' ';
      if (char === '\\') {
        if (index + 1 < source.length) {
          commentless += source[index + 1];
          syntax += source[index + 1] === '\n' ? '\n' : ' ';
          index += 2;
          continue;
        }
      } else if (char === quote) {
        state = 'code';
      }
      index += 1;
    }
  }

  return { commentless, syntax };
}

function makeFinding(suite, file, source, kind, severity, message, index, details) {
  const position = positionAt(source, index);
  return {
    suite: suite.name,
    file: relative(file),
    line: position.line,
    column: position.column,
    kind,
    severity,
    message,
    snippet: lineAt(source, position.line).trim(),
    details: details || {}
  };
}

function findMatches(source, regex, callback) {
  let match;
  while ((match = regex.exec(source)) !== null) {
    callback(match);
  }
}

function findMatchingBrace(source, openBrace) {
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractFirstString(source, startIndex) {
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\'' || char === '"' || char === '`') {
      let value = '';
      const quote = char;
      index += 1;
      while (index < source.length) {
        const current = source[index];
        if (current === '\\') {
          index += 2;
          continue;
        }
        if (current === quote) return value;
        value += current;
        index += 1;
      }
    }
    if (char === '\n' && index - startIndex > 300) return '';
  }
  return '';
}

function matchesSpecFilter(file, filter, projectDir) {
  if (!filter) return true;
  const filters = String(filter).split(',').map((part) => part.trim()).filter(Boolean);
  if (filters.length === 0) return true;

  const relativeToProject = slash(path.relative(projectDir, file));
  const relativeToRoot = relative(file);
  const basename = path.basename(file);

  return filters.some((filterPart) => {
    const normalized = slash(filterPart).replace(/^\.\//, '');
    if (normalized.includes('*')) {
      const regex = globToRegex(normalized);
      return regex.test(relativeToProject) || regex.test(relativeToRoot);
    }
    return relativeToProject === normalized ||
      relativeToProject.endsWith(normalized) ||
      relativeToRoot === normalized ||
      relativeToRoot.endsWith(normalized) ||
      basename === normalized ||
      basename === path.basename(normalized);
  });
}

function globToRegex(glob) {
  const escaped = glob
    .split('**').map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

function resolveCypressSpec(spec, projectDir) {
  const parts = String(spec).split(',').map((part) => {
    const trimmed = part.trim();
    if (!trimmed || path.isAbsolute(trimmed)) return trimmed;
    if (trimmed.startsWith('vue/')) return path.join(ROOT_DIR, trimmed);
    return path.join(projectDir, trimmed);
  });
  return parts.join(',');
}

function specName(run) {
  const spec = run.spec || {};
  if (spec.relative) return slash(spec.relative);
  if (spec.name) return slash(spec.name);
  if (spec.absolute) return relative(spec.absolute);
  return 'unknown-spec';
}

function testTitle(test) {
  if (Array.isArray(test.title)) return test.title.filter(Boolean).join(' > ');
  if (Array.isArray(test.titles)) return test.titles.filter(Boolean).join(' > ');
  if (test.fullTitle) return String(test.fullTitle);
  return String(test.title || 'unknown test');
}

function normalizeTestState(state) {
  if (state === 'passed') return 'passed';
  if (state === 'failed') return 'failed';
  if (state === 'pending' || state === 'skipped') return 'skipped';
  return state || 'unknown';
}

function testDuration(test) {
  if (typeof test.duration === 'number') return test.duration;
  if (Array.isArray(test.attempts)) {
    const durations = test.attempts
      .map((attempt) => attempt.duration)
      .filter((duration) => typeof duration === 'number');
    if (durations.length > 0) return durations.reduce((sum, duration) => sum + duration, 0);
  }
  return null;
}

function failureMessage(test) {
  if (test.displayError) return truncate(String(test.displayError), 2000);
  if (test.message) return truncate(String(test.message), 2000);
  if (Array.isArray(test.attempts)) {
    for (const attempt of test.attempts) {
      if (attempt.error) {
        return truncate(errorMessage(attempt.error), 2000);
      }
    }
  }
  return null;
}

function durationStats(values) {
  if (values.length === 0) {
    return {
      min: null,
      max: null,
      mean: null
    };
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(sum / values.length)
  };
}

function checkUrl(url, timeoutMs) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      resolve({ ok: false, error: errorMessage(error) });
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const request = client.get(parsed, (response) => {
      response.resume();
      resolve({
        ok: response.statusCode >= 200 && response.statusCode < 500,
        statusCode: response.statusCode
      });
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out after ${timeoutMs}ms`));
    });
    request.on('error', (error) => {
      resolve({ ok: false, error: errorMessage(error) });
    });
  });
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return null;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function positionAt(source, index) {
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function lineAt(source, lineNumber) {
  return source.split('\n')[lineNumber - 1] || '';
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ''));
}

function falsey(value) {
  return /^(0|false|no|off)$/i.test(String(value || ''));
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}

function relative(file) {
  return slash(path.relative(ROOT_DIR, file) || '.');
}

function resolveUserPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function errorMessage(error) {
  if (!error) return '';
  if (error.stack) return truncate(String(error.stack), 2000);
  if (error.message) return truncate(String(error.message), 2000);
  return truncate(String(error), 2000);
}

function firstIssueMessage(issues) {
  const issue = issues.find((item) => item.message);
  return issue ? issue.message : '';
}

function truncate(value, limit) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
