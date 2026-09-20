// Device-environment JSON validator, shared by the DeviceDetail editor.
//
// The stored environment is a flat map of scalars: the builder writes it to
// environment.json for the firmware build, and both consoles render it as a
// key/value table. Nesting, arrays and nulls have no representation there, so
// they are rejected here rather than written and discovered at build time.
//
// The classic console carries the same rules in app/js/thinx-api.js; the two are
// kept in step by tests/unit/env-json.cjs, which runs both against the same cases.
//
// Returns { ok: true, value } or { ok: false, error }. Empty text means "no
// environment" and yields {}.
export function parseEnvironmentJSON(text) {
  const source = typeof text === "string" ? text.trim() : "";

  if (source.length === 0) {
    return { ok: true, value: {} };
  }

  let parsed;

  try {
    parsed = JSON.parse(source);
  } catch (e) {
    return { ok: false, error: "Not valid JSON: " + e.message };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: 'Environment must be a JSON object, for example { "ssid": "my-network" }.' };
  }

  for (const key of Object.keys(parsed)) {
    if (key.trim().length === 0) {
      return { ok: false, error: "An environment key cannot be empty." };
    }

    const value = parsed[key];
    const type = typeof value;

    if (value === null || (type !== "string" && type !== "number" && type !== "boolean")) {
      return { ok: false, error: 'Value of "' + key + '" must be a string, number or boolean.' };
    }

    if (type === "number" && !isFinite(value)) {
      return { ok: false, error: 'Value of "' + key + '" must be a finite number.' };
    }
  }

  return { ok: true, value: parsed };
}

export default { parseEnvironmentJSON };
