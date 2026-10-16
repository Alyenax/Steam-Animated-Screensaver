(function (root) {
  'use strict';
  const filters = [
    'all',
    'included',
    'ready',
    'needsAttention',
    'installedFilter',
    'notInstalledFilter',
    'ownedFilter',
    'manualFilter',
    'popularFilter',
    'animatedFilter',
    'missingFilter',
    'excludedFilter'
  ];
  function scope(input = {}) {
    const filter = input.filter ?? 'all',
      query = input.query ?? '';
    if (!filters.includes(filter) || typeof query !== 'string' || query.length > 300)
      throw new Error('Invalid library filter.');
    return { filter, query };
  }
  function matches(g, input = {}) {
    const { filter, query } = input;
    return (
      (filter === 'all' ||
        (filter === 'included' && g.included) ||
        (filter === 'ready' && g.status === 'ready') ||
        (filter === 'needsAttention' && g.status !== 'ready') ||
        (filter === 'installedFilter' && g.installed) ||
        (filter === 'notInstalledFilter' && !g.installed) ||
        (filter === 'ownedFilter' && g.sources?.includes('account')) ||
        (filter === 'manualFilter' && g.sources?.includes('manual')) ||
        (filter === 'popularFilter' && g.sources?.includes('popular')) ||
        (filter === 'animatedFilter' && (g.media?.animated || g.selectedAsset?.animated)) ||
        (filter === 'missingFilter' &&
          (g.status === 'missing' ||
            g.media?.animated === false ||
            g.selectedAsset?.animated === false)) ||
        (filter === 'excludedFilter' && !g.included)) &&
      g.name.toLowerCase().includes((query || '').toLowerCase())
    );
  }
  const ownedGame = (g) =>
    Number.isSafeInteger(g.steamAppId) &&
    g.steamAppId > 0 &&
    (g.installed || g.sources?.includes('account')) &&
    (!g.classification || g.classification === 'game');
  function personal(games) {
    return games
      .filter(
        (g) => ownedGame(g) && Number.isSafeInteger(g.playtimeMinutes) && g.playtimeMinutes >= 0
      )
      .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes || a.steamAppId - b.steamAppId)
      .slice(0, 100);
  }
  const api = { scope, matches, ownedGame, personal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScreensaverSelection = api;
})(typeof window !== 'undefined' ? window : globalThis);
