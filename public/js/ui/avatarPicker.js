// 玩家头像面板 (TASK-004)：全局悬浮层，大厅点自己的头像打开（ui/avatar.js 存选择与同步状态）。
//
// 可选清单来自随包素材；只在搜索后展示匹配头像，「不使用头像」始终可用。
// 选完立即生效（大厅、房间成员、对局队伍里的头像都跟着变），并同步到账号画像。

import { useState } from '../../vendor/hooks.module.js';
import { html, Button, Modal } from './components.js';
import { useStore } from '../store.js';
import { useData } from '../data.js';
import { t } from '../../../shared/i18n.js';
import { avatarStore, avatarChoices, closeAvatarPicker, setAvatar } from './avatar.js';

/** 面板宿主：挂在 app 的悬浮层区域（main.js），和 LoadoutHost / StatsHost 并列。 */
export function AvatarHost() {
  const open = useStore((s) => s.open, Object.is, avatarStore);
  if (!open) return null;
  return html`<${AvatarPicker} />`;
}

/** 头像选择面板。 */
export function AvatarPicker() {
  const current = useStore((s) => s.id, Object.is, avatarStore);
  const [query, setQuery] = useState('');
  const ready = useData('assets', 'chess');

  const q = query.trim().toLowerCase();
  const shown = q && ready ? avatarChoices().filter((choice) => choice.search.toLowerCase().includes(q)) : [];

  const pick = (id) => { setAvatar(id); closeAvatarPicker(); };

  // 宽度按项目约定写 `min(设计宽度, 视口百分比)`：1rem = min(100vw/19.2, 100vh/10.8)（theme.css），
  // 只写 rem 会在窄屏（手机上 1rem 被夹到 40px）横向溢出、右侧被裁掉 —— 面板要够宽放网格，故取 13rem ≈ 设计宽度的 2/3。
  return html`<${Modal} open=${true} onClose=${closeAvatarPicker} title=${t('选择头像')} micro="PLAYER AVATAR" width="min(13rem, 94vw)"
      actions=${html`<${Button} variant="ghost" onClick=${closeAvatarPicker}>${t('关闭')}<//>`}>
    <div class="avatar-pick">
      <div class="avatar-pick__bar">
        <input type="search" class="avatar-pick__search" value=${query} placeholder=${t('搜索干员或皮肤')} aria-label=${t('搜索干员或皮肤')}
          onInput=${(e) => setQuery(String(e.currentTarget.value).slice(0, 24))} />
        <${Button} variant="secondary" icon="user" disabled=${!current} onClick=${() => pick('')}>${t('不使用头像')}<//>
      </div>
      <p class="avatar-pick__hint">${t('头像存在账号里，换设备也跟着你；房间成员、对局队伍和战绩里的其他人也能看到。')}</p>
      ${!q ? html`<p class="avatar-pick__hint">${t('输入干员或皮肤名称开始搜索。')}</p>` : !ready ? html`<p class="avatar-pick__hint">${t('正在载入配置…')}</p>` : shown.length ? html`<div class="avatar-pick__grid">
        ${shown.map((c) => html`<button type="button" class=${`avatar-pick__cell${c.id === current ? ' is-on' : ''}`}
            title=${`${c.name} · ${c.variant}`} aria-label=${`${c.name} · ${c.variant}`} aria-pressed=${c.id === current}
            onClick=${() => pick(c.id)}>
          <img src=${c.url} alt="" draggable=${false} loading="lazy" />
          <span class="avatar-pick__name">${c.name}</span>
          <span class="avatar-pick__variant">${c.variant === '默认' || c.variant === '精英2' ? t(c.variant) : c.variant}</span>
        </button>`)}
      </div>` : html`<p class="avatar-pick__hint">${t('没有匹配的头像。')}</p>`}
    </div>
  <//>`;
}
