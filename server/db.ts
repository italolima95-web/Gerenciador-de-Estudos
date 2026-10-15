import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
export const id = () => randomUUID();
const migration = `
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contests(id TEXT PRIMARY KEY,name TEXT NOT NULL,board TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',exam_date TEXT NOT NULL DEFAULT '',main INTEGER NOT NULL DEFAULT 0,target REAL NOT NULL DEFAULT 80,min_sample INTEGER NOT NULL DEFAULT 20,daily_minutes INTEGER NOT NULL DEFAULT 120,topic_minutes INTEGER NOT NULL DEFAULT 60,question_goal INTEGER NOT NULL DEFAULT 20,rest_days TEXT NOT NULL DEFAULT '[0]',metadata TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,contest_id TEXT REFERENCES contests(id),topic_id TEXT REFERENCES topics(id),name TEXT NOT NULL,kind TEXT NOT NULL,filename TEXT NOT NULL,pages INTEGER NOT NULL CHECK(pages>0),resume_page INTEGER NOT NULL DEFAULT 1,text_pages TEXT NOT NULL DEFAULT '[]',outline TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS topics(id TEXT PRIMARY KEY,contest_id TEXT NOT NULL REFERENCES contests(id),parent_id TEXT REFERENCES topics(id),kind TEXT NOT NULL CHECK(kind IN ('discipline','subject','subtopic')),title TEXT NOT NULL,weight REAL NOT NULL DEFAULT 1 CHECK(weight>0),coverage TEXT NOT NULL DEFAULT 'unread',review_state TEXT NOT NULL DEFAULT 'not_reviewed',source_document_id TEXT REFERENCES documents(id),source_page INTEGER,source_section TEXT NOT NULL DEFAULT '',source_excerpt TEXT NOT NULL DEFAULT '',confidence REAL NOT NULL DEFAULT 1,verified INTEGER NOT NULL DEFAULT 1,position INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS facts(id TEXT PRIMARY KEY,contest_id TEXT NOT NULL REFERENCES contests(id),document_id TEXT NOT NULL REFERENCES documents(id),field TEXT NOT NULL,value TEXT NOT NULL,page INTEGER NOT NULL,section TEXT NOT NULL,excerpt TEXT NOT NULL,confidence REAL NOT NULL,status TEXT NOT NULL DEFAULT 'pending',previous_value TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS mappings(id TEXT PRIMARY KEY,topic_id TEXT NOT NULL REFERENCES topics(id),document_id TEXT NOT NULL REFERENCES documents(id),start_page INTEGER NOT NULL CHECK(start_page>0),end_page INTEGER NOT NULL CHECK(end_page>=start_page),confirmed INTEGER NOT NULL DEFAULT 0,confidence REAL NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS readings(id TEXT PRIMARY KEY,document_id TEXT NOT NULL REFERENCES documents(id),topic_id TEXT REFERENCES topics(id),start_page INTEGER NOT NULL CHECK(start_page>0),end_page INTEGER NOT NULL CHECK(end_page>=start_page),resume_page INTEGER NOT NULL,date TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 1,notes TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS mocks(id TEXT PRIMARY KEY,contest_id TEXT NOT NULL REFERENCES contests(id),title TEXT NOT NULL,board TEXT NOT NULL DEFAULT '',date TEXT NOT NULL,minutes REAL NOT NULL DEFAULT 0,include_stats INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,date TEXT NOT NULL,board TEXT NOT NULL DEFAULT '',origin TEXT NOT NULL DEFAULT '',question_type TEXT NOT NULL DEFAULT 'multiple',correct INTEGER NOT NULL CHECK(correct>=0),wrong INTEGER NOT NULL CHECK(wrong>=0),blank INTEGER NOT NULL CHECK(blank>=0),minutes REAL NOT NULL DEFAULT 0 CHECK(minutes>=0),weight REAL NOT NULL DEFAULT 1 CHECK(weight>=0),penalty REAL NOT NULL DEFAULT 0 CHECK(penalty>=0),notes TEXT NOT NULL DEFAULT '',mock_id TEXT REFERENCES mocks(id),include_stats INTEGER NOT NULL DEFAULT 1,tags TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS attempt_links(attempt_id TEXT NOT NULL REFERENCES attempts(id),contest_id TEXT NOT NULL REFERENCES contests(id),topic_id TEXT REFERENCES topics(id),PRIMARY KEY(attempt_id,contest_id));
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,contest_id TEXT NOT NULL REFERENCES contests(id),topic_id TEXT REFERENCES topics(id),date TEXT NOT NULL,minutes REAL NOT NULL CHECK(minutes>=0),kind TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',interrupted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS session_links(session_id TEXT NOT NULL REFERENCES sessions(id),contest_id TEXT NOT NULL REFERENCES contests(id),topic_id TEXT REFERENCES topics(id),PRIMARY KEY(session_id,contest_id));
CREATE TABLE IF NOT EXISTS blocks(id TEXT PRIMARY KEY,contest_id TEXT NOT NULL REFERENCES contests(id),topic_id TEXT REFERENCES topics(id),title TEXT NOT NULL,minutes INTEGER NOT NULL CHECK(minutes>0),kind TEXT NOT NULL,position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cycles(contest_id TEXT PRIMARY KEY REFERENCES contests(id),block_id TEXT REFERENCES blocks(id),lap INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,contest_id TEXT NOT NULL REFERENCES contests(id),topic_id TEXT NOT NULL REFERENCES topics(id),document_id TEXT REFERENCES documents(id),pages TEXT NOT NULL DEFAULT '',due_date TEXT NOT NULL,completed_at TEXT,minutes REAL NOT NULL DEFAULT 0,difficulty TEXT NOT NULL DEFAULT 'medium');
CREATE TABLE IF NOT EXISTS bookmarks(id TEXT PRIMARY KEY,document_id TEXT NOT NULL REFERENCES documents(id),page INTEGER NOT NULL,note TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,entity TEXT NOT NULL,entity_id TEXT NOT NULL,action TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS topics_parent ON topics(parent_id);
CREATE INDEX IF NOT EXISTS attempts_date ON attempts(date);
CREATE INDEX IF NOT EXISTS links_contest ON attempt_links(contest_id);
CREATE INDEX IF NOT EXISTS reviews_due ON reviews(due_date);
CREATE INDEX IF NOT EXISTS readings_doc ON readings(document_id);
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,datetime('now'));
`;
const jsonColumns = new Set(['metadata', 'text_pages', 'outline', 'tags']);
export class Store {
  db!: Database;
  SQL!: SqlJsStatic;
  file: string;
  dataDir: string;
  inTransaction = false;
  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'studies.sqlite');
  }
  async init() {
    mkdirSync(this.dataDir, { recursive: true });
    mkdirSync(path.join(this.dataDir, 'files'), { recursive: true });
    mkdirSync(path.join(this.dataDir, 'backups'), { recursive: true });
    this.SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
    this.db = existsSync(this.file)
      ? new this.SQL.Database(readFileSync(this.file))
      : new this.SQL.Database();
    this.db.run('PRAGMA foreign_keys=ON');
    this.db.run(migration);
    this.persist();
    this.autoBackup();
    return this;
  }
  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as (string | number | null | Uint8Array)[]);
      const result: T[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        for (const key of jsonColumns)
          if (typeof row[key] === 'string') row[key] = JSON.parse(row[key] as string);
        result.push(row as T);
      }
      return result;
    } finally {
      stmt.free();
    }
  }
  one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    return this.all<T>(sql, params)[0];
  }
  run(sql: string, params: unknown[] = []) {
    if (!this.inTransaction) {
      this.transaction(() => this.db.run(sql, params as (string | number | null | Uint8Array)[]));
      return;
    }
    this.db.run(sql, params as (string | number | null | Uint8Array)[]);
  }
  insert(table: string, data: Record<string, unknown>) {
    const keys = Object.keys(data);
    this.run(
      `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      keys.map((k) => this.encode(data[k])),
    );
  }
  update(table: string, key: string, data: Record<string, unknown>) {
    const keys = Object.keys(data);
    if (!keys.length) return;
    this.run(`UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, [
      ...keys.map((k) => this.encode(data[k])),
      key,
    ]);
  }
  encode(value: unknown) {
    return value === undefined
      ? null
      : typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : value;
  }
  transaction<T>(fn: () => T): T {
    if (this.inTransaction) throw Error('Transação aninhada');
    const previous = this.snapshot();
    let committed = false;
    this.db.run('BEGIN');
    this.inTransaction = true;
    try {
      const value = fn();
      this.db.run('COMMIT');
      committed = true;
      this.persist();
      return value;
    } catch (e) {
      if (!committed) this.db.run('ROLLBACK');
      else {
        this.db.close();
        this.db = new this.SQL.Database(previous);
        this.db.run('PRAGMA foreign_keys=ON');
      }
      throw e;
    } finally {
      this.inTransaction = false;
    }
  }

  audit(entity: string, key: string, action: string, before: unknown, after: unknown) {
    this.insert('events', {
      id: id(),
      entity,
      entity_id: key,
      action,
      before_json: JSON.stringify(before ?? null),
      after_json: JSON.stringify(after ?? null),
      created_at: new Date().toISOString(),
    });
  }
  preference(key: string, value: unknown) {
    this.run(
      'INSERT INTO preferences(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [key, JSON.stringify(value)],
    );
  }
  snapshot() {
    const bytes = this.db.export();
    this.db.run('PRAGMA foreign_keys=ON');
    return bytes;
  }
  persist() {
    writeFileSync(this.file + '.tmp', this.snapshot());
    renameSync(this.file + '.tmp', this.file);
  }
  autoBackup() {
    const dir = path.join(this.dataDir, 'backups');
    const name = new Date().toISOString().slice(0, 10) + '.sqlite';
    if (!existsSync(path.join(dir, name))) copyFileSync(this.file, path.join(dir, name));
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sqlite'))
      .sort();
    for (const file of files.slice(0, -7)) unlinkSync(path.join(dir, file));
  }
  close() {
    this.db.close();
  }
}
export { migration };
