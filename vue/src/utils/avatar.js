// The API stores profile avatars as bare base64 (no `data:` prefix). Used as an
// <img src> directly, the browser resolves it as a relative URL and requests
// https://<console>/iVBORw0KGgo... — always wrap it through here.
export function avatarDataUri(avatar) {
  if (typeof avatar !== 'string' || avatar.length === 0) return null;
  if (/^(data:|https?:\/\/|blob:)/i.test(avatar)) return avatar;
  // Magic bytes in base64: JPEG starts with FF D8 FF -> "/9j/", PNG is "iVBOR".
  const mime = avatar.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
  return 'data:' + mime + ';base64,' + avatar;
}
