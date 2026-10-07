import path from 'node:path';
import config from '../../playwright.multiplayer.config.js';
import { ROOT } from './pipeline.mjs';

export default { ...config, testDir: path.join(ROOT, 'tests'),
  outputDir: path.join(ROOT, '.planning/research/.cache/07-10-qualified/multiplayer-output'),
  reporter: [['list'], ['json', { outputFile: path.join(ROOT, '.planning/research/.cache/07-10-qualified/multiplayer-results.json') }]],
};
