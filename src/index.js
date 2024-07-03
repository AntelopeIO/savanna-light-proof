import express from 'express';
import util from 'util';

import { setupRoutes } from './api/api.js';
import { loadConfig } from './config/config.js';
import { synchronize } from './services/sync.js';

const app = express();
const port = process.env.PORT || 3000;

const originalConsoleLog = console.log;

console.log = function(...args) {
  const processedArgs = args.map(arg => 
    typeof arg === 'string' ? arg : util.inspect(arg, { showHidden: false, depth: null, colors: true })
  );
  originalConsoleLog.apply(console, processedArgs);
};

await loadConfig();
await setupRoutes(app);

app.listen(port, () => {
  console.log(`savanna-lightproof server running on port ${port}`);
  synchronize();
});