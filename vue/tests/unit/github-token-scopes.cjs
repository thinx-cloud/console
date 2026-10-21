// The Profile GitHub token panel names the scopes THiNX needs (it only reads and adds the
// account's SSH keys: GET/POST /user/keys), and maps the API's 403 missing-scope answer.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../src/pages/Profile/Profile.vue'), 'utf8');
const template = source.slice(source.indexOf('<template>'), source.indexOf('</template>'));
const panel = template.slice(template.indexOf('title="GitHub Access Token"'));

const D03 = "Deploy keys can't be created right now, try again later.";

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
  // Phase 40 D-03: the key service refusal gets the same fixed sentence as the Deploy Keys
  // page, byte for byte, and the existing codes keep theirs.
  ['a 503 key_service_unavailable gets exactly the D-03 sentence', () => {
    const line = source.split('\n').find((l) => /^\s*key_service_unavailable:/.test(l));
    assert.ok(line, 'the messages map has key_service_unavailable');
    assert.strictEqual(line.trim(), 'key_service_unavailable: "' + D03 + '",');
  }],
  ['the existing GitHub-link codes keep their sentences', () => {
    const expected = {
      missing_token: 'No token was provided.',
      invalid_owner: 'Your session is no longer valid. Please sign in again.',
      token_store_failed: 'The token could not be stored. Please try again.',
      rsa_key_creation_failed: 'Could not create an RSA key for your account. Please try again.',
    };
    for (const [code, sentence] of Object.entries(expected)) {
      assert.ok(source.includes(code + ": '" + sentence + "',"), code);
    }
  }],
  ['the link result explains keys skipped as in use elsewhere', () => {
    assert.ok(source.includes('r.keys_in_use_elsewhere'));
    assert.ok(source.includes('already registered on another GitHub account or as a repository deploy key'));
  }],
];

let failed = 0;
for (const [name, fn] of checks) {
  try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + (e.message ? ' (' + e.message + ')' : '')); }
}
if (failed) process.exit(1);
