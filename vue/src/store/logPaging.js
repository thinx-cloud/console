// Shared helpers for the paged log endpoints (phase 26, D-02).
// GET /api/v2/logs/{audit|build}?limit=100[&cursor=…] answers
// {success, response: [...], paging: {limit, has_more, next_cursor}}.
// The cursor is opaque server data: never parsed or built here, only URL-encoded.

export const PAGE_SIZE = 100;

export function normPaging(p) {
  const src = p && typeof p === 'object' ? p : {};
  const cursor = typeof src.next_cursor === 'string' && src.next_cursor.length ? src.next_cursor : null;
  const limit = typeof src.limit === 'number' && Number.isFinite(src.limit) && src.limit > 0 ? src.limit : PAGE_SIZE;
  return {
    limit,
    has_more: src.has_more === true && cursor !== null,
    next_cursor: cursor,
  };
}

export function pagedPath(base, cursor) {
  let out = `${base}?limit=${PAGE_SIZE}`;
  if (typeof cursor === 'string' && cursor.length) {
    out += `&cursor=${encodeURIComponent(cursor)}`;
  }
  return out;
}
