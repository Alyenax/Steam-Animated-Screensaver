'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { resolveFile, CSP } = require('./local-files.cjs');

async function createServer({
  dataDir = path.join(__dirname, '..', '.data'),
  steamRoots,
  core: providedCore
} = {}) {
  const core =
    providedCore || (await require('../core/index.cjs').createCore({ dataDir, steamRoots }));
  const root = path.resolve(__dirname, '..');
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(JSON.stringify(value));
    };
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      if (req.headers.host !== new URL(base).host) return send(403, { error: 'Invalid host.' });
      if (req.url === '/api/invoke' && req.method === 'POST') {
        if (
          req.headers.origin !== base ||
          req.headers['content-type']?.split(';')[0] !== 'application/json'
        )
          return send(403, { error: 'Same-origin JSON required.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 65536) return send(413, { error: 'Request too large.' });
        }
        const { action, payload = {} } = JSON.parse(body);
        return send(200, { result: await core.invoke(action, payload) });
      }
      if (req.url === '/api/state' && req.method === 'GET')
        return send(200, await core.invoke('state'));
      if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: 'Method not allowed.' });
      const target = await resolveFile(req.url, { root, dataDir });
      if (!target) return send(404, { error: 'Not found.' });
      const headers = {
        'Content-Type': target.type,
        'Content-Security-Policy': CSP,
        'X-Content-Type-Options': 'nosniff',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      };
      let start = 0,
        end = target.size - 1,
        status = 200;
      if (req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!range || (!range[1] && !range[2])) {
          res.writeHead(416, { 'Content-Range': `bytes */${target.size}` });
          return res.end();
        }
        if (!range[1]) start = Math.max(0, target.size - Number(range[2]));
        else {
          start = Number(range[1]);
          if (range[2]) end = Math.min(Number(range[2]), end);
        }
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= target.size
        ) {
          res.writeHead(416, { 'Content-Range': `bytes */${target.size}` });
          return res.end();
        }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${target.size}`;
      }
      headers['Content-Length'] = Math.max(0, end - start + 1);
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || target.size === 0) return res.end();
      const stream = fs.createReadStream(target.file, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      if (!res.headersSent) send(400, { error: error.message || 'Operation failed.' });
      else res.destroy();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    server,
    core,
    url: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      await core.close();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
module.exports = { createServer };
if (require.main === module)
  createServer({ dataDir: process.env.SAS_DATA_DIR }).then((instance) => {
    console.log(instance.url);
    for (const signal of ['SIGINT', 'SIGTERM'])
      process.on(signal, () => instance.close().then(() => process.exit()));
  });
