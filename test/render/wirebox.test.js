import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../../public/js/render/projection.js';
import { drawWireBox } from '../../public/js/render/tiles.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('gate warning glyph stays centred on the projected front face', () => {
  const cam = new Camera({ tx: 5, ty: 10, tilt: 36, dist: 8, scale: 72, cx: 640, cy: 360 });
  const rects = [];
  const g = {
    lineStyle() {}, beginFill() {}, endFill() {}, moveTo() {}, lineTo() {}, drawCircle() {},
    drawPolygon() {},
    drawRect(...args) { rects.push(args); },
  };

  const cx = 3, cy = 7, z0 = 0.02, size = 0.96, height = 0.92;
  drawWireBox(g, cam, cx, cy, z0, size, height, 0xff6655, 1, true);
  assert.equal(rects.length, 1);

  const a = size / 2;
  const corners = [
    cam.project(cx - a, cy - a, z0), cam.project(cx + a, cy - a, z0),
    cam.project(cx - a, cy - a, z0 + height), cam.project(cx + a, cy - a, z0 + height),
  ];
  const expected = {
    x: corners.reduce((sum, p) => sum + p.x, 0) / corners.length,
    y: corners.reduce((sum, p) => sum + p.y, 0) / corners.length,
  };
  const [x, y, width, rectHeight] = rects[0];
  assert.ok(near(x + width / 2, expected.x), 'glyph is horizontally centred on the visible face');
  assert.ok(near(y + rectHeight * 0.6, expected.y), 'exclamation stem uses the projected face centre');
});
