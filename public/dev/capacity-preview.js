// 席位容量（4/6/8/10/16/20）界面的本地预览页 —— 只画界面，不连服务器、不改任何线上文件。
//
// 为什么单独做一页：TASK-045（可变人数同盟房间）还在 Codex 手里做后端，
// 但界面长什么样维护者要先看。所以这里用假数据把两处控件（大厅的「同盟席位」、房间的「人数上限」）
// 和 20 席座位网格按我们的视觉语言画出来，并且**不假装能开局**：
// 现在线上只支持 4 席，选 6 席及以上会明确提示「服务端未就绪」。
import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

/** 我们仓库的档位（比参考分支多一档 6，见 TASK-045：维护者要求加 6 人档）。 */
const CAPACITIES = [4, 6, 8, 10, 16, 20];
/** 线上现状：只有 4 席真正能开局，其余等 TASK-045 的服务端容量支持。 */
const LIVE_CAPACITY = 4;
/** 座位网格的列数：4 席一行放得下，人多时折成两行更好认。 */
const COLUMNS = { 4: 4, 6: 6, 8: 4, 10: 5, 16: 8, 20: 10 };

const SAMPLE = [
  { name: '草莓', tag: '房主' },
  { name: '德克萨斯', tag: '' },
  { name: '雷蛇', tag: '' },
  { name: '隐现', tag: '' },
  { name: '史尔特尔', tag: '' },
  { name: 'AI · 坚守', tag: 'AI' },
];

function seatsFor(capacity) {
  const out = [];
  for (let i = 0; i < capacity; i += 1) out.push(SAMPLE[i] || null);
  return out;
}

function Section({ title, micro, children }) {
  return html`<section class="cp-section">
    <h2>${title}<span>${micro}</span></h2>
    ${children}
  </section>`;
}

function LobbyCapacity() {
  const [capacity, setCapacity] = useState(4);
  return html`<${Section} title="① 大厅 · 创建同盟" micro="SIMULATION PROTOCOL SELECT">
    <div class="cp-frame">
      <div class="capacity-select">
        <div class="capacity-select__label">同盟席位<span class="t-dim" style="font-size:calc(.13 * var(--t));font-weight:400">ROOM CAPACITY</span></div>
        <div class="capacity-select__options" role="radiogroup" aria-label="同盟人数上限">
          ${CAPACITIES.map((n) => html`<button key=${n} type="button" role="radio"
            aria-checked=${capacity === n ? 'true' : 'false'}
            class=${`capacity-select__opt tapx${capacity === n ? ' is-active' : ''}${n > LIVE_CAPACITY ? ' is-locked' : ''}`}
            onClick=${() => setCapacity(n)}>${n} 人</button>`)}
        </div>
      </div>
      <div class="cp-note">
        ${capacity <= LIVE_CAPACITY
          ? html`当前线上：<b style="color:var(--mint-400)">${capacity} 席可用</b>（现状不变）。`
          : html`<span class="cp-flag">服务端未就绪</span> ${capacity} 席现在还开不了局 —— 需要 TASK-045 的服务端容量支持，
              本预览只展示样子，不假装能开局。`}
      </div>
    </div>
  <//>`;
}

function RoomCapacityRow() {
  const [capacity, setCapacity] = useState(4);
  const occupied = seatsFor(capacity).filter(Boolean).length;
  return html`<${Section} title="② 房间 · 人数上限（房主可调）" micro="ROOM">
    <div class="cp-frame">
      <div class="room-capacity">
        <span class="room-capacity__label">人数上限 <b class="num">${capacity}</b> 人</span>
        <div class="room-capacity__options" role="radiogroup" aria-label="调整同盟人数上限">
          ${CAPACITIES.map((n) => html`<button key=${n} type="button" role="radio"
            aria-checked=${capacity === n ? 'true' : 'false'} disabled=${n > LIVE_CAPACITY}
            title=${n > LIVE_CAPACITY ? '服务端未就绪（TASK-045）' : `${n} 人房间`}
            class=${`room-capacity__opt tapx${capacity === n ? ' is-active' : ''}`}
            onClick=${() => n <= LIVE_CAPACITY && setCapacity(n)}>${n}</button>`)}
        </div>
        <span class="room-capacity__count num">${occupied} / ${capacity}</span>
        <span class="room-matchmaking is-on"><span class="t-dim">允许匹配</span></span>
      </div>
      <div class="cp-note">房主之外的人看到的是「由房主设置」（只读）。已占席位 ${occupied}，空位 ${capacity - occupied}；
        开局规则不变（按已占的人类/AI 席位算，不要求坐满）。</div>
    </div>
  <//>`;
}

function SeatGrid() {
  const [capacity, setCapacity] = useState(20);
  const seats = seatsFor(capacity);
  return html`<${Section} title="③ 座位网格（按人数换列数）" micro="SEATS">
    <div class="cp-frame">
      <div class="room-capacity" style="justify-content:flex-start;padding-left:0">
        <span class="room-capacity__label">预览人数上限 <b class="num">${capacity}</b> 人</span>
        <div class="room-capacity__options" role="radiogroup" aria-label="预览人数">
          ${CAPACITIES.map((n) => html`<button key=${n} type="button" role="radio"
            aria-checked=${capacity === n ? 'true' : 'false'}
            class=${`room-capacity__opt tapx${capacity === n ? ' is-active' : ''}`}
            onClick=${() => setCapacity(n)}>${n}</button>`)}
        </div>
      </div>
      <div class="cp-seats" style=${`grid-template-columns:repeat(${COLUMNS[capacity]}, minmax(0, 1fr))`}>
        ${seats.map((s, i) => html`<div key=${i}
          class=${`cp-seat${s ? (i === 0 ? ' is-me' : '') : ' is-empty'}`}>
          <span class="cp-seat__no">${i + 1}</span>
          ${s
            ? html`<span class="cp-seat__name">${s.name}</span>${s.tag ? html`<span class="cp-seat__tag">${s.tag}</span>` : null}`
            : html`<span class="cp-seat__name t-dim">空位</span>`}
        </div>`)}
      </div>
      <div class="cp-stats">
        <span>人数上限 <b>${capacity}</b></span>
        <span>已占 <b>${seats.filter(Boolean).length}</b></span>
        <span>空位 <b>${capacity - seats.filter(Boolean).length}</b></span>
        <span>列数 <b>${COLUMNS[capacity]}</b> × 行数 <b>${Math.ceil(capacity / COLUMNS[capacity])}</b></span>
      </div>
    </div>
  <//>`;
}

function App() {
  return html`<div>
    <header class="cp-head">
      <h1>席位容量 · 本地预览</h1>
      <div class="t-dim" style="font-size:calc(.16 * var(--t))">
        4 / 6 / 8 / 10 / 16 / 20 席的界面样子 —— 来自 LongQianChen 参考分支的控件，按我们的样式重画。
      </div>
      <div class="cp-warn">
        <b>这不是线上状态。</b>
        <span>线上（0.2.6）只有 4 席；6 席及以上要等 TASK-045 的服务端容量支持。本页只画界面：不连服务器、不改线上文件，
          也不会出现「开局」按钮假装大房能开。</span>
      </div>
    </header>
    <${LobbyCapacity} />
    <${RoomCapacityRow} />
    <${SeatGrid} />
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
