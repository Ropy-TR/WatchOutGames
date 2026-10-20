import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import './check-release.mjs';
for (const file of ['update-football.mjs', 'update-football-season.mjs', 'update-lol.mjs']) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(file, import.meta.url)), '--if-stale', '--allow-stale-on-error'], { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) { console.error(result.error?.message || file + ' failed'); process.exit(result.status || 1); }
}
