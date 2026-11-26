import { createTrainingServerApp } from '../../server.ts';
import {
  parsePlaywrightAuthRateLimitOverride,
  resolveListenPort,
} from '../../server/security.ts';

const PORT = resolveListenPort();
const BIND_HOST = '127.0.0.1';

async function startPlaywrightE2EServer(): Promise<void> {
  const authRateLimitMax = parsePlaywrightAuthRateLimitOverride(process.env);
  const { server } = await createTrainingServerApp({ authRateLimitMax });

  server.on('error', (err) => {
    console.error('AD-PRMS Playwright E2E HTTP server error:', err);
    process.exit(1);
  });

  server.listen(PORT, BIND_HOST, () => {
    console.log(
      `AD-PRMS Playwright E2E Server listening on http://${BIND_HOST}:${PORT} (authRateLimitMax=${authRateLimitMax})`
    );
  });
}

startPlaywrightE2EServer().catch((err) => {
  console.error('Failed to start AD-PRMS Playwright E2E server:', err);
  process.exit(1);
});
