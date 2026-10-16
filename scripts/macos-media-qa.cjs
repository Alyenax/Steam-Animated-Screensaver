'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
async function run(appPath) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sas-macos-media-qa-'));
  const packaged = path.resolve(appPath, 'Contents/Resources/app');
  const binaries = path.join(packaged, 'binaries');
  const { createMedia } = require(path.join(packaged, 'core/media.cjs'));
  const generator = require('ffmpeg-static'); // Original fixture generation only.
  const checks = [];
  try {
    for (const name of ['ffmpeg', 'ffprobe']) {
      const file = path.join(binaries, name);
      execFileSync('lipo', [file, '-verify_arch', 'arm64']);
      const links = execFileSync('otool', ['-L', file], { encoding: 'utf8' });
      for (const line of links
        .split('\n')
        .slice(1)
        .filter((line) => line.trim()))
        assert(/^\s+(\/usr\/lib\/|\/System\/Library\/)/.test(line), line);
      const config = execFileSync(file, ['-buildconf'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      assert(!config.includes('--enable-nonfree'));
      assert(!config.includes('--enable-gpl'));
    }
    checks.push(
      'Both media executables are arm64, use system libraries only and disable nonfree/GPL configuration'
    );
    for (const format of ['gif', 'webp', 'webm', 'av1']) {
      const source = path.join(root, `${format}.${format === 'av1' ? 'webm' : format}`);
      const args = ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=6:duration=1'];
      if (format === 'webp') args.push('-c:v', 'libwebp_anim', '-loop', '0');
      if (format === 'webm') args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p');
      if (format === 'av1')
        args.push('-c:v', 'libaom-av1', '-cpu-used', '8', '-threads', '2', '-pix_fmt', 'yuv420p');
      execFileSync(generator, [...args, '-y', source]);
      const dataDir = path.join(root, `data-${format}`);
      const media = createMedia({
        dataDir,
        downloadImpl: async (_url, file) => fs.copyFile(source, file)
      });
      const result = await media.prepare({
        url:
          'https://cdn2.steamgriddb.com/hero/original-qa.' + (format === 'av1' ? 'webm' : format),
        animated: true
      });
      assert.equal(await media.validate(result), true);
      assert.deepEqual(
        await fs.readFile(path.join(dataDir, 'media', result.sourceFile)),
        await fs.readFile(source)
      );
      const preview = await media.preview({ file: result.file }, { force: true });
      assert((await fs.stat(path.join(dataDir, 'media', preview.file))).size > 100);
      if (format === 'av1') assert.match(result.file, /\.vp9\.webm$/);
      checks.push(
        `Bundled tools prepare, validate and preview ${format}; original bytes preserved`
      );
      if (format === 'gif') {
        for (const [mode, fps] of [
          ['fast', 24],
          ['quality', 30],
          ['blend', 24]
        ]) {
          const smoothed = await media.smooth(result, {
            settings: { smoothingMode: mode, smoothingFps: fps }
          });
          assert.equal(await media.validate(smoothed), true);
          assert.equal(smoothed.smoothingConfig.fps, fps);
          const probe = JSON.parse(
            execFileSync(
              path.join(binaries, 'ffprobe'),
              [
                '-v',
                'error',
                '-select_streams',
                'v:0',
                '-show_entries',
                'stream=avg_frame_rate',
                '-of',
                'json',
                path.join(dataDir, 'media', smoothed.file)
              ],
              { encoding: 'utf8' }
            )
          );
          const [numerator, denominator] = probe.streams[0].avg_frame_rate.split('/').map(Number);
          assert.equal(numerator / denominator, fps);

          checks.push(`Bundled tools generate and validate ${mode} / ${fps} fps`);
        }
      }
    }
    const report = {
      result: 'passed',
      version: JSON.parse(
        await fs.readFile(path.join(appPath, 'Contents/Resources/app/package.json'), 'utf8')
      ).version,
      app: path.resolve(appPath),
      fixture: 'Original generated test media; no personal API key or remote artwork',
      checks
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
module.exports = { run };
if (require.main === module)
  run(process.argv[2]).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
