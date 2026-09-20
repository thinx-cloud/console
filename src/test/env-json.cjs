// Unit test for the device-environment JSON validator in app/js/thinx-api.js.
//
// The device editor refuses to submit anything this rejects, so the rules here
// are the contract: what reaches PUT /device/edit as `environment` is always a
// flat object of scalars, which is what the builder writes to environment.json
// and what the console renders as a key/value table.
//
// Plain node, no build and no browser: npm run test:env

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'thinx-api.js'), 'utf8');
const declaration = source.match(/function parseEnvironmentJSON\([\s\S]*?\n\}/);

if (!declaration) {
  console.error('FAIL: parseEnvironmentJSON is gone from app/js/thinx-api.js');
  process.exit(1);
}

// eslint-disable-next-line no-eval
eval(declaration[0]);

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

// The editor shows the parser's own message, so it has to be a usable string.
const broken = parseEnvironmentJSON('{"a":');
check('parser message is non-empty', !broken.ok && broken.error.length > 0);

process.exit(failures ? 1 : 0);
