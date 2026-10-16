'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { localMedia, settings, catalogGames, shuffle } = require('../player/player.js');
test('player accepts only local catalog media paths', () => {
  for (const p of ['media/a.gif', '/media/b.webm', 'app://screensaver/media/a.webp'])
    assert(localMedia(p));
  for (const p of [
    'https://cdn2.steamgriddb.com/a.gif',
    'file:///etc/passwd',
    'media/../secret',
    'media/a.gif?remote',
    'media/a.gif#x',
    '/media/../../x',
    'data:image/png,a',
    'app://evil/media/a.gif'
  ])
    assert.equal(localMedia(p), false, p);
});
test('player bounds settings and restricts transition values', () => {
  assert.equal(settings({ sceneDuration: 99999 }).sceneDuration, 180);
  assert.equal(settings({ sceneDuration: -2 }).sceneDuration, 8);
  assert.equal(settings({ transition: '<script>' }).transition, 'crossfade');
  assert.equal(settings({ language: 'xx' }).language, 'en');
  assert.equal(settings({}).staticFallback, false);
});
test('empty and incomplete catalogs do not play; static fallback requires opt in', () => {
  const game = {
    id: 'one',
    included: true,
    status: 'ready',
    media: { file: 'media/a.gif', thumbnail: 'media/a.jpg', animated: true }
  };
  assert.deepEqual(catalogGames(null, settings()), []);
  assert.equal(catalogGames({ games: [game] }, settings()).length, 1);
  assert.equal(catalogGames({ games: [{ ...game, included: false }] }, settings()).length, 0);
  assert.equal(
    catalogGames({ games: [{ ...game, media: { ...game.media, animated: false } }] }, settings())
      .length,
    0
  );
  assert.equal(
    catalogGames(
      { games: [{ ...game, media: { ...game.media, animated: false } }] },
      settings({ staticFallback: true })
    ).length,
    1
  );
});
test('shuffle is reproducible with supplied randomness and does not mutate catalog', () => {
  const input = [1, 2, 3, 4],
    result = shuffle(input, () => 0);
  assert.deepEqual(input, [1, 2, 3, 4]);
  assert.deepEqual(result, [2, 3, 4, 1]);
  assert.deepEqual([...result].sort(), input);
});
test('installed player has no network dependency, module import or input interception', () => {
  const source = fs.readFileSync(path.join(__dirname, '../player/player.js'), 'utf8'),
    html = fs.readFileSync(path.join(__dirname, '../player/index.html'), 'utf8');
  assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|require\(/.test(source));
  assert(!/addEventListener\(['"](?:keydown|mousedown|mousemove|gamepad)/.test(source));
  assert(html.includes("connect-src 'none'"));
  assert(!html.includes('https://'));
});

test('crop modes retain true window ratios within every viewport and safely resolve per-game focal points', () => {
  const { framing, frameBox } = require('../player/player.js');
  assert.equal(settings({ framing: 'stretch' }).framing, 'original');
  assert.deepEqual(framing({ crop: { mode: 'inherit', x: 12, y: 80 } }, { framing: '16:10' }), {
    mode: '16:10',
    x: 12,
    y: 80
  });
  assert.deepEqual(framing({ crop: { mode: 'original', x: -1, y: 999 } }, { framing: '16:9' }), {
    mode: 'original',
    x: 0,
    y: 100
  });
  for (const [width, height] of [
    [1280, 800],
    [1920, 1080],
    [3840, 2160],
    [390, 844]
  ])
    for (const mode of ['16:9', '16:10']) {
      const box = frameBox(width, height, mode);
      assert(box.width <= width && box.height <= height + 0.001);
      assert(Math.abs(box.width / box.height - (mode === '16:9' ? 16 / 9 : 16 / 10)) < 1e-8);
    }
  assert.deepEqual(frameBox(1280, 800, 'original'), { width: 1280, height: 800 });
});
