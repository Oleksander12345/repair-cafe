import { spawn } from 'node:child_process';
import { assertIsolatedTestDatabase } from './pg-fixture.js';

assertIsolatedTestDatabase(process.env.TEST_DATABASE_URL);

const files = [
  'test/scenarios.test.ts',
  'test/concurrency.test.ts',
  'test/query-budget.test.ts',
  'test/db-invariants.test.ts',
  'test/failures.test.ts',
  'test/retry.test.ts',
];
const child = spawn(
  process.execPath,
  ['--import', 'tsx', '--test', '--test-concurrency=1', ...files],
  { stdio: 'inherit', env: { ...process.env, TEST_STORAGE: 'postgres' } },
);
child.on('error', (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
