// The AngularJS "dot rule", enforced.
//
// ng-if, ng-repeat and ng-switch create a CHILD scope. An ng-model bound to a
// bare identifier inside one of them writes to the child, shadowing the
// controller's property — the controller keeps reading its own untouched value.
// That is invisible in the browser (the field shows what you typed) and silent
// on save (the controller submits the stale value), which is exactly how the
// device-environment editor shipped writing {} over what the user typed.
//
// Binding through an object (`form.draft`) resolves the object on the parent and
// mutates it in place, so parent and child see the same value.
//
// Plain node, no build and no browser: npm run test:ng-scope

const fs = require('fs');
const path = require('path');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
const SCOPE_DIRECTIVES = ['ng-if', 'ng-repeat', 'ng-switch', 'ng-include', 'ng-view'];

function scopeCreators(attrs) {
  return SCOPE_DIRECTIVES.filter((d) => new RegExp('(^|\\s)' + d + '\\s*=').test(attrs));
}

function checkFile(file) {
  const html = fs.readFileSync(file, 'utf8');
  const tag = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const stack = [];
  const violations = [];
  let match;

  while ((match = tag.exec(html)) !== null) {
    const [full, closing, name, attrs, selfClosing] = match;
    const lower = name.toLowerCase();

    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].name === lower) { stack.length = i; break; }
      }
      continue;
    }

    const creators = scopeCreators(attrs);
    const model = attrs.match(/\sng-model\s*=\s*"([^"]+)"/);

    if (model) {
      const expression = model[1].trim();
      const ancestors = stack.filter((e) => e.creators.length).map((e) => e.name + '[' + e.creators.join(',') + ']');
      const own = creators.length ? [name + '[' + creators.join(',') + ']'] : [];
      const scopes = ancestors.concat(own);
      const dotted = expression.includes('.') || expression.startsWith('$parent.');
      if (scopes.length && !dotted) {
        violations.push({
          line: html.slice(0, match.index).split('\n').length,
          expression,
          inside: scopes.join(' > '),
        });
      }
    }

    if (!selfClosing && !VOID.has(lower)) {
      stack.push({ name: lower, creators });
    }
  }

  return violations;
}

const roots = [path.join(__dirname, '..', 'app', 'views'), path.join(__dirname, '..', 'app', 'tpl')];
const files = [];

for (const root of roots) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) files.push(full);
    }
  };
  if (fs.existsSync(root)) walk(root);
}

let total = 0;

for (const file of files.sort()) {
  const violations = checkFile(file);
  total += violations.length;
  for (const v of violations) {
    console.log('FAIL ' + path.relative(path.join(__dirname, '..'), file) + ':' + v.line +
      ' ng-model="' + v.expression + '" inside ' + v.inside + ' — bind through an object');
  }
}

console.log(total === 0
  ? 'ok   no ng-model binds a bare identifier inside a child scope (' + files.length + ' templates)'
  : total + ' scope-shadowing binding(s) found in ' + files.length + ' templates');

process.exit(total ? 1 : 0);
