'use strict';
const fs = require('node:fs/promises');
const syncFS = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const videoName = 'Steam-Animated-Screensaver-demo.mp4';
const steamosName = 'Steam-Animated-Screensaver-SteamOS-overview.mp4';
const video = path.join(root, 'dist/public-launch-v2', videoName);
const github = 'https://github.com/Alyenax/Steam-Animated-Screensaver/blob/main/';
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const documents = {
  'readme.html': 'README.md',
  'demo.html': 'docs/DEMO.md',
  'changelog.html': 'CHANGELOG.md',
  'reddit-en.html': 'launch/REDDIT_EN.md',
  'reddit-fr.html': 'launch/REDDIT_FR.md',
  'reddit-steamos-en.html': 'launch/REDDIT_STEAMOS_EN.md',
  'reddit-steamos-fr.html': 'launch/REDDIT_STEAMOS_FR.md'
};
function href(url, file) {
  if (/^(https?:|mailto:|#)/.test(url)) return esc(url);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), url));
  const page = Object.entries(documents).find(([, source]) => source === resolved)?.[0];
  return esc(
    page ||
      (/^screenshots\/public\/[\w.-]+\.(png|jpg|gif)$/.test(resolved)
        ? resolved
        : github + resolved)
  );
}
async function markdown(file) {
  const source = await fs.readFile(path.join(root, file), 'utf8');
  const ast = await require('prettier/plugins/markdown').parsers.markdown.parse(source);
  function render(node) {
    const body = () => (node.children || []).map(render).join('');
    switch (node.type) {
      case 'root':
        return body();
      case 'html':
        // Only the collapsible disclosure markup used in our Markdown is allowed.
        return /^(?:<details>\s*|<\/details>\s*|<summary>[^<>]*<\/summary>\s*)+$/.test(node.value)
          ? node.value
          : esc(node.value);
      case 'text':
        return esc(node.value);
      case 'heading':
        return `<h${node.depth}>${body()}</h${node.depth}>`;
      case 'paragraph':
        return `<p>${body()}</p>`;
      case 'strong':
        return `<strong>${body()}</strong>`;
      case 'emphasis':
        return `<em>${body()}</em>`;
      case 'delete':
        return `<del>${body()}</del>`;
      case 'inlineCode':
        return `<code>${esc(node.value)}</code>`;
      case 'code':
        return `<pre><code>${esc(node.value)}</code></pre>`;
      case 'link':
        return `<a href="${href(node.url, file)}">${body()}</a>`;
      case 'image':
        return `<img src="${href(node.url, file)}" alt="${esc(node.alt)}" loading="lazy">`;
      case 'list':
        return `<${node.ordered ? 'ol' : 'ul'}>${body()}</${node.ordered ? 'ol' : 'ul'}>`;
      case 'listItem':
        return `<li>${body()}</li>`;
      case 'blockquote':
        return `<blockquote>${body()}</blockquote>`;
      case 'table':
        return `<table><thead>${render(node.children[0]).replaceAll('<td>', '<th>').replaceAll('</td>', '</th>')}</thead><tbody>${node.children.slice(1).map(render).join('')}</tbody></table>`;
      case 'tableRow':
        return `<tr>${body()}</tr>`;
      case 'tableCell':
        return `<td>${body()}</td>`;
      case 'thematicBreak':
        return '<hr>';
      case 'break':
        return '<br>';
      default:
        return node.value ? esc(node.value) : body();
    }
  }
  const language = file.endsWith('_FR.md') ? 'fr' : 'en';
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(file)} - Steam Animated Screensaver</title><link rel="stylesheet" href="showcase.css"></head><body><header class="top"><a class="name" href="index.html">Steam Animated Screensaver</a><nav aria-label="Documentation"><a href="index.html">Demo</a><a href="readme.html">README</a><a href="changelog.html">Changelog</a><a href="reddit-en.html">Reddit EN</a><a href="reddit-fr.html">FR</a></nav></header><main><article>${render(ast)}</article></main><footer>Rendered from the actual ${esc(file)} file.</footer></body></html>`;
}
async function index(localVideo, page = 'index.html') {
  if (page === 'steamos.html')
    return (await fs.readFile(path.join(root, 'showcase/steamos.html'), 'utf8')).replaceAll(
      steamosName,
      localVideo
    );
  return (await fs.readFile(path.join(root, 'showcase/index.html'), 'utf8')).replaceAll(
    'https://github.com/Alyenax/Steam-Animated-Screensaver/releases/download/v1.0.0/' + videoName,
    localVideo
  );
}
async function exportSite() {
  const output = path.join(root, 'dist/showcase-site');
  await fs.mkdir(output, { recursive: true });
  for (const name of ['showcase.css', 'showcase.js'])
    await fs.copyFile(path.join(root, 'showcase', name), path.join(output, name));
  await fs.writeFile(path.join(output, 'index.html'), await index(videoName));
  for (const [name, file] of Object.entries(documents))
    await fs.writeFile(path.join(output, name), await markdown(file));
  await fs.cp(path.join(root, 'screenshots/public'), path.join(output, 'screenshots/public'), {
    recursive: true
  });
  await fs.copyFile(video, path.join(output, videoName));
  await fs.writeFile(path.join(output, 'steamos.html'), await index(steamosName, 'steamos.html'));
  await fs.copyFile(
    path.join(root, 'dist/public-launch-v2', steamosName),
    path.join(output, steamosName)
  );
  console.log(output);
  return output;
}
async function serve({ recordUrl = true, port = Number(process.env.SAS_PREVIEW_PORT) || 0 } = {}) {
  const server = http.createServer(async (request, response) => {
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      if (
        request.headers.host !== new URL(base).host ||
        !['GET', 'HEAD'].includes(request.method)
      ) {
        response.writeHead(403);
        return response.end();
      }
      const name = decodeURIComponent(new URL(request.url, base).pathname).replace(/^\//, '');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (['', 'index.html', 'steamos.html'].includes(name) || documents[name]) {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        return response.end(
          documents[name]
            ? await markdown(documents[name])
            : await index(
                name === 'steamos.html' ? '/steamos-video.mp4' : '/video.mp4',
                name || 'index.html'
              )
        );
      }
      let file, type;
      if (name === 'video.mp4' || name === 'steamos-video.mp4') {
        file = name === 'video.mp4' ? video : path.join(root, 'dist/public-launch-v2', steamosName);
        type = 'video/mp4';
      } else if (['showcase.css', 'showcase.js'].includes(name)) {
        file = path.join(root, 'showcase', name);
        type = name.endsWith('.css') ? 'text/css' : 'text/javascript';
      } else if (/^screenshots\/public\/[\w.-]+\.(png|jpg|gif)$/.test(name)) {
        file = path.join(root, name);
        type = name.endsWith('.gif')
          ? 'image/gif'
          : name.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
      } else {
        response.writeHead(404);
        return response.end();
      }
      const stat = await fs.stat(file);
      let start = 0,
        end = stat.size - 1;
      if (request.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
        if (
          !match ||
          (start = Number(match[1])) >= stat.size ||
          (end = match[2] ? Math.min(Number(match[2]), end) : end) < start
        ) {
          response.writeHead(416);
          return response.end();
        }
        response.statusCode = 206;
        response.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      }
      response.setHeader('Content-Type', type);
      response.setHeader('Content-Length', end - start + 1);
      response.setHeader('Accept-Ranges', 'bytes');
      if (request.method === 'HEAD') return response.end();
      const stream = syncFS.createReadStream(file, { start, end });
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(500);
      response.end('Preview unavailable.');
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  console.log(url);
  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  if (recordUrl)
    await fs.writeFile(
      path.join(root, 'dist/SHOWCASE_PREVIEW.json'),
      JSON.stringify({ url }, null, 2) + '\n'
    );
  return { url, close: () => new Promise((resolve) => server.close(resolve)) };
}
if (require.main === module)
  (process.argv.includes('--export') ? exportSite() : serve()).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { serve, exportSite };
