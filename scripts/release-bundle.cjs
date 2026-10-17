'use strict';
// Prepare exactly eight uploaded files. GitHub adds two automatic source archives.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
async function bundle() {
  const root = path.resolve(__dirname, '..'),
    version = require('../package.json').version,
    dist = path.join(root, 'dist'),
    tag = `v${version}`,
    prefix = `Steam-Animated-Screensaver-${version}`,
    output = path.join(dist, `release-${tag}`);
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  if (git(['status', '--porcelain', '--untracked-files=no']))
    throw new Error('Commit tracked changes before creating release sources.');
  if (git(['rev-parse', `${tag}^{commit}`]) !== git(['rev-parse', 'HEAD']))
    throw new Error('The release tag must point to the current source.');
  await fs.mkdir(output, { recursive: true });
  const appFiles = [
    'steamos-x64.tar.gz',
    'linux-x64.tar.gz',
    'windows-x64.zip',
    'macos-arm64.dmg'
  ].map((suffix) => `${prefix}-${suffix}`);
  for (const name of appFiles) await fs.copyFile(path.join(dist, name), path.join(output, name));
  await require('./sign-update.cjs').signUpdate({ directory: output });
  const update = 'update.json';
  const demo = 'Steam-Animated-Screensaver-demo.mp4';
  await fs.copyFile(path.join(dist, 'public-launch-v2', demo), path.join(output, demo));
  const reports = await fs.mkdtemp(path.join(dist, '.release-reports-'));
  try {
    const evidence = [
      ['dist/POWERSHELL_HELPER_VALIDATION.json', 'POWERSHELL_HELPER_VALIDATION.json'],
      ['dist/UPDATER_ARCHIVE_VALIDATION.json', 'UPDATER_ARCHIVE_VALIDATION.json'],
      ['dist/UPDATER_VALIDATION.json', 'UPDATER_VALIDATION.json'],
      ['dist/UPDATER_UI_VALIDATION.json', 'UPDATER_UI_VALIDATION.json'],
      ['dist/MACOS_UPDATE_VALIDATION.json', 'MACOS_UPDATE_VALIDATION.json'],
      [`dist/branding-${version}/BRANDING_UI_VALIDATION.json`, 'BRANDING_UI_VALIDATION.json'],
      ['dist/RELEASE_TEST_SUMMARY.json', 'RELEASE_TEST_SUMMARY.json'],
      ['dist/PACKAGE_VALIDATION.json', 'PACKAGE_VALIDATION.json'],
      ['dist/MACOS_ELECTRON_VALIDATION.json', 'MACOS_ELECTRON_VALIDATION.json'],
      ['dist/MACOS_MEDIA_VALIDATION.json', 'MACOS_MEDIA_VALIDATION.json'],
      ['dist/MACOS_ARCHIVE_VALIDATION.json', 'MACOS_ARCHIVE_VALIDATION.json'],
      ['dist/LIFECYCLE_VALIDATION.json', 'LIFECYCLE_VALIDATION.json'],
      ['dist/MEDIA_DISTRIBUTION_VALIDATION.json', 'MEDIA_DISTRIBUTION_VALIDATION.json'],
      ['dist/STEAM_IDLE_UI_VALIDATION.json', 'STEAM_IDLE_UI_VALIDATION.json'],
      ['docs/ANIMATION_PICKER_VALIDATION.json', 'ANIMATION_PICKER_VALIDATION.json'],
      ['docs/SELECTION_VALIDATION.json', 'SELECTION_VALIDATION.json'],
      ['dist/UI_VALIDATION.json', 'UI_VALIDATION.json']
    ];
    const manifest = {
      version,
      commit: git(['rev-parse', 'HEAD']),
      tag,
      at: new Date().toISOString(),
      reports: [],
      limitations: [
        'Native Windows, Linux and SteamOS execution was not performed on the Mac validation host.',
        'The included original demo was recorded for 1.0.0 and does not show the current logo, installation or credit controls.'
      ]
    };
    for (const [source, name] of evidence) {
      const bytes = await fs.readFile(path.join(root, source)),
        report = JSON.parse(bytes);
      if (
        (report.version || report.bundle?.version) &&
        (report.version || report.bundle?.version) !== version
      )
        throw new Error(`Stale report: ${name}`);
      await fs.writeFile(path.join(reports, name), bytes);
      manifest.reports.push({
        name,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex')
      });
    }
    await fs.writeFile(
      path.join(reports, 'BUILD_MANIFEST.json'),
      JSON.stringify(manifest, null, 2) + '\n'
    );
    const validation = `${prefix}-validation.zip`;
    await fs.rm(path.join(output, validation), { force: true });
    execFileSync('zip', ['-q', path.join(output, validation), ...(await fs.readdir(reports))], {
      cwd: reports
    });
    execFileSync('unzip', ['-tq', path.join(output, validation)]);
    const files = [...appFiles, update, demo, validation];
    const checks = [];
    for (const name of files)
      checks.push(
        `${crypto
          .createHash('sha256')
          .update(await fs.readFile(path.join(output, name)))
          .digest('hex')}  ${name}`
      );
    await fs.writeFile(path.join(output, 'SHA256SUMS'), checks.sort().join('\n') + '\n');
    if ((await fs.readdir(output)).length !== 8)
      throw new Error('Unexpected extra public release files.');
    console.log(
      JSON.stringify(
        {
          version,
          output,
          uploadedFiles: 8,
          githubDisplayedAssets: 10,
          files: [...files, 'SHA256SUMS']
        },
        null,
        2
      )
    );
  } finally {
    await fs.rm(reports, { recursive: true, force: true });
  }
}
if (require.main === module)
  bundle().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { bundle };
