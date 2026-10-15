'use strict';
// Original test media and mocked API responses. Never used by the shipping application.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const names = [
  'Aurora · original QA animation',
  'Ember · original QA animation',
  'Horizon · original QA animation',
  'Orbit · QA search result'
];
async function createFixture({ root, browser }) {
  const dataDir = path.join(root, 'data'),
    steamRoot = path.join(root, 'steam');
  await fs.mkdir(path.join(steamRoot, 'steamapps'), { recursive: true });
  const sourceDir = path.join(root, 'originals');
  await fs.mkdir(sourceDir, { recursive: true });
  const art = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await art.setContent('<canvas width="1280" height="720"></canvas>');
  const sources = [],
    covers = [];
  for (let index = 0; index < 3; index++) {
    const png = await art.evaluate((index) => {
      const c = document.querySelector('canvas'),
        ctx = c.getContext('2d'),
        palette = [
          ['#061825', '#126275', '#9de5e1'],
          ['#24131c', '#885043', '#f2bb8b'],
          ['#0d1029', '#484c9b', '#c1bdff']
        ][index];
      const bg = ctx.createLinearGradient(0, 0, 1280, 720);
      bg.addColorStop(0, palette[0]);
      bg.addColorStop(0.65, palette[1]);
      bg.addColorStop(1, palette[0]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1280, 720);
      const glow = ctx.createRadialGradient(870, 260, 2, 870, 260, 420);
      glow.addColorStop(0, palette[2] + 'aa');
      glow.addColorStop(0.3, palette[2] + '22');
      glow.addColorStop(1, palette[2] + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 1280, 720);
      let seed = 42;
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      for (let i = 0; i < 150; i++) {
        ctx.fillStyle = `rgba(226,242,255,${0.15 + rnd() * 0.65})`;
        ctx.beginPath();
        ctx.arc(rnd() * 1280, rnd() * 490, 0.3 + rnd() * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = palette[2] + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(860, 265, 225, 65, -0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = palette[2];
      ctx.beginPath();
      ctx.arc(860, 265, 63, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette[0];
      ctx.beginPath();
      ctx.arc(880, 244, 62, 0, Math.PI * 2);
      ctx.fill();
      for (let layer = 0; layer < 4; layer++) {
        ctx.fillStyle = ['#173547', '#102b3b', '#0a1d2b', '#050e18'][layer];
        ctx.beginPath();
        ctx.moveTo(0, 720);
        for (let x = 0; x <= 1280; x += 32) {
          const y =
            470 +
            layer * 49 +
            Math.sin(x / (140 - layer * 19) + layer) * 48 +
            Math.cos(x / (70 + layer * 15)) * 25;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(1280, 720);
        ctx.fill();
      }
      ctx.fillStyle = '#e7f2ff88';
      ctx.font = '12px sans-serif';
      ctx.fillText('ORIGINAL VALIDATION MEDIA · NO GAME ARTWORK', 44, 675);
      return c.toDataURL('image/png').split(',')[1];
    }, index);
    const pngFile = path.join(sourceDir, `${index}.png`),
      webm = path.join(sourceDir, `${index}.webm`);
    await fs.writeFile(pngFile, Buffer.from(png, 'base64'));
    execFileSync(require('ffmpeg-static'), [
      '-v',
      'error',
      '-loop',
      '1',
      '-i',
      pngFile,
      '-vf',
      "zoompan=z='1.025+0.02*sin(on/40)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=960x540:fps=24",
      '-t',
      '3',
      '-c:v',
      'libvpx-vp9',
      '-threads',
      '2',
      '-crf',
      '30',
      '-b:v',
      '0',
      '-pix_fmt',
      'yuv420p',
      '-y',
      webm
    ]);
    const coverFile = path.join(sourceDir, `${index}.cover.png`);
    execFileSync(require('ffmpeg-static'), [
      '-v',
      'error',
      '-i',
      pngFile,
      '-vf',
      'crop=480:720:640:0,scale=240:360',
      '-frames:v',
      '1',
      '-y',
      coverFile
    ]);
    covers.push(coverFile);
    sources.push(webm);
  }
  await art.close();
  let slow = false,
    prepares = 0;
  const { createMedia } = require('../core/media.cjs');
  const media = createMedia({
    dataDir,
    downloadImpl: async (url, dest, { signal, onProgress }) => {
      if (slow)
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', abort);
            resolve();
          }, 2200);
          function abort() {
            clearTimeout(timer);
            reject(Object.assign(new Error('QA download interrupted'), { name: 'AbortError' }));
          }
          signal?.addEventListener('abort', abort, { once: true });
          if (signal?.aborted) abort();
        });
      const isCover = url.endsWith('.png');
      const index = Number(new URL(url).pathname.match(/(\d+)\.(?:webm|png)$/)?.[1]) % 3;
      await fs.copyFile((isCover ? covers : sources)[index], dest);
      prepares++;
      onProgress?.({ stage: 'downloading', bytes: (await fs.stat(dest)).size });
    }
  });
  const metadata = (id) => ({
    sgdbId: id,
    steamAppId: 7000000 + id,
    name: names[(id - 901) % 4],
    thumb: null
  });
  const assets = (id) => [
    {
      id,
      url: `https://cdn2.steamgriddb.com/hero/${id % 3}.webm`,
      thumb: null,
      width: 960,
      height: 540,
      score: 0,
      kind: 'hero',
      animated: true,
      author: { name: 'Original validation media' }
    }
  ];
  const sgdb = {
    game: async (id) => metadata(id),
    bySteam: async (id) => metadata(id - 7000000),
    search: async () => [
      metadata(904),
      { sgdbId: 905, steamAppId: 7000905, name: 'Orbit II · QA homonym result', thumb: null }
    ],
    artworks: async (id) => assets(id),
    covers: async (id) => [
      {
        ...assets(id)[0],
        url: `https://cdn2.steamgriddb.com/grid/${id % 3}.png`,
        width: 240,
        height: 360,
        animated: false,
        kind: 'grid',
        author: { name: 'Original validation cover' }
      }
    ],
    validateKey: async () => ({ valid: true })
  };
  const core = require('../core/index.cjs').createCore({
    dataDir,
    steamRoots: [steamRoot],
    media,
    sgdb,
    isGameRunning: async () => false
  });
  await core.invoke('state');
  return {
    core,
    dataDir,
    steamRoot,
    setSlow: (value) => (slow = value),
    get prepares() {
      return prepares;
    },
    add: async (id) => core.invoke('add', { sgdbId: id }),
    assets
  };
}
module.exports = { createFixture };
