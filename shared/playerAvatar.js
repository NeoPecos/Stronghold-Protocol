export function playerAvatarUrl(assets, id) {
  if (typeof id !== 'string' || !id) return '';
  const chars = assets?.chars;
  if (!chars || typeof chars !== 'object') return '';

  if (id.startsWith('e2:')) {
    const charId = id.slice(3);
    return Object.hasOwn(chars, charId) ? chars[charId]?.avatarE2 || '' : '';
  }

  if (id.startsWith('skin:')) {
    const separator = id.indexOf(':', 5);
    if (separator < 0) return '';
    const charId = id.slice(5, separator);
    const skinId = id.slice(separator + 1);
    if (!Object.hasOwn(chars, charId)) return '';
    const skins = chars[charId]?.skins;
    return skins && Object.hasOwn(skins, skinId) ? skins[skinId]?.avatar || '' : '';
  }

  return Object.hasOwn(chars, id) ? chars[id]?.avatar || '' : '';
}
