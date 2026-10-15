import { assets } from '../assets.js';
import { data } from '../data.js';
import { createPreloader } from './preload.js';

const BASE_UI_KEYS = [
  'modeIcon/mode_funny_icon', 'modeIcon/mode_normal_icon', 'modeIcon/mode_hard_icon', 'modeIcon/mode_abyss_icon',
  'garrisonTypeIcon/icon_battle', 'garrisonTypeIcon/icon_bond', 'garrisonTypeIcon/icon_gold', 'garrisonTypeIcon/icon_support',
  'shopPanel/frame', 'shopPanel/bg_open_1', 'shopPanel/bg_money', 'shopPanel/refresh_icon', 'shopPanel/frozen_icon',
  'shopCard/bg_common', 'shopCard/bg_empty', 'shopCard/frame_lv1', 'shopCard/frame_lv2', 'shopCard/frame_lv3',
  'shopCard/img_chess_level_1', 'shopCard/img_chess_level_2', 'shopCard/img_chess_level_3',
  'hudPanel/frame_mid_normal', 'hudPanel/bg_rest', 'hudPanel/bg_round', 'hudPanel/bg_battle',
  'hudPanel/frame_left', 'hudPanel/bg_right', 'hudPanel/icon_battle',
];
const BASE_LOCAL_KEYS = [
  'bg_board', 'bg_battle', 'bg_rest', 'frame_mid_normal', 'btn_check_enemy',
];

export function basePrecacheUrls(assetSource = assets) {
  const urls = BASE_UI_KEYS.map((key) => assetSource.ui(key));
  for (const name of BASE_LOCAL_KEYS) urls.push(assetSource.localUrl('ui/battle', name));
  return [...new Set(urls.filter((url) => typeof url === 'string' && url.startsWith('/')))];
}

export function createBrowserPrecache({ assetSource = assets, lowMemory = Number(globalThis.navigator?.deviceMemory) <= 4 } = {}) {
  const preloader = createPreloader({ maxFiles: 40, maxBytes: (lowMemory ? 12 : 24) * 1024 * 1024 });
  const listeners = new Set();
  let current = { phase: 'idle', done: 0, failed: 0, total: 0, bytes: 0 };
  let running = null;
  const publish = (next) => {
    current = { ...current, ...next };
    for (const listener of listeners) listener(current);
  };
  return {
    get status() { return current; },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (running || current.phase === 'complete') return running || Promise.resolve(current);
      publish({ phase: 'loading', done: 0, failed: 0, total: 0, bytes: 0 });
      running = (async () => {
        const [manifest, localManifest] = await Promise.all([data.load('assets'), data.load('local')]);
        assetSource.seed?.(manifest);
        assetSource.seedLocal?.(localManifest);
        await Promise.all([assetSource.ready(), assetSource.local()]);
        const urls = basePrecacheUrls(assetSource);
        if (!urls.length) {
          publish({ phase: 'failed' });
          return current;
        }
        const result = await preloader.run(urls, (progress) => publish({ phase: 'loading', ...progress }));
        publish({ ...result, phase: result.done === result.total ? 'complete' : 'failed' });
        return current;
      })().catch(() => {
        publish({ phase: 'failed' });
        return current;
      }).finally(() => { running = null; });
      return running;
    },
  };
}

export const browserPrecache = createBrowserPrecache();
