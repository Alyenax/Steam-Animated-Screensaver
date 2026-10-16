'use strict';
// Synchronous atomic commits keep the JSON readable even after a fatal process exit.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SECRET_FIELD =
  /^(key|api[-_]?key|steamKey|steam[-_]?api[-_]?key|authorization|token|password|secret|credential[s]?)$/i;
function sanitize(input, secrets = [], depth = 0, seen = new WeakSet()) {
  if (depth > 8) return '[depth limit]';
  if (typeof input === 'string') {
    let text = input;
    for (const secret of secrets.filter(Boolean)) text = text.split(secret).join('[redacted]');
    return text
      .replace(/\b[0-9a-f]{32}\b/gi, '[redacted]')
      .replace(/(Bearer\s+)[^\s"'<>]+/gi, '$1[redacted]')
      .replace(/([?&](?:key|api_key|token|access_token|password)=)[^\s&"'<>]*/gi, '$1[redacted]')
      .replace(
        /((?:api[-_ ]?key|password|secret|authorization)\s*[:=]\s*)[^\s,;}]+/gi,
        '$1[redacted]'
      )
      .slice(0, 24000);
  }
  if (input === null || typeof input === 'boolean' || typeof input === 'number') return input;
  if (input === undefined) return undefined;
  if (typeof input !== 'object') return String(input);
  if (seen.has(input)) return '[circular]';
  seen.add(input);
  if (input instanceof Error)
    return sanitize(
      {
        name: input.name,
        message: input.message,
        stack: input.stack,
        code: input.code,
        exitCode: input.exitCode,
        signal: input.signal,
        tool: input.tool,
        cause: input.cause,
        stderr: input.stderr
      },
      secrets,
      depth + 1,
      seen
    );
  if (Array.isArray(input))
    return input.slice(0, 200).map((v) => sanitize(v, secrets, depth + 1, seen));
  const out = {};
  for (const [key, value] of Object.entries(input).slice(0, 100))
    Object.defineProperty(out, key, {
      enumerable: true,
      configurable: true,
      value: SECRET_FIELD.test(key) ? '[redacted]' : sanitize(value, secrets, depth + 1, seen)
    });
  return out;
}
function createDiagnostics({
  dataDir,
  version = require('../package.json').version,
  maxBytes = 4 * 1024 * 1024,
  maxFiles = 5,
  secrets = () => []
} = {}) {
  const folder = path.join(dataDir, 'logs'),
    file = path.join(folder, 'diagnostics.json');
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(folder).isSymbolicLink()) throw new Error('Unsafe diagnostic log folder.');
  const safe = (p) => {
    try {
      const s = fs.lstatSync(p);
      if (!s.isFile() || s.isSymbolicLink()) throw new Error('Unsafe diagnostic log file.');
      return s;
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  };
  let previousInterrupted = false;
  if (safe(file)) {
    try {
      if (fs.statSync(file).size <= 8 * 1024 * 1024)
        previousInterrupted = JSON.parse(fs.readFileSync(file, 'utf8')).cleanExit === false;
    } catch {}
  }
  function rotate() {
    for (let n = maxFiles - 1; n >= 1; n--) {
      const target = path.join(folder, `diagnostics-${n}.json`),
        source = n === 1 ? file : path.join(folder, `diagnostics-${n - 1}.json`);
      safe(target);
      if (safe(source)) {
        if (n === maxFiles - 1 && fs.existsSync(target)) fs.unlinkSync(target);
        fs.renameSync(source, target);
      }
    }
  }
  rotate();
  const knownSecrets = new Set();
  const session = crypto.randomUUID(),
    startedAt = new Date().toISOString();
  let part = 0,
    ended = false,
    failure = null;
  const base = () => ({
    schemaVersion: 1,
    application: 'Steam Animated Screensaver',
    version,
    session,
    part,
    startedAt,
    cleanExit: false,
    system: {
      platform: process.platform,
      arch: process.arch,
      node: process.versions.node,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      os: require('node:os').release()
    },
    events: []
  });
  let report = base();
  function persist() {
    const temp = path.join(folder, `.diagnostics-${crypto.randomUUID()}.tmp`);
    let fd;
    try {
      safe(file);
      fd = fs.openSync(temp, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify(report, null, 2) + '\n');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(temp, file);
      fs.chmodSync(file, 0o600);
      failure = null;
    } catch (e) {
      failure = e.message;
      try {
        if (fd !== undefined) fs.closeSync(fd);
        fs.unlinkSync(temp);
      } catch {}
    }
  }
  const logger = {
    file,
    addSecret(value) {
      if (typeof value === 'string' && value.trim()) knownSecrets.add(value.trim());
    },
    get failure() {
      return failure;
    },
    record(level, event, detail = {}) {
      if (ended) return;
      try {
        report.events.push({
          at: new Date().toISOString(),
          level: ['info', 'warn', 'error', 'fatal'].includes(level) ? level : 'info',
          event: String(event).slice(0, 160),
          detail: sanitize(detail, [...knownSecrets, ...secrets()])
        });
        if (
          Buffer.byteLength(JSON.stringify(report, null, 2)) > maxBytes &&
          report.events.length > 1
        ) {
          const latest = report.events.pop();
          persist();
          rotate();
          part++;
          report = base();
          report.part = part;
          report.events.push(latest);
        }
        persist();
      } catch (e) {
        failure = e.message;
      }
    },
    close() {
      if (ended) return;
      report.cleanExit = true;
      report.endedAt = new Date().toISOString();
      persist();
      ended = true;
    }
  };
  logger.record('info', 'session.started', { previousSessionInterrupted: previousInterrupted });
  return logger;
}
module.exports = { createDiagnostics, sanitize };
