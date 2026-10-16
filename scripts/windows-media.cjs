'use strict';
// Public releases use locally built tools with their complete source archives.
const { stageCrossMedia, peMachine } = require('./cross-media.cjs');
const stageWindowsMedia = (options) => stageCrossMedia({ ...options, target: 'windows-x64' });
module.exports = { stageWindowsMedia, peMachine };
