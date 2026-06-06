const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const projectRoot = path.resolve(__dirname, '..');
const budgetPath = path.join(projectRoot, 'perf-budget.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Unable to read performance budget at ${filePath}`);
    console.error(error.message);
    process.exit(1);
  }
}

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KiB', 'MiB', 'GiB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatSizePair(measurement) {
  return `${formatBytes(measurement.rawBytes)} raw / ${formatBytes(measurement.gzipBytes)} gzip`;
}

function totalAssets(assets) {
  return assets.reduce(
    (total, asset) => ({
      rawBytes: total.rawBytes + asset.rawBytes,
      gzipBytes: total.gzipBytes + asset.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 },
  );
}

function matchesAnyPattern(relativePath, patterns) {
  return patterns.some((pattern) => new RegExp(pattern).test(relativePath));
}

function overBudgetMessages(label, measurement, budget) {
  const messages = [];

  if (!budget) return messages;

  if (Number.isFinite(budget.rawBytes) && measurement.rawBytes > budget.rawBytes) {
    messages.push(
      `${label} raw size ${formatBytes(measurement.rawBytes)} exceeds budget ${formatBytes(
        budget.rawBytes,
      )} by ${formatBytes(measurement.rawBytes - budget.rawBytes)}`,
    );
  }

  if (Number.isFinite(budget.gzipBytes) && measurement.gzipBytes > budget.gzipBytes) {
    messages.push(
      `${label} gzip size ${formatBytes(measurement.gzipBytes)} exceeds budget ${formatBytes(
        budget.gzipBytes,
      )} by ${formatBytes(measurement.gzipBytes - budget.gzipBytes)}`,
    );
  }

  return messages;
}

function printAssetTable(title, assets, limit = 8) {
  console.log(`\n${title}`);

  assets.slice(0, limit).forEach((asset) => {
    const initialTag = asset.initial ? 'initial' : 'async';
    console.log(`  ${asset.relativePath} (${initialTag}) - ${formatSizePair(asset)}`);
  });
}

const budget = readJson(budgetPath);
const budgets = budget.budgets || {};
const warningBudgets = budget.warnings || {};
const distDir = path.resolve(projectRoot, budget.distDir || 'dist');
const initialAssetPatterns = budget.initialAssetPatterns || [];

if (!fs.existsSync(distDir)) {
  console.error(`Build output not found at ${distDir}`);
  console.error('Run `yarn build` before running the performance regression spotter.');
  process.exit(1);
}

const assets = walkFiles(distDir)
  .filter((filePath) => /\.(js|css)$/.test(filePath))
  .map((filePath) => {
    const contents = fs.readFileSync(filePath);
    const relativePath = path.relative(distDir, filePath).split(path.sep).join('/');
    const type = path.extname(filePath).slice(1);

    return {
      relativePath,
      type,
      rawBytes: contents.length,
      gzipBytes: zlib.gzipSync(contents, { level: 9 }).length,
      initial: matchesAnyPattern(relativePath, initialAssetPatterns),
    };
  })
  .sort((a, b) => b.rawBytes - a.rawBytes);

if (assets.length === 0) {
  console.error(`No JS or CSS assets found in ${distDir}`);
  process.exit(1);
}

const jsAssets = assets.filter((asset) => asset.type === 'js');
const cssAssets = assets.filter((asset) => asset.type === 'css');
const initialJsAssets = jsAssets.filter((asset) => asset.initial);
const initialCssAssets = cssAssets.filter((asset) => asset.initial);
const routeJsAssets = jsAssets.filter((asset) => !asset.initial);
const routeCssAssets = cssAssets.filter((asset) => !asset.initial);
const totals = {
  js: totalAssets(jsAssets),
  css: totalAssets(cssAssets),
};
const failures = [];
const warnings = [];

failures.push(...overBudgetMessages('total JS', totals.js, budgets.totalJs));
failures.push(...overBudgetMessages('total CSS', totals.css, budgets.totalCss));

initialJsAssets.forEach((asset) => {
  failures.push(
    ...overBudgetMessages(
      `initial JS asset ${asset.relativePath}`,
      asset,
      budgets.largestInitialJsChunk,
    ),
  );
});

initialCssAssets.forEach((asset) => {
  failures.push(
    ...overBudgetMessages(
      `initial CSS asset ${asset.relativePath}`,
      asset,
      budgets.largestInitialCssChunk,
    ),
  );
});

routeJsAssets.forEach((asset) => {
  warnings.push(...overBudgetMessages(`route JS asset ${asset.relativePath}`, asset, warningBudgets.routeJsChunk));
});

routeCssAssets.forEach((asset) => {
  warnings.push(
    ...overBudgetMessages(`route CSS asset ${asset.relativePath}`, asset, warningBudgets.routeCssChunk),
  );
});

console.log('Performance Regression Spotter');
console.log(`Dist: ${distDir}`);
console.log(`JS total:  ${formatSizePair(totals.js)}`);
console.log(`CSS total: ${formatSizePair(totals.css)}`);
console.log(`Initial assets: ${initialJsAssets.length + initialCssAssets.length}`);

printAssetTable('Largest JS/CSS assets:', assets);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  warnings.forEach((warning) => console.log(`  WARN ${warning}`));
}

if (failures.length > 0) {
  console.log('\nBudget failures:');
  failures.forEach((failure) => console.log(`  FAIL ${failure}`));
  process.exit(1);
}

console.log('\nAll performance budgets passed.');
