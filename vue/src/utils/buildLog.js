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
