#!/usr/bin/env node
'use strict';

/*
 * doc-drift.js — zero-dependency documentation drift detector for the THiNX console.
 *
 * Scans markdown docs (README.md, AGENTS.md, CLAUDE.md, docs/*.md) for three
 * high-signal drift indicators:
 *
 *   1. broken-link     — a relative file/dir path referenced in the docs that no
 *                        longer exists on disk (markdown links + inline-code paths).
 *   2. unknown-script  — an `npm/yarn/pnpm run <name>` reference whose script name
 *                        is absent from every package.json in the repo.
 *   3. missing-source  — a source path (inside a fenced code block) that points
 *                        into the repo but does not exist.
 *
 * Design notes:
 *   - No npm dependencies (project convention). Node built-ins only.
 *   - Self-locating: the repo root is the parent of this script's directory, so
 *     it runs correctly from any working directory.
 *   - Legacy AngularJS paths under src/ are treated as live (legacy is supported
 *     until the Vue console is GA'd as v2.0.x), so they are checked, not skipped.
 *   - A path token is only treated as a repo reference when its first segment
 *     matches a real top-level entry (or it is explicitly ./ or ../ relative).
 *     This keeps npm package names (@scope/pkg), URLs and shell vars out of the
 *     results without an ever-growing allowlist.
 *
 * Suppressing intentional examples / known false positives:
 *   - Put `<!-- doc-drift-ignore -->` on the offending line or the line above it.
 *   - Put `<!-- doc-drift-ignore-file -->` anywhere in a file to skip it entirely.
 *   - Add a substring to the ALLOWLIST array below.
 *
 * Exit code: 1 when drift is found (CI-gating), 0 when clean.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Docs to scan (relative to repo root). Missing files are skipped silently.
const DOC_FILES = ['README.md', 'AGENTS.md', 'CLAUDE.md'];
const DOC_GLOB_DIRS = ['docs']; // every *.md under these dirs (recursively)

// Substrings that suppress a finding for a path or script name. Keep this small;
// prefer the inline `<!-- doc-drift-ignore -->` marker for one-off examples.
const ALLOWLIST = [];

const IGNORE_LINE = 'doc-drift-ignore';
const IGNORE_FILE = 'doc-drift-ignore-file';

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.nyc_output']);

function walk(dir, matchFn, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, matchFn, acc);
    } else if (matchFn(full)) {
      acc.push(full);
    }
  }
  return acc;
}

// Union of every script name defined in any package.json in the repo.
function collectScriptNames() {
  const names = new Set();
  const pkgFiles = walk(ROOT, (f) => path.basename(f) === 'package.json', []);
  for (const file of pkgFiles) {
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (pkg && pkg.scripts) {
        for (const key of Object.keys(pkg.scripts)) names.add(key);
      }
    } catch (e) {
      // Unparseable package.json — ignore for script resolution.
    }
  }
  return names;
}

function collectDocs() {
  const docs = [];
  for (const rel of DOC_FILES) {
    const full = path.join(ROOT, rel);
    if (fs.existsSync(full)) docs.push(full);
  }
  for (const d of DOC_GLOB_DIRS) {
    const dir = path.join(ROOT, d);
    if (fs.existsSync(dir)) {
      walk(dir, (f) => f.toLowerCase().endsWith('.md'), docs);
    }
  }
  return docs;
}

const TOP_LEVEL = new Set(fs.readdirSync(ROOT));

// ---------------------------------------------------------------------------
// Path candidate extraction
// ---------------------------------------------------------------------------

const URL_RE = /^(https?:|ftp:|mailto:|tel:|data:|#)/i;
// Characters that mark a token as a template/placeholder/shell expression.
const PLACEHOLDER_RE = /[<>${}*\s|"'`]/;

function stripDecorations(raw) {
  let s = raw.trim();
  // Drop trailing markdown / sentence punctuation.
  s = s.replace(/[).,;:!?]+$/, '');
  // Drop anchor / query suffixes.
  s = s.replace(/[#?].*$/, '');
  return s;
}

// Returns the absolute path to check, or null if the token is not a repo-relative
// reference we should validate.
function resolveCandidate(token, docDir) {
  if (!token) return null;
  if (URL_RE.test(token)) return null;
  if (PLACEHOLDER_RE.test(token)) return null;
  if (token.startsWith('@')) return null; // npm scoped package
  if (path.isAbsolute(token)) return null; // container / system paths, not repo paths

  if (token.startsWith('./') || token.startsWith('../')) {
    return path.resolve(docDir, token);
  }

  // Must contain a path separator to be a path (excludes bare words like "feat").
  if (!token.includes('/')) return null;

  const firstSegment = token.split('/')[0];
  // Only treat it as a repo reference when it points at a real top-level entry.
  if (!TOP_LEVEL.has(firstSegment)) return null;

  return path.resolve(ROOT, token);
}

function inAllowlist(value) {
  return ALLOWLIST.some((entry) => value.includes(entry));
}

// ---------------------------------------------------------------------------
// Per-line scanners
// ---------------------------------------------------------------------------

const MD_LINK_RE = /\[[^\]]*\]\(([^)\s]+)/g;
const INLINE_CODE_RE = /`([^`]+)`/g;
const SCRIPT_RE = /\b(?:npm|yarn|pnpm)\s+run\s+([A-Za-z0-9:_.\-]+)/g;
// Path-like bare tokens inside fenced code blocks.
const BARE_PATH_RE = /(?:\.{1,2}\/)?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+\/?/g;

function extractPathTokens(line, inFence) {
  const tokens = new Set();
  let m;

  MD_LINK_RE.lastIndex = 0;
  while ((m = MD_LINK_RE.exec(line)) !== null) tokens.add(m[1]);

  INLINE_CODE_RE.lastIndex = 0;
  while ((m = INLINE_CODE_RE.exec(line)) !== null) {
    // An inline-code span may hold a command ("npm run x") or a path. Split it
    // and keep the path-looking pieces.
    for (const piece of m[1].split(/\s+/)) {
      if (piece.includes('/')) tokens.add(piece);
    }
  }

  if (inFence) {
    BARE_PATH_RE.lastIndex = 0;
    while ((m = BARE_PATH_RE.exec(line)) !== null) tokens.add(m[0]);
  }

  return [...tokens];
}

function extractScriptRefs(line) {
  const refs = [];
  let m;
  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(line)) !== null) refs.push(m[1]);
  return refs;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

function scanDoc(file, scriptNames) {
  const findings = [];
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(IGNORE_FILE)) return findings;

  const lines = text.split(/\r?\n/);
  const docDir = path.dirname(file);
  let inFence = false;
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }

    const prev = i > 0 ? lines[i - 1] : '';
    const ignored = line.includes(IGNORE_LINE) || prev.includes(IGNORE_LINE);
    if (ignored) continue;

    const lineNo = i + 1;

    // Check 2: npm/yarn script references.
    for (const ref of extractScriptRefs(line)) {
      if (scriptNames.has(ref) || inAllowlist(ref)) continue;
      const key = lineNo + ':script:' + ref;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        line: lineNo,
        type: 'unknown-script',
        token: ref,
        message: 'npm/yarn script "' + ref + '" is not defined in any package.json',
      });
    }

    // Checks 1 & 3: filesystem path references.
    for (const token of extractPathTokens(line, inFence)) {
      const clean = stripDecorations(token);
      if (inAllowlist(clean)) continue;
      const resolved = resolveCandidate(clean, docDir);
      if (resolved === null) continue;
      if (fs.existsSync(resolved)) continue;

      const type = inFence ? 'missing-source' : 'broken-link';
      const key = lineNo + ':' + type + ':' + clean;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        line: lineNo,
        type,
        token: clean,
        message: 'referenced path "' + clean + '" does not exist',
      });
    }
  }

  return findings;
}

function relRoot(file) {
  return path.relative(ROOT, file) || path.basename(file);
}

function main() {
  const scriptNames = collectScriptNames();
  const docs = collectDocs();

  if (docs.length === 0) {
    console.log('doc-drift: no documentation files found to scan.');
    process.exit(0);
  }

  let total = 0;
  const byDoc = [];

  for (const doc of docs) {
    const findings = scanDoc(doc, scriptNames);
    if (findings.length > 0) {
      findings.sort((a, b) => a.line - b.line);
      byDoc.push({ doc, findings });
      total += findings.length;
    }
  }

  console.log('doc-drift: documentation drift detector');
  console.log('scanned ' + docs.length + ' doc file(s) against ' + scriptNames.size + ' known npm script(s)\n');

  if (total === 0) {
    console.log('No drift detected. Docs are in sync with the code. ✓');
    process.exit(0);
  }

  for (const entry of byDoc) {
    console.log(relRoot(entry.doc));
    for (const f of entry.findings) {
      console.log('  ' + f.line + '\t[' + f.type + '] ' + f.message);
    }
    console.log('');
  }

  console.log('Found ' + total + ' drift issue(s) across ' + byDoc.length + ' file(s).');
  console.log('Fix the docs, or suppress intentional examples with a');
  console.log('`<!-- doc-drift-ignore -->` marker (see scripts/README.md).');
  process.exit(1);
}

main();
