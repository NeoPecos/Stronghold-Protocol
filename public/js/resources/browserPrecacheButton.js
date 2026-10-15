import { useEffect, useState } from '../../vendor/hooks.module.js';
import { html } from '../ui/components.js';
import { isNativeClient } from '../ui/device.js';
import { loadPref } from '../store.js';
import { t } from '../../../shared/i18n.js';
import { browserPrecache } from './browserPrecache.js';

export function BrowserPrecacheButton() {
  const [status, setStatus] = useState(browserPrecache.status);
  useEffect(() => {
    if (isNativeClient()) return undefined;
    const unsubscribe = browserPrecache.subscribe(setStatus);
    if (!globalThis.navigator?.connection?.saveData && loadPref('resourceWarmup', true) !== false) browserPrecache.start();
    return unsubscribe;
  }, []);
  if (isNativeClient()) return null;
  const active = status.phase === 'loading';
  const label = active ? t('缓存素材 {done}/{total}', { done: status.done, total: status.total })
    : status.phase === 'complete' ? t('素材已缓存')
      : status.phase === 'failed' ? t('缓存未完成，点击重试') : t('预缓存素材');
  return html`<button type="button" class="browser-precache" aria-live="polite" disabled=${active || status.phase === 'complete'}
    title=${label} onClick=${() => browserPrecache.start()}>${label}</button>`;
}
