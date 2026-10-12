import { useEffect, useState } from '../../vendor/hooks.module.js';
import { html, Button } from './components.js';
import { net } from '../net.js';
import { toastError } from './toasts.js';
import { t } from '../../../shared/i18n.js';

export function QuickMatch({ difficulty, online }) {
  const [queue, setQueue] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const off = net.on('match.status', message => { if (active) setQueue(message); });
    if (online) net.request('match.status').catch(() => {});
    else setQueue(null);
    return () => {
      active = false;
      off();
      if (net.status === 'online') net.request('match.cancel').catch(() => {});
    };
  }, [online, difficulty]);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try { await net.request(queue?.queued ? 'match.cancel' : 'match.queue', queue?.queued ? {} : { difficulty }); }
    catch (error) { toastError(error); }
    finally { setBusy(false); }
  };
  return html`<div class="quick-match">
    <${Button} block=${true} disabled=${!online || busy} onClick=${toggle}>
      ${queue?.queued ? t('取消匹配') : t('快速匹配')}
    <//>
    <p class="t-lo" role="status">${queue?.queued
      ? t('正在寻找同难度队友：{count}/{total}', { count: queue.players, total: queue.target })
      : t('优先加入招募中的同盟；否则满四人组队，由房主开始。')}</p>
  </div>`;
}
