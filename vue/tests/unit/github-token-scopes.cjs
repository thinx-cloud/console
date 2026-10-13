// The Profile GitHub token panel names the scopes THiNX needs (it only reads and adds the
// account's SSH keys: GET/POST /user/keys), and maps the API's 403 missing-scope answer.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../src/pages/Profile/Profile.vue'), 'utf8');
const template = source.slice(source.indexOf('<template>'), source.indexOf('</template>'));
const panel = template.slice(template.indexOf('title="GitHub Access Token"'));

const checks = [
  ['the panel lists admin:public_key for classic tokens', () => assert.ok(panel.includes('<code>admin:public_key</code>'))],
  ['the panel lists read:public_key and write:public_key as the alternative', () => {
    assert.ok(panel.includes('<code>read:public_key</code>') && panel.includes('<code>write:public_key</code>'));
  }],
  ['the panel names the fine-grained permission', () => assert.ok(/<strong>Git SSH keys<\/strong>: Read and write/.test(panel))],
  ['the panel says no repo scope is needed', () => assert.ok(panel.includes('No <code>repo</code> scope is needed.'))],
  ['the classic link preselects admin:public_key', () => {
    assert.ok(panel.includes('https://github.com/settings/tokens/new?scopes=admin:public_key&amp;description=THiNX'));
  }],
  ['the scope list has a test hook', () => assert.ok(panel.includes('data-cy="github-token-scopes"'))],
  ['a 403 github_token_missing_scope gets its own message naming the scopes', () => {
    assert.ok(/github_token_missing_scope: '[^']*admin:public_key[^']*Git SSH keys: Read and write[^']*'/.test(source));
  }],
  ['github_token_invalid no longer talks about scopes', () => {
    const line = source.split('\n').find((l) => l.includes('github_token_invalid:'));
    assert.ok(line && !/scope/i.test(line), line);
  }],
  ['no raw HTML rendering on the page', () => assert.ok(!template.includes('v-html'))],
];

let failed = 0;
for (const [name, fn] of checks) {
  try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + (e.message ? ' (' + e.message + ')' : '')); }
}
if (failed) process.exit(1);
