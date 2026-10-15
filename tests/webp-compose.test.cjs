'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { compose, clear, png } = require('../core/webp-compose.cjs');
test('WebP rectangle composition honors offsets, alpha blending, overwrite and disposal background', () => {
  const canvas = Buffer.alloc(3 * 2 * 4);
  const rect = { x: 2, y: 1, width: 1, height: 1, blend: true };
  clear(canvas, 3, { x: 0, y: 0, width: 3, height: 2 }, [0, 0, 255, 255]);
  compose(canvas, 3, Buffer.from([255, 0, 0, 128]), rect);
  assert.deepEqual([...canvas.subarray(20, 24)], [128, 0, 127, 255]);
  assert.deepEqual([...canvas.subarray(0, 4)], [0, 0, 255, 255]);
  compose(canvas, 3, Buffer.from([0, 255, 0, 0]), rect);
  assert.deepEqual([...canvas.subarray(20, 24)], [128, 0, 127, 255]);
  compose(canvas, 3, Buffer.from([0, 255, 0, 0]), { ...rect, blend: false });
  assert.deepEqual([...canvas.subarray(20, 24)], [0, 255, 0, 0]);
  clear(canvas, 3, rect, [20, 40, 60, 100]);
  assert.deepEqual([...canvas.subarray(20, 24)], [20, 40, 60, 100]);
  const image = png(canvas, 3, 2);
  assert.equal(image.readUInt32BE(16), 3);
  assert.equal(image.readUInt32BE(20), 2);
  const data = inflateSync(image.subarray(41, image.length - 16));
  assert.deepEqual(
    data,
    Buffer.concat([Buffer.from([0]), canvas.subarray(0, 12), Buffer.from([0]), canvas.subarray(12)])
  );
});
