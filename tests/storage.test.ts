import { test, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../server/db.js';
test('falha de gravação restaura o estado anterior também em memória', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studies-disk-test-'));
  const store = await new Store(dir).init();
  try {
    store.preference('theme', 'light');
    const original = store.persist.bind(store);
    const spy = vi.spyOn(store, 'persist').mockImplementation(() => {
      throw Error('Disco cheio');
    });
    expect(() => store.preference('theme', 'dark')).toThrow('Disco cheio');
    spy.mockRestore();
    expect(
      store.one<{ value: string }>("SELECT value FROM preferences WHERE key='theme'")?.value,
    ).toBe('"light"');
    expect(store.one<{ foreign_keys: number }>('PRAGMA foreign_keys')?.foreign_keys).toBe(1);
    original();
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
