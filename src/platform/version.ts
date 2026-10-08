import { execSync } from 'node:child_process';

export function resolveVersion(configuredSha: string | undefined): string {
  if (configuredSha) return configuredSha;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}
