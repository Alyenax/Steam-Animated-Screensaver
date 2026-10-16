'use strict';
// Runtime IDs: ValveSoftware/steam-runtime/doc/reporting-steamlinuxruntime-bugs.md.
// Redistributables: help.steampowered.com/en/wizard/HelpWithGame/?appid=228980.
const IDS = new Set([228980, 1070560, 1391110, 1628350, 4183110]);
function isSteamComponent(item = {}) {
  if (!item || typeof item !== 'object') return false;
  const id = Number(
    item.steamAppId ||
      item.appid ||
      (String(item.id || '').startsWith('steam:') ? String(item.id).slice(6) : 0)
  );
  if (IDS.has(id)) return true;
  const name = String(item.name || '')
    .slice(0, 500)
    .normalize('NFKC')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    /^steam\s*linux\s*runtime(?:$|[\s_(-])/i.test(name) ||
    /^steamworks\s+(?:common\s+)?(?:redistributables?|redstributables?|redist|shared)(?:\s*\([^)]*\))?$/i.test(
      name
    ) ||
    /^proton$/i.test(name) ||
    /^proton[\s_-]*(?:v?\d+(?:\.\d+)*(?:[-._a-z0-9]+)?(?:\s*\([^)]*\))?|(?:experimental|hotfix|next|bleeding[- ]edge)(?:\s*[-(].*)?|(?:easy\s*anti[- ]?cheat|battleye)\s+runtime)$/i.test(
      name
    ) ||
    /^(?:ge[- ]?proton|proton[- ]?ge)(?:[- _]?\d[\w.+()-]*)?$/i.test(name)
  );
}
module.exports = { isSteamComponent };
