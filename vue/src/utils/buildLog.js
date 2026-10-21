// Full build-log responses can contain a JSON-serialized Node Buffer or old
// nested log records. Convert both to plain text; the dialog renders it with
// interpolation, never as HTML.
export function buildLogText(detail) {
  if (typeof detail === 'string') return detail;
  if (!detail || typeof detail !== 'object') return '';
  if (Array.isArray(detail)) return lines(detail).join('\n');
  const contents = detail.contents;
  if (typeof contents === 'string' && contents.length) return contents;
  if (contents && contents.type === 'Buffer' && Array.isArray(contents.data)) {
    const text = new TextDecoder('utf-8').decode(new Uint8Array(contents.data));
    if (text) return text;
  }
  function lines(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.flatMap(entry => {
      if (typeof entry === 'string') return [entry];
      if (!entry || typeof entry !== 'object') return [];
      if (Array.isArray(entry.log)) return lines(entry.log);
      return [entry.contents || entry.message || ''].filter(Boolean);
    });
  }
  return lines(detail.log).join('\n');
}

// The one rule every build list and the dialog use to decide whether a row has a build log:
// only a non-empty string build_id counts; a list-index id or a non-string id never does
// (47-REVIEW WR-01).
export function hasBuildLog(build) {
  return !!build && typeof build.build_id === 'string' && build.build_id !== '';
}

// One colour per normalized build status, shared by every build list (TIMEOUT is not a failure colour).
export function buildStatusVariant(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'OK') return 'success';
  if (normalized === 'TIMEOUT') return 'warning';
  if (normalized === 'RUNNING') return 'info';
  return 'danger';
}

// Plain-text, case-insensitive search for the build log dialog (Phase 47 BUILD-03). The term
// is escaped into a literal pattern and matched on the original text, so every index stays
// aligned (lower-casing can change string length). Matches never overlap; at most `limit`
// become match segments, a further one sets `capped` and the rest stays one plain segment.
export function buildLogSearch(text, term, limit = 1000) {
  if (typeof text !== 'string' || !text) return { segments: [], count: 0, capped: false };
  if (typeof term !== 'string' || term.length < 3 || term.trim() === '') {
    return { segments: [{ text, match: false }], count: 0, capped: false };
  }
  const pattern = new RegExp(escapeRegExp(term), 'gi');
  const segments = [];
  let count = 0;
  let capped = false;
  let last = 0;
  let found;
  while ((found = pattern.exec(text)) !== null) {
    if (!found[0]) { pattern.lastIndex++; continue; }
    if (count >= limit) { capped = true; break; }
    if (found.index > last) segments.push({ text: text.slice(last, found.index), match: false });
    segments.push({ text: found[0], match: true, index: count });
    count++;
    last = found.index + found[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return { segments, count, capped };
}

function escapeRegExp(value) {
  return value.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
}
