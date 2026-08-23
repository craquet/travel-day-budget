import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExpressApp, serveSpa } from './app.js';
import { closeDb, initDb } from './db.js';
import { uploadsDir } from './uploads.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Compiled layout: dist/server/index.js → dist/web
const distWeb = process.env.STATIC_DIR ?? path.resolve(here, '../web');

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const port = Number(process.env.PORT ?? 3000);
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 5);

initDb(dataDir);
uploadsDir(dataDir); // ensure it exists before first photo request

const app = buildExpressApp({ dataDir, maxUploadMb });
serveSpa(app, distWeb);

const server = app.listen(port, () => {
  console.log(`travel-day-budget listening on :${port} (data: ${path.resolve(dataDir)})`);
});

function shutdown(): void {
  console.log('Shutting down…');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  // Hard exit if connections refuse to drain.
  setTimeout(() => {
    closeDb();
    process.exit(0);
  }, 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
