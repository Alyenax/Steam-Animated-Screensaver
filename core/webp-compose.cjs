'use strict';
const { deflateSync } = require('node:zlib');
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of payload) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const header = Buffer.alloc(4),
    trailer = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  trailer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, payload, trailer]);
}
function png(canvas, width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    canvas.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 1 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
function clear(canvas, width, rect, background) {
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++)
      canvas.set(background, ((y + rect.y) * width + x + rect.x) * 4);
}
function compose(canvas, width, frame, rect) {
  if (frame.length !== rect.width * rect.height * 4)
    throw new Error('Invalid decoded WebP frame size.');
  for (let y = 0; y < rect.height; y++) {
    const dst = ((rect.y + y) * width + rect.x) * 4;
    const src = y * rect.width * 4;
    if (!rect.blend) {
      frame.copy(canvas, dst, src, src + rect.width * 4);
      continue;
    }
    for (let x = 0; x < rect.width * 4; x += 4) {
      const si = src + x,
        di = dst + x,
        alpha = frame[si + 3] / 255;
      if (!alpha) continue;
      if (alpha === 1) {
        frame.copy(canvas, di, si, si + 4);
        continue;
      }
      const oldAlpha = canvas[di + 3] / 255,
        combined = alpha + oldAlpha * (1 - alpha);
      for (let c = 0; c < 3; c++)
        canvas[di + c] = Math.round(
          (frame[si + c] * alpha + canvas[di + c] * oldAlpha * (1 - alpha)) / combined
        );
      canvas[di + 3] = Math.round(combined * 255);
    }
  }
}
module.exports = { compose, clear, png };
