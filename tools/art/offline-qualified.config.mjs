import path from 'node:path';
import { readFile } from 'node:fs/promises';
import config from '../../playwright.config.js';
import { ROOT } from './pipeline.mjs';

// Allocate once before launching Playwright. Workers re-evaluate config, and
// must use the same owned listener rather than allocating their own baseURL.
const { port } = JSON.parse(await readFile(path.join(ROOT,
  '.planning/research/.cache/07-10-qualified/listener-port.json'), 'utf8'));
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 5173)
  throw Error('Allocate an owned free qualification port before running this config');
export default { ...config, testDir: path.join(ROOT, 'tests'), workers: 1,
  outputDir: path.join(ROOT, '.planning/research/.cache/07-10-qualified/offline-output'),
  reporter: [['list'], ['json', { outputFile: path.join(ROOT, '.planning/research/.cache/07-10-qualified/offline-results.json') }]],
  use: { ...config.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: { ...config.webServer,
    cwd: ROOT,
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort --base /`,
    url: `http://127.0.0.1:${port}`, port: undefined, reuseExistingServer: false },
};
