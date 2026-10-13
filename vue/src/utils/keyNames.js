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
  if ((c >= 0x202A && c <= 0x202E) || (c >= 0x2066 && c <= 0x2069) || c === 0x200E || c === 0x200F || c === 0x061C) {
    return 'bidi'; // embeddings, overrides, isolates, LRM / RLM / ALM (45-REVIEW IN-01)
  }
  if ((c >= 0x200B && c <= 0x200D) || c === 0x2060 || c === 0xFEFF) {
    return 'invisible'; // ZWSP, ZWNJ, ZWJ, word joiner, BOM (45-REVIEW IN-01)
  }
  return null;
}

// Unicode Default_Ignorable_Code_Point: characters that render as nothing (IN-01).
function isDefaultIgnorable(cp) {
  return cp === 0x00AD || cp === 0x034F || cp === 0x061C || cp === 0x115F || cp === 0x1160
    || cp === 0x17B4 || cp === 0x17B5 || (cp >= 0x180B && cp <= 0x180F) || (cp >= 0x200B && cp <= 0x200F)
    || (cp >= 0x202A && cp <= 0x202E) || (cp >= 0x2060 && cp <= 0x206F) || cp === 0x3164
    || (cp >= 0xFE00 && cp <= 0xFE0F) || cp === 0xFEFF || cp === 0xFFA0 || (cp >= 0xFFF0 && cp <= 0xFFF8)
    || (cp >= 0x1BCA0 && cp <= 0x1BCA3) || (cp >= 0x1D173 && cp <= 0x1D17A) || (cp >= 0xE0000 && cp <= 0xE0FFF);
}

// True when the text shows at least one character that is neither whitespace nor
// default-ignorable, so a name of soft hyphens or variation selectors counts as empty.
function hasVisibleCharacter(text) {
  for (const character of text) {
    if (!isDefaultIgnorable(character.codePointAt(0)) && character.trim().length > 0) return true;
  }
  return false;
}

// { ok: true } or { ok: false, reason } with reason one of
// empty, too_long, control_chars, line_separator, bidi, invisible.
// A lone surrogate is control_chars; a name with no visible character is empty.
export function validateKeyName(name) {
  if (typeof name !== 'string') return { ok: false, reason: 'empty' };
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      const next = i + 1 < name.length ? name.charCodeAt(i + 1) : 0;
      if (next >= 0xDC00 && next <= 0xDFFF) { i++; continue; } // a surrogate pair
      return { ok: false, reason: 'control_chars' };
    }
    if (c >= 0xDC00 && c <= 0xDFFF) return { ok: false, reason: 'control_chars' };
    const reason = unitProblem(c);
    if (reason !== null) return { ok: false, reason };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0 || !hasVisibleCharacter(trimmed)) return { ok: false, reason: 'empty' };
  if (trimmed.length > KEY_NAME_MAX) return { ok: false, reason: 'too_long' };
  return { ok: true };
}

// True when `name`, trimmed, is the generated default comment `thinx-<timestamp>` of the key
// stored as `<owner>-<timestamp>`. The list shows the date for that comment, so the server
// refuses it on rename as `reserved` (45-REVIEW IN-02); the dialog says so before sending.
export function isReservedKeyName(name, filename) {
  if (typeof name !== 'string' || typeof filename !== 'string') return false;
  return name.trim() === 'thinx-' + filename.slice(filename.lastIndexOf('-') + 1);
}

// UI-SPEC Copywriting Contract: one sentence per reason, a generic one otherwise.
const MESSAGES = {
  empty: 'Enter a name for the key.',
  too_long: 'The name is longer than 120 characters.',
  control_chars: 'The name contains a control character, such as a tab or a line break.',
  line_separator: 'The name contains a hidden line or paragraph separator.',
  bidi: 'The name contains a hidden direction-override character.',
  invisible: 'The name contains an invisible character, such as a zero-width space.',
  reserved: 'This name is reserved for the key\'s default label. Choose a different name.',
};

export function keyNameMessage(reason) {
  return typeof reason === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, reason)
    ? MESSAGES[reason]
    : 'This name is not allowed. Choose a different name.';
}
