import { useEffect, useState } from '../../vendor/hooks.module.js';
import { html, Button, MicroLabel } from '../ui/components.js';
import { net } from '../net.js';
import { t } from '../../../shared/i18n.js';

const STORAGE_KEY = 'sp.latestMatchRecord';
const STAT_ROWS = [
  ['dmgDealt', () => t('造成伤害')], ['damageSharePct', () => t('输出占比')], ['bossDamage', () => t('领袖伤害')],
  ['activatedLayers', () => t('盟约层数')], ['buys', () => t('买卡次数')], ['refreshes', () => t('刷新次数')],
  ['merges', () => t('晋升次数')], ['itemsEquipped', () => t('配发装备')], ['gold', () => t('消耗资金')],
];

export function rememberResult(result, code, playerId) {
  if (!result?.players?.length || !/^[A-HJ-NP-Z]{4}$/.test(code || '')) return;
  const totalDamage = result.players.reduce((sum, player) => sum + Math.max(0, Number(player.stats?.dmgDealt) || 0), 0);
  const record = {
    code, finishedAt: Date.now(), victory: !!result.victory, difficulty: result.difficulty,
    roundsPassed: result.roundsPassed, durationMs: result.durationMs,
    ownSeat: result.players.find((player) => player.playerId === playerId)?.seat ?? null,
    players: result.players.map((player) => ({
      seat: player.seat, name: player.name, isBot: !!player.isBot,
      roundsPassed: player.roundsPassed, stats: player.stats || {},
      damageSharePct: totalDamage ? Math.round(Math.max(0, Number(player.stats?.dmgDealt) || 0) / totalDamage * 1000) / 10 : 0,
      bonds: player.bonds || [], purchases: player.purchases || [],
    })),
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch {}
}

function savedRecord() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function PlayerStats({ player, own }) {
  return html`<section class=${`match-record__player${own ? ' is-own' : ''}`}>
    <h3>${player.name}${player.isBot ? ' · AI' : ''}${own ? ` · ${t('你')}` : ''}</h3>
    <div class="match-record__stats">
      ${STAT_ROWS.map(([key, label]) => html`<div key=${key}><span>${label()}</span><b class="num">${key === 'damageSharePct' ? `${player.damageSharePct || 0}%` : Math.round(Number(key === 'buys'
        ? player.stats?.buys ?? player.purchases?.reduce((total, purchase) => total + (Number(purchase.count) || 0), 0)
        : player.stats?.[key]) || 0).toLocaleString()}</b></div>`)}
    </div>
    <div class="match-record__details">
      <div><h4>${t('盟约层数')}</h4>
        ${player.bonds?.filter((bond) => bond.layers > 0 || bond.active).length
          ? player.bonds.filter((bond) => bond.layers > 0 || bond.active).map((bond) => html`<div class="match-record__entry" key=${bond.bondId}><span>${bond.name || bond.bondId}</span><b class="num">${bond.layers || 0} ${t('层')}</b></div>`)
          : html`<p>—</p>`}</div>
      <div><h4>${t('购入卡牌')}</h4>
        ${player.purchases?.length
          ? player.purchases.map((purchase) => html`<div class="match-record__entry" key=${`${purchase.kind}:${purchase.id}`}>
              <span>${purchase.name || purchase.id}<small>${purchase.kind === 'item' ? t('装备') : t('干员')}</small></span>
              <b class="num">×${purchase.count} · ${purchase.spent || 0} ${t('资金')}
                <small>${Object.entries(purchase.byRound || {}).map(([round, count]) => `${round}R×${count}`).join(' ')}</small></b></div>`)
          : html`<p>—</p>`}</div>
    </div>
  </section>`;
}

export function MatchRecordsButton({ code = null }) {
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setRecord(null);
    const stop = net.on('records.latest', (message) => {
      if (!active) return;
      setRecord(message.record || savedRecord());
      setLoading(false);
    });
    const load = async () => {
      if (code) {
        try {
          const response = await fetch(`/api/records/${encodeURIComponent(code)}`, { cache: 'no-store' });
          if (response.ok) {
            const latest = await response.json();
            if (active) { setRecord(latest); setLoading(false); }
            return;
          }
        } catch {}
      }
      try { await net.request('records.mine'); }
      catch { if (active) { setRecord(savedRecord()); setLoading(false); } }
    };
    load();
    return () => { active = false; stop(); };
  }, [open, code]);

  return html`<${Button} variant="secondary" size="sm" onClick=${() => setOpen(true)}>${t('上局战绩')}<//>
    ${open ? html`<div class="match-record__overlay" onClick=${() => setOpen(false)}>
      <div class="match-record__dialog" role="dialog" aria-modal="true" aria-label=${t('上局战绩')} onClick=${(event) => event.stopPropagation()}>
        <header><div><${MicroLabel} tone="mint">ALLIANCE REPORT<//><h2>${t('上局战绩')}${record ? ` · ${record.code}` : ''}</h2></div>
          <${Button} variant="ghost" size="sm" onClick=${() => setOpen(false)}>${t('关闭')}<//></header>
        ${loading ? html`<p>${t('读取中…')}</p>` : record ? html`<div class="match-record__body">
          <p>${record.victory ? t('模拟完成') : t('模拟失败')} · ${t('通过回合')} ${record.roundsPassed || 0} · ${new Date(record.finishedAt).toLocaleString()}</p>
          ${record.players.map((player) => html`<${PlayerStats} key=${player.seat} player=${player} own=${player.seat === record.ownSeat} />`)}
        </div>` : html`<p>${t('暂无完整对局战绩')}</p>`}
      </div>
    </div>` : null}`;
}
