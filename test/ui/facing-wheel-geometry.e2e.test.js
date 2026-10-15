// TASK-003 — the circular deployment wheel: its SVG geometry, and that the drawn 45° sectors and the swipe snapping
// agree on where a direction begins.
//
// Paper-Yuan `0.2.4` (`e0a28445`) turned the wheel's diamond into a circular joystick with four 45° sector hit areas,
// a dashed sub-ring and a knob/beam that follows the finger. This fork keeps its own chevron-tap control on top of
// that (test/ui/facing-tap.e2e.test.js), so the wheel's visual contract is worth pinning down separately.
//
// The test renders the REAL `FacingWheel` component over a synthetic view bridge, so the geometry asserted here is the
// geometry the game draws. The point of comparing it against `dirFromDelta` (facing.js) is that a change to one
// without the other is exactly the bug that would make a press near a boundary commit the neighbouring direction:
// the wheel would light one sector while the intent carried another.
//
// Opt-in like the rest of the browser suites:  SP_E2E=1 node --test test/ui/facing-wheel-geometry.e2e.test.js
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ENABLED = process.env.SP_E2E === '1' && existsSync(CHROME);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A synthetic view bridge: `tileScreen` (ui/facingWheel.js) accepts a view with `tileScreen()`, or the engine's dev
// hooks. This uses the dev hooks, so any real view implementing `tileScreen()` may lay its tiles out differently —
// everything below is derived from the numbers here and none of it is hard-coded into the component.
const SCALE = 40;      // px per tile → wheel radius = 1.5 * 40 = 60 px
const CENTER = [150, 180];
const HALF = SCALE * 1.5;
const VB_R = 100;      // the component's viewBox radius (facingWheel.js VB_R)

/** Render the wheel over the synthetic view and hand back what it drew. */
async function pumpWheel(page) {
  await page.evaluate(async ({ scale, center }) => {
    const { render, h } = await import('/vendor/preact.module.js');
    const { FacingWheel } = await import('/js/ui/facingWheel.js');
    const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
    const cam = { project: (col, row) => ({ x: center[0] + col * scale, y: center[1] + row * scale, s: scale }) };
    // `onCommit` unmounts the wheel (as the game does once an intent is sent), so the knob/beam teardown can be
    // asserted; the callback is also recorded for the cases where no unmount happens. The log accumulates across
    // re-renders within one page.
    if (!globalThis.__WHEEL__) globalThis.__WHEEL__ = [];
    const container = document.getElementById('app');
    const view = { debug: { cam, app: { view: canvas }, tiles: { heightAt: () => 0 }, views: new Map() } };
    // `dir` starts null, so no sector is lit until a pointer acts on the wheel
    render(h(FacingWheel, {
      view, row: 0, col: 0, grid: null,
      onCommit: (d) => { globalThis.__WHEEL__.push(`commit:${d}`); render(null, container); },
      onCancel: () => { globalThis.__WHEEL__.push('cancel'); render(null, container); },
    }), container);
    await new Promise((r) => setTimeout(r, 120));
  }, { scale: SCALE, center: CENTER });
}

describe('TASK-003: the circular deployment wheel geometry', { skip: !ENABLED && 'set SP_E2E=1 (and have Chrome) to run' }, () => {
  let srv, browser, base;

  before(async () => {
    const { startServer } = await import('../../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    base = `http://127.0.0.1:${srv.port}`;
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  });
  after(async () => { await browser?.close(); await srv?.close(); });

  async function open() {
    const page = await browser.newPage();
    await page.setViewport({ width: 568, height: 320, hasTouch: true });   // the smallest landscape phone in scope
    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    // the browser-support notice is a full-screen panel over the app; a real user dismisses it before playing, so the
    // wheel must be exercised with the notice already dismissed or the panel swallows the pointer events
    await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
    await pumpWheel(page);
    return { page, problems };
  }

  test('the wheel is a circle with four 45° sectors and no knob until a pointer arrives', async () => {
    const { page, problems } = await open();
    const shape = await page.evaluate(() => {
      const svg = document.querySelector('.fwheel__svg');
      const num = (el, a) => Number(el.getAttribute(a));
      const quads = [...document.querySelectorAll('.fwheel__quad')].map((p) => p.getAttribute('d'));
      const circles = [...document.querySelectorAll('.fwheel__outer, .fwheel__subring, .fwheel__inner')]
        .map((c) => ({ cls: c.getAttribute('class'), r: num(c, 'r') }));
      return {
        svg: !!svg,
        quads,
        lit: quads.length ? [...document.querySelectorAll('.fwheel__quad.is-on')].length : -1,
        circles,
        axes: document.querySelectorAll('.fwheel__axis').length,
        chevrons: document.querySelectorAll('.fwheel__chev').length,
        hitCircles: document.querySelectorAll('.fwheel__chevhit').length,
        knob: document.querySelectorAll('.fwheel__knob').length,
        stick: document.querySelectorAll('.fwheel__stick').length,
        // .fwheel__dia carries the position/size the SVG is stretched over
        box: (() => { const r = document.querySelector('.fwheel__dia').getBoundingClientRect(); return { w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })(),
      };
    });

    assert.equal(shape.svg, true, 'the wheel drew its SVG');
    // radius 100, a dashed sub-ring at 3/4 of it, and the ~0.5 tile dead-zone circle at 100 * (0.5 / 1.5)
    const rOf = (cls) => shape.circles.find((c) => (c.cls || '').split(' ').includes(cls))?.r;
    assert.equal(rOf('fwheel__outer'), VB_R, 'the outer boundary is a circle of the viewBox radius');
    assert.equal(rOf('fwheel__subring'), VB_R * 0.75, 'the sub-ring sits at 3/4 of the radius');
    assert.equal(Math.round(rOf('fwheel__inner') * 1000) / 1000, 33.333, 'the dead-zone circle is the 0.5-tile radius');
    assert.equal(shape.axes, 2, 'two diagonal dividers mark the four sector boundaries');
    assert.equal(shape.quads.length, 4, 'four sectors — not the old four square quadrants');
    assert.equal(shape.lit, 0, 'nothing is lit until a direction is chosen');
    assert.equal(shape.chevrons, 4, 'the four chevrons are still drawn');
    assert.equal(shape.hitCircles, 4, 'and the W2 tap targets are still on them');
    assert.equal(shape.knob, 0, 'no knob while no pointer is down');
    assert.equal(shape.stick, 0, 'no beam while no pointer is down');

    // the drawn sector is a wedge of radius 100 whose two corners sit on the diagonals (100 / sqrt(2))
    const onCircle = (p) => Math.round(Math.hypot(p[0], p[1]) * 1000) / 1000;
    const ang = (p) => ((Math.atan2(p[1], p[0]) * (180 / Math.PI)) % 360 + 360) % 360;
    for (const d of shape.quads) {
      // walk the commands instead of scanning numbers: the A flags and radius are not coordinates. Only the command
      // LETTERS split (`D`/`E`/`-` must survive: a `[^MLA]` split also eats the minus signs).
      const corners = [];
      let centre = null, lines = 0, arcs = 0;
      const cmds = /([MLA])([\s\S]*?)(?=[MLA]|$)/g;
      const numsIn = (s) => s.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
      let m;
      while ((m = cmds.exec(d))) {
        const n = numsIn(m[2]);
        if (m[1] === 'M') { assert.equal(n.length, 2, `M carries the centre: ${d}`); centre = n; }
        else if (m[1] === 'L') { lines++; assert.equal(n.length, 2, `L carries one corner: ${d}`); corners.push(n); }
        else { arcs++; assert.equal(n.length, 7, `A carries rx ry rot large sweep x y: ${d}`); assert.equal(n[0], VB_R, `the arc radius is the wheel radius: ${d}`); corners.push([n[5], n[6]]); }
      }
      assert.deepEqual(centre, [0, 0], `the sector starts at the wheel centre: ${d}`);
      assert.equal(lines, 1, `one corner line: ${d}`);
      assert.equal(arcs, 1, `one arc: ${d}`);
      assert.equal(corners.length, 2, `two corners: ${d}`);
      for (const p of corners) {
        // ON the circle (radius 100) AND on a diagonal: |x| === |y| === 100/sqrt(2), i.e. 45°/135°/225°/315°
        assert.equal(onCircle(p), VB_R, `each corner is on the wheel circle: ${d}`);
        assert.equal(Math.abs(p[0]).toFixed(3), (VB_R / Math.SQRT2).toFixed(3), `each corner is on a diagonal (x): ${d}`);
        assert.equal(Math.abs(p[1]).toFixed(3), (VB_R / Math.SQRT2).toFixed(3), `each corner is on a diagonal (y): ${d}`);
        const a = ang(p);
        assert.equal(Math.round(a) % 90, 45, `the corner sits at a 45° boundary: ${d}`);
      }
      const span = ((ang(corners[1]) - ang(corners[0])) % 360 + 360) % 360;
      assert.equal(Math.round(span), 90, `the sector spans a quarter of the circle: ${d}`);
    }

    // the box the SVG is stretched over is the wheel's diameter, centred on the tile's screen position
    assert.equal(Math.round(shape.box.w), HALF * 2, 'the wheel box is 2 * the wheel radius wide');
    assert.equal(Math.round(shape.box.h), HALF * 2, 'and as tall');
    assert.equal(Math.round(shape.box.cx), CENTER[0], 'centred on the tile (x)');
    assert.equal(Math.round(shape.box.cy), CENTER[1], 'centred on the tile (y)');
    assert.deepEqual(problems, []);
    await page.close();
  });

  test('the drag lights the sector the swipe snapping chose, and the knob stays within its travel', async () => {
    const { page, problems } = await open();
    // drag right, well past the wheel: the knob must cap at KNOB_TRAVEL (0.6) of the radius, i.e. 60 viewBox units
    await page.mouse.move(CENTER[0], CENTER[1]);
    await page.mouse.down();
    await page.mouse.move(CENTER[0] + HALF * 4, CENTER[1], { steps: 6 });
    await sleep(120);

    const during = await page.evaluate(() => {
      const knob = document.querySelector('.fwheel__knob');
      const lit = document.querySelector('.fwheel__quad.is-on');
      const litIdx = lit ? [...document.querySelectorAll('.fwheel__quad')].indexOf(lit) : -1;
      return {
        knob: knob ? { x: Number(knob.getAttribute('cx')), y: Number(knob.getAttribute('cy')), r: Number(knob.getAttribute('r')) } : null,
        stick: !!document.querySelector('.fwheel__stick'),
        knobdot: !!document.querySelector('.fwheel__knobdot'),
        litIdx,
        cls: document.querySelector('.fwheel').className,
      };
    });

    assert.ok(during.knob, 'the knob is drawn while the pointer is down');
    assert.ok(during.stick, 'the beam is drawn with it');
    assert.ok(during.knobdot, 'and the knob has its centre dot');
    // 4 * the radius of drag would put the knob at 400 viewBox units without the clamp
    const travel = Math.round(Math.hypot(during.knob.x, during.knob.y));
    assert.ok(Math.abs(travel - VB_R * 0.6) <= 1, `the knob caps at 0.6 of the radius (got ${travel})`);
    assert.ok(travel > VB_R * (0.5 / 1.5), 'and it is clear of the dead-zone circle');
    assert.match(during.cls, /is-right\b/, 'the wheel reports the chosen direction');
    assert.equal(during.litIdx, 0, 'the RIGHT sector is the lit one');

    await page.mouse.up();
    await sleep(150);
    const after = await page.evaluate(() => ({
      knob: !!document.querySelector('.fwheel__knob'),
      stick: !!document.querySelector('.fwheel__stick'),
    }));
    assert.equal(after.knob, false, 'the knob goes away with the drag');
    assert.equal(after.stick, false, 'and so does the beam');
    assert.deepEqual(problems, []);
    await page.close();
  });

  // The contract that matters: for a sample of directions the sector the wheel LIGHTS is the sector `dirFromDelta`
  // COMMITS. A boundary moved in one and not the other would light one side and send the other.
  test('the lit sector agrees with the swipe snapping for every sampled direction', async () => {
    const { page, problems } = await open();
    const QUAD = ['RIGHT', 'DOWN', 'LEFT', 'UP'];   // the order the component emits DIRS in the SVG
    const samples = [
      [1, 0], [0, 1], [-1, 0], [0, -1],
      [1, -0.5], [1, 0.5], [-1, 0.5], [-1, -0.5],
      [40, -41], [41, -40], [41, 40], [40, 41],
      [-41, 40], [-40, 41], [-40, -41], [-41, -40],
    ];
    const rows = [];
    for (const [dx, dy] of samples) {
      // each release commits and (like the game) unmounts the wheel, so re-open it for the next sample
      await pumpWheel(page);
      await page.mouse.move(CENTER[0], CENTER[1]);
      await page.mouse.down();
      await page.mouse.move(CENTER[0] + dx * HALF * 1.2, CENTER[1] + dy * HALF * 1.2, { steps: 4 });
      await sleep(60);
      const got = await page.evaluate(() => {
        const lit = document.querySelector('.fwheel__quad.is-on');
        return { idx: lit ? [...document.querySelectorAll('.fwheel__quad')].indexOf(lit) : -1, cls: document.querySelector('.fwheel').className };
      });
      await page.mouse.up();
      await sleep(80);
      const uid = `${dx},${dy}`;
      const litDir = got.idx >= 0 ? QUAD[got.idx] : null;
      // the class is the screen direction the wheel chose; on an unmirrored board it is the committed one
      const m = got.cls.match(/is-(up|right|down|left)\b/);
      rows.push({ uid, litDir, cls: m ? m[1].toUpperCase() : null });
    }
    for (const r of rows) {
      assert.ok(r.litDir, `${r.uid}: a sector is lit`);
      assert.equal(r.litDir, r.cls, `${r.uid}: the lit sector and the chosen direction agree`);
    }
    // and every sample really did commit a direction rather than cancelling
    const commits = await page.evaluate(() => (globalThis.__WHEEL__ || []).filter((s) => s.startsWith('commit:')));
    assert.equal(commits.length, samples.length, 'each drag committed exactly one direction');
    assert.deepEqual(problems, []);
    await page.close();
  });
});
