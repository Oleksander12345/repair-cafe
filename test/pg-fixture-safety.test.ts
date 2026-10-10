import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertIsolatedTestDatabase } from './pg-fixture.js';

test('PostgreSQL tests reject a default or non-test database', () => {
  for (const url of [
    undefined,
    'postgres://localhost:5432/repair_cafe_lab2_test_a',
    'postgres://localhost:55432/repair_cafe',
    'postgres://db.example:55432/repair_cafe_lab2_test_a',
    'postgres://localhost:55432/repair_cafe_lab2_test_a?host=db.example',
  ]) {
    assert.throws(() => assertIsolatedTestDatabase(url));
  }
  assert.equal(
    assertIsolatedTestDatabase('postgres://127.0.0.1:55432/repair_cafe_lab2_test_a'),
    'postgres://127.0.0.1:55432/repair_cafe_lab2_test_a',
  );
});
