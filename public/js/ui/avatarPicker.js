// 玩家头像面板 (TASK-004)：全局悬浮层，大厅点自己的头像打开（ui/avatar.js 存选择与同步状态）。
//
// 一份可选清单 = 全部带头像素材的干员（210 个，随包素材里已有），支持搜索；第一项是「不使用头像」。
// 选完立即生效（大厅、房间成员、对局队伍里的头像都跟着变），并同步到账号画像。

import { useEffect, useState } from '../../vendor/hooks.module.js';
import { html, Button, Modal } from './components.js';
import { useStore } from '../store.js';
import { t } from '../../shared/i18n.js';
import { avatarStore, avatarChoices, closeAvatarPicker, loadAvatarData, setAvatar } from './avatar.js';

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
  useEffect(() => { loadAvatarData(); }, []);

  const all = avatarChoices();
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : all;

  const pick = (id) => { setAvatar(id); closeAvatarPicker(); };

  // 宽度按项目约定写 `min(设计宽度, 视口百分比)`：1rem = min(100vw/19.2, 100vh/10.8)（theme.css），
  // 只写 rem 会在窄屏（手机上 1rem 被夹到 40px）横向溢出、右侧被裁掉 —— 面板要够宽放网格，故取 13rem ≈ 设计宽度的 2/3。
  return html`<${Modal} open=${true} onClose=${closeAvatarPicker} title=${t('选择头像')} micro="PLAYER AVATAR" width="min(13rem, 94vw)"
      actions=${html`<${Button} variant="ghost" onClick=${closeAvatarPicker}>${t('关闭')}<//>`}>
    <div class="avatar-pick">
      <div class="avatar-pick__bar">
        <input type="search" class="avatar-pick__search" value=${query} placeholder=${t('搜索干员')} aria-label=${t('搜索干员')}
          onInput=${(e) => setQuery(String(e.currentTarget.value).slice(0, 24))} />
        <${Button} variant="secondary" icon="user" disabled=${!current} onClick=${() => pick('')}>${t('不使用头像')}<//>
      </div>
      <p class="avatar-pick__hint">${t('头像存在账号里，换设备也跟着你；房间成员、对局队伍和战绩里的其他人也能看到。')}</p>
      ${shown.length ? html`<div class="avatar-pick__grid">
        ${shown.map((c) => html`<button type="button" class=${`avatar-pick__cell${c.id === current ? ' is-on' : ''}`}
            title=${c.name} aria-label=${c.name} aria-pressed=${c.id === current}
            onClick=${() => pick(c.id)}>
          <img src=${c.url} alt="" draggable=${false} loading="lazy" />
          <span class="avatar-pick__name">${c.name}</span>
        </button>`)}
      </div>` : html`<p class="avatar-pick__hint">${t('没有匹配的干员。')}</p>`}
    </div>
  <//>`;
}
