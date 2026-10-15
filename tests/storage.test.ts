import { test, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store, migration } from '../server/db.js';
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

test('migra banco v1 preservando estudos e fonte, cria cópia anterior e mantém chaves estrangeiras', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studies-v1-'));
  let store = await new Store(dir).init();
  try {
    const legacy = new store.SQL.Database();
    legacy.run(migration);
    legacy.run(
      "INSERT INTO contests(id,name,created_at) VALUES('c','Concurso preservado','2026-10-15')",
    );
    legacy.run(
      "INSERT INTO documents(id,contest_id,name,kind,filename,pages,created_at) VALUES('d','c','Edital','notice','d.pdf',2,'2026-10-15')",
    );
    legacy.run(
      "INSERT INTO topics(id,contest_id,kind,title,coverage,source_document_id,source_page) VALUES('t','c','discipline','Direito Civil','studied','d',2)",
    );
    legacy.run(
      "INSERT INTO sessions(id,contest_id,topic_id,date,minutes,kind) VALUES('s','c','t','2026-10-15',30,'theory')",
    );
    store.close();
    const previous = legacy.export();
    legacy.close();
    writeFileSync(path.join(dir, 'studies.sqlite'), previous);
    store = await new Store(dir).init();
    expect(store.one('SELECT title,coverage FROM topics')).toEqual({
      title: 'Direito Civil',
      coverage: 'studied',
    });
    expect(store.one('SELECT minutes,cycle_lap FROM sessions')).toEqual({
      minutes: 30,
      cycle_lap: null,
    });
    expect(store.one('SELECT document_id,topic_id,page FROM syllabus_items')).toEqual({
      document_id: 'd',
      topic_id: 't',
      page: 2,
    });
    expect(store.one('SELECT MAX(version) as version FROM schema_migrations')).toEqual({
      version: 2,
    });
    const backup = readdirSync(path.join(dir, 'backups')).find((f) =>
      f.startsWith('antes-atualizacao-'),
    )!;
    expect(readFileSync(path.join(dir, 'backups', backup))).toEqual(Buffer.from(previous));
    expect(store.one('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    store.close();
    store = await new Store(dir).init();
    expect(store.all('SELECT * FROM syllabus_items')).toHaveLength(1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
