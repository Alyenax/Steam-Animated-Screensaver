'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let failed = false;
for (const folder of ['core', 'manager', 'player', 'scripts', 'tests']) {
  if (!fs.existsSync(path.join(root, folder))) continue;
  for (const file of fs.readdirSync(path.join(root, folder)))
    if (/\.(cjs|js|mjs)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', path.join(root, folder, file)], {
        encoding: 'utf8'
      });
      if (result.status) {
        failed = true;
        process.stderr.write(result.stderr);
      }
    }
}
for (const file of ['main.cjs', 'preload.cjs']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], {
    encoding: 'utf8'
  });
  if (result.status) {
    failed = true;
    process.stderr.write(result.stderr);
  }
}
if (fs.existsSync(path.join(root, '.github', 'workflows'))) {
  console.error('Automatic workflows are forbidden for this project.');
  failed = true;
}
if (failed) process.exit(1);
console.log('Syntax and no-workflow checks passed.');
