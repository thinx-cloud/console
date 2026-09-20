// Unit test for src/utils/envJson.js — the device-environment JSON validator the
// DeviceDetail editor refuses to submit against.
//
// The Vue app has no unit runner (cypress only), so the module's source is read
// and its ESM export syntax stripped before evaluation. Plain node, no build,
// no browser, no dev server: npm run test:unit

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'utils', 'envJson.js'), 'utf8');
const stripped = source.replace(/^export default[\s\S]*$/m, '').replace(/\bexport\s+/g, '');

// eslint-disable-next-line no-eval
eval(stripped);

let failures = 0;

function check(name, condition) {
  console.log((condition ? 'ok   ' : 'FAIL ') + name);
  if (!condition) failures++;
}

function accepts(name, text, expected) {
  const result = parseEnvironmentJSON(text);
  const got = result.ok ? JSON.stringify(result.value) : 'error: ' + result.error;
  check(name + ' -> ' + got, result.ok && JSON.stringify(result.value) === JSON.stringify(expected));
}

function rejects(name, text, fragment) {
  const result = parseEnvironmentJSON(text);
  check(name + ' -> ' + (result.ok ? 'accepted (should not be)' : result.error),
    !result.ok && typeof result.error === 'string' && result.error.toLowerCase().indexOf(fragment) !== -1);
}

accepts('flat object of strings', '{"ssid":"home","pass":"secret"}', { ssid: 'home', pass: 'secret' });
accepts('numbers and booleans', '{"interval":300,"debug":true}', { interval: 300, debug: true });
accepts('empty object', '{}', {});
accepts('empty text clears the environment', '   ', {});
accepts('whitespace and newlines are fine', '{\n  "a": "b"\n}\n', { a: 'b' });

rejects('trailing comma', '{"a":"b",}', 'json');
rejects('single quotes', "{'a':'b'}", 'json');
rejects('unquoted key', '{a:"b"}', 'json');
rejects('truncated', '{"a":"b"', 'json');
rejects('bare scalar', '"just a string"', 'object');
rejects('array', '[{"a":"b"}]', 'object');
rejects('null', 'null', 'object');
rejects('nested object', '{"wifi":{"ssid":"home"}}', 'wifi');
rejects('nested array', '{"list":[1,2]}', 'list');
rejects('null value', '{"a":null}', 'a');
rejects('empty key', '{"":"b"}', 'key');
rejects('whitespace-only key', '{"   ":"b"}', 'key');

// Both consoles must agree, or the same JSON would be accepted in one and refused
// in the other. Compare against the classic console's copy on the same inputs.
const classic = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'src', 'app', 'js', 'thinx-api.js'), 'utf8');
const classicFn = classic.match(/function parseEnvironmentJSON\([\s\S]*?\n\}/);
check('classic console still has parseEnvironmentJSON', !!classicFn);

if (classicFn) {
  const parseEnvironmentJSONVue = parseEnvironmentJSON;
  // eslint-disable-next-line no-eval
  eval(classicFn[0]);
  const cases = ['{"a":"b"}', '{}', '   ', '{"a":', '[1]', 'null', '{"a":{"b":1}}', '{"":"x"}', '{"n":1,"b":false}'];
  const disagreements = cases.filter((text) => {
    const a = parseEnvironmentJSONVue(text);
    const b = parseEnvironmentJSON(text);
    return a.ok !== b.ok || JSON.stringify(a.value) !== JSON.stringify(b.value);
  });
  check('both consoles agree on every case' + (disagreements.length ? ' (differs on: ' + disagreements.join(', ') + ')' : ''),
    disagreements.length === 0);
}

process.exit(failures ? 1 : 0);
