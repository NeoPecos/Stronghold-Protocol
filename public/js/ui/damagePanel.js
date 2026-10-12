import { html, useTicker, Modal, Button } from './components.js';
import { t } from '../../../shared/i18n.js';
import { data } from '../data.js';

export function DamagePanel({ runner, fieldId = null, players = [], onClose }) {
  useTicker(500);
  const report = runner?.damageReport?.(fieldId);
  const number = value => Math.round(Number(value) || 0).toLocaleString();
  return html`<${Modal} open=${true} title=${t('干员伤害统计')} onClose=${onClose} width="min(6.8rem, 94vw)"
    actions=${html`<${Button} onClick=${onClose}>${t('关闭')}<//>`}>
    <p class="t-lo">${t('当前战场的干员实际伤害；平均 DPS 按模拟时间计算，暂停不计时。')}</p>
    ${report?.units?.length ? html`<div class="damage-panel__scroll"><table class="damage-panel__table">
      <thead><tr><th>${t('干员')}</th><th>${t('博士')}</th><th>${t('总伤害')}</th><th>DPS</th></tr></thead>
      <tbody>${report.units.map(unit => html`<tr key=${unit.id}>
        <td>${data.localeName(unit.name)}</td><td>${players.find(player => player.playerId === unit.ownerId)?.name || '—'}</td>
        <td>${number(unit.damage)}</td><td>${number(unit.dps)}</td>
      </tr>`)}</tbody></table></div>
      <p>${t('战斗时间：{seconds} 秒', { seconds: report.seconds.toFixed(1) })}</p>`
      : html`<p>${t('当前没有可查看的战斗统计')}</p>`}
  <//>`;
}
