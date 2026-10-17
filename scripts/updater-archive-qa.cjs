'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { extractArchive, validateApp, treeInfo } = require('../core/update-archive.cjs');
const { TARGETS, assetName } = require('../core/update-format.cjs');
(async () => {
  const version = require('../package.json').version,
    root = await fs.mkdtemp('/private/tmp/sas-update-archives-'),
    checks = [];
  try {
    for (const target of ['linux-x64', 'win32-x64']) {
      const original = path.resolve('dist', TARGETS[target].root),
        info = await treeInfo(original);
      const extracted = await extractArchive(
        path.resolve('dist', assetName(version, target)),
        path.join(root, target),
        { target, unpackedBytes: info.bytes }
      );
      await validateApp(extracted, target, version);
      // Compare every byte and executable bit, not only package metadata.
      const walk = async (directory, relative = '', result = {}) => {
        for (const e of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
          const name = path.join(relative, e.name),
            file = path.join(directory, name);
          if (e.isSymbolicLink()) result[name] = { link: await fs.readlink(file) };
          else if (e.isDirectory()) await walk(directory, name, result);
          else
            result[name] = {
              sha256: await require('../core/app-updates.cjs').hashFile(file),
              executable: !!((await fs.stat(file)).mode & 0o111)
            };
        }
        return result;
      };
      assert.deepEqual(await walk(extracted), await walk(original));
      checks.push(
        `${target}: production extractor restores all signed-package bytes, internal paths and executable bits; app identity/version and bundled updater dependencies are intact`
      );
    }
    const report = {
      version,
      result: 'passed',
      host: process.platform,
      scope:
        'Actual target archives extracted with the production updater on macOS; executables are not run on Windows/Linux',
      checks
    };
    await fs.writeFile(
      'dist/UPDATER_ARCHIVE_VALIDATION.json',
      JSON.stringify(report, null, 2) + '\n'
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
