import { createPreloader } from './preload.js';
import { assets, spinePages } from '../assets.js';
import { getChess } from '../data.js';
import { loadPref } from '../store.js';
import { groupImages, sceneGroup } from '../render/board3d/load.js';
import { themeForStage } from '../render/board3d/theme.js';

export function warmupUrls(state) {
  const priv = state.match?.private;
  if (!state.room || !priv) return [];
  const stageId = state.match?.public?.stageId;
  const urls = [];
  if (stageId) {
    for (const name of ['scene', 'bin']) urls.push(assets.localUrl(sceneGroup(stageId), name));
    const images = groupImages(null, themeForStage(stageId));
    for (const name of ['D', 'BG', 'gate']) {
      const slot = images[name];
      if (slot) urls.push(assets.localUrl(...slot));
    }
  }
  const pieces = [...(priv.board || []), ...(priv.hand || []), ...(priv.temp || []), ...(priv.shop?.slots || [])];
  const seen = new Set();
  for (const piece of pieces) {
    if (!piece || piece.kind !== 'chess') continue;
    const record = getChess(piece.id);
    const charId = record?.charId;
    const key = charId + ':' + (piece.skin || '');
    if (!charId || seen.has(key)) continue;
    seen.add(key);
    urls.push(assets.avatar(charId));
    const entry = assets.spineEntry(charId, { skin: piece.skin });
    if (entry) urls.push(entry.skel, entry.atlas, ...spinePages(entry));
    if (seen.size >= 6) break;
  }
  const enemies = [...new Set((priv.nextEnemies || []).map(enemy => enemy.enemyKey))].slice(0, 4);
  for (const enemyKey of enemies) {
    const entry = assets.spineEntry(enemyKey);
    if (entry) urls.push(entry.skel, entry.atlas, ...spinePages(entry));
  }
  return urls.filter(Boolean);
}

export function installResourceWarmup(store) {
  const lowMemory = Number(globalThis.navigator?.deviceMemory) <= 4;
  const preloader = createPreloader({ maxFiles: lowMemory ? 20 : 40, maxBytes: (lowMemory ? 8 : 16) * 1024 * 1024 });
  let timer = null;
  let generation = 0;
  let lastKey = '';
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.room === previous.room && state.match?.private === previous.match?.private) return;
    clearTimeout(timer);
    const request = ++generation;
    if (!state.room) { preloader.cancel(); lastKey = ''; return; }
    if (globalThis.navigator?.connection?.saveData || loadPref('resourceWarmup', true) === false) return;
    timer = setTimeout(async () => {
      await Promise.all([assets.ready(), assets.local()]);
      if (request !== generation) return;
      const urls = warmupUrls(store.get());
      const key = urls.join('|');
      if (key === lastKey) return;
      lastKey = key;
      preloader.run(urls).catch(() => {});
    }, 400);
  });
  return { status: () => preloader.status, dispose() {
    generation++;
    clearTimeout(timer);
    unsubscribe();
    preloader.cancel();
  } };
}
