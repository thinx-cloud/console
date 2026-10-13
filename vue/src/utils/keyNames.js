// Deploy key names (Phase 45, D-05..D-07): the client mirror of RSAKey.validateKeyName in
// lib/thinx/rsakey.js. The server stays the authority; this check only saves a round trip
// and names the problem while the user types. Keep the two in step: the same reason
// codes, the scan of every UTF-16 code unit before trimming (the first offending unit
// decides), and the same 120-unit limit the HTML maxlength attribute counts.
//
// Code units are compared as numbers on purpose: a regular expression with a
// control-character class trips Codacy no-control-regex (quick 261012-r9z).

export const KEY_NAME_MAX = 120;

// The reason one UTF-16 code unit makes a name unsafe, or null.
function unitProblem(c) {
  if (c < 0x20 || c === 0x7F || (c >= 0x80 && c <= 0x9F)) return 'control_chars'; // C0, DEL, C1
  if (c === 0x2028 || c === 0x2029) return 'line_separator'; // line / paragraph separator
  if ((c >= 0x202A && c <= 0x202E) || (c >= 0x2066 && c <= 0x2069) || c === 0x200E || c === 0x200F) {
    return 'bidi'; // embeddings, overrides, isolates, LRM / RLM
  }
  return null;
}

// { ok: true } or { ok: false, reason } with reason one of
// empty, too_long, control_chars, line_separator, bidi.
export function validateKeyName(name) {
  if (typeof name !== 'string') return { ok: false, reason: 'empty' };
  for (let i = 0; i < name.length; i++) {
    const reason = unitProblem(name.charCodeAt(i));
    if (reason !== null) return { ok: false, reason };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  if (trimmed.length > KEY_NAME_MAX) return { ok: false, reason: 'too_long' };
  return { ok: true };
}

// UI-SPEC Copywriting Contract: one sentence per reason, a generic one otherwise.
const MESSAGES = {
  empty: 'Enter a name for the key.',
  too_long: 'The name is longer than 120 characters.',
  control_chars: 'The name contains a control character, such as a tab or a line break.',
  line_separator: 'The name contains a hidden line or paragraph separator.',
  bidi: 'The name contains a hidden direction-override character.',
};

export function keyNameMessage(reason) {
  return typeof reason === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, reason)
    ? MESSAGES[reason]
    : 'This name is not allowed. Choose a different name.';
}
