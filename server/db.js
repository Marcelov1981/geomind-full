import process from 'node:process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import knex from 'knex';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isOnVercel = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV) || process.platform === 'linux' && fs.existsSync('/var/task') && !fs.existsSync(path.resolve(__dirname, '..', 'data', '.writable_marker')) && process.env.NODE_ENV !== 'test' && !process.env.VITEST;

let dataDir = process.env.GEOMIND_DATA_DIR || path.resolve(__dirname, '..', 'data');
if (isOnVercel && !process.env.DATABASE_URL?.trim()) {
  dataDir = path.join(os.tmpdir(), 'geomind-data');
}

const configuredUrl = process.env.DATABASE_URL?.trim() || '';
const isPostgres = /^postgres(ql)?:\/\//i.test(configuredUrl);

if (!isPostgres) fs.mkdirSync(dataDir, { recursive: true });
let sqliteFilename = configuredUrl.startsWith('sqlite:')
  ? configuredUrl.slice('sqlite:'.length)
  : path.join(dataDir, process.env.NODE_ENV === 'test' ? 'test.sqlite' : 'geomind.sqlite');

if (isOnVercel && !isPostgres && !configuredUrl.startsWith('sqlite:')) {
  sqliteFilename = path.join(os.tmpdir(), 'geomind.sqlite');
  try { fs.mkdirSync(path.dirname(sqliteFilename), { recursive: true }); } catch {}
}

const quoteIdentifier = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;
const normalizeValue = (value) => {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
};

class ColumnBuilder {
  constructor(table, name, type) {
    this.table = table;
    this.name = name;
    this.type = type;
    this.parts = [quoteIdentifier(name), type];
  }
  unsigned() { return this; }
  notNullable() { this.parts.push('NOT NULL'); return this; }
  nullable() { return this; }
  primary() { if (!this.parts.some((part) => part.includes('PRIMARY KEY'))) this.parts.push('PRIMARY KEY'); return this; }
  unique() { this.parts.push('UNIQUE'); return this; }
  defaultTo(value) {
    const sql = value === 'CURRENT_TIMESTAMP' ? value : typeof value === 'boolean' ? (value ? '1' : '0') : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
    this.parts.push(`DEFAULT ${sql}`);
    return this;
  }
  references(column) { this.reference = { column }; return this; }
  inTable(table) { if (this.reference) this.reference.table = table; return this; }
  onDelete(action) { if (this.reference) this.reference.onDelete = action; return this; }
  toSQL() {
    const reference = this.reference?.table ? ` REFERENCES ${quoteIdentifier(this.reference.table)}(${quoteIdentifier(this.reference.column)})${this.reference.onDelete ? ` ON DELETE ${this.reference.onDelete}` : ''}` : '';
    return `${this.parts.join(' ')}${reference}`;
  }
}

class SchemaTableBuilder {
  constructor(name) { this.name = name; this.columns = []; this.constraints = []; this.indexes = []; }
  increments(name) { const column = new ColumnBuilder(this, name, 'INTEGER PRIMARY KEY AUTOINCREMENT'); this.columns.push(column); return column; }
  integer(name) { const column = new ColumnBuilder(this, name, 'INTEGER'); this.columns.push(column); return column; }
  string(name) { const column = new ColumnBuilder(this, name, 'TEXT'); this.columns.push(column); return column; }
  text(name) { const column = new ColumnBuilder(this, name, 'TEXT'); this.columns.push(column); return column; }
  boolean(name) { const column = new ColumnBuilder(this, name, 'INTEGER'); this.columns.push(column); return column; }
  decimal(name) { const column = new ColumnBuilder(this, name, 'NUMERIC'); this.columns.push(column); return column; }
  json(name) { const column = new ColumnBuilder(this, name, 'TEXT'); this.columns.push(column); return column; }
  timestamp(name) { const column = new ColumnBuilder(this, name, 'TEXT'); this.columns.push(column); return column; }
  unique(columns) { this.constraints.push(`UNIQUE (${columns.map(quoteIdentifier).join(', ')})`); return this; }
  index(columns, name) { this.indexes.push({ columns, name }); return this; }
  primary(columns) { this.constraints.push(`PRIMARY KEY (${columns.map(quoteIdentifier).join(', ')})`); return this; }
  build() { return [`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(this.name)} (${[...this.columns.map((column) => column.toSQL()), ...this.constraints].join(', ')})`, ...this.indexes.map(({ columns, name }) => `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(name || `${this.name}_${columns.join('_')}_idx`)} ON ${quoteIdentifier(this.name)} (${columns.map(quoteIdentifier).join(', ')})`)]; }
}

class SQLiteQuery {
  constructor(adapter, table) { this.adapter = adapter; this.table = table; this.conditions = []; this.ordering = []; this._limit = null; this._offset = null; this.selection = '*'; this.countAlias = null; }
  where(criteria) {
    for (const [key, value] of Object.entries(criteria || {})) {
      if (value === null || value === undefined) this.conditions.push({ sql: `${quoteIdentifier(key)} IS NULL`, bindings: [] });
      else this.conditions.push({ sql: `${quoteIdentifier(key)} = ?`, bindings: [normalizeValue(value)] });
    }
    return this;
  }
  whereRaw(sql, bindings = []) { this.conditions.push({ sql, bindings: bindings.map(normalizeValue) }); return this; }
  orderBy(column, direction = 'asc') { this.ordering.push(`${quoteIdentifier(column)} ${String(direction).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`); return this; }
  limit(value) { this._limit = Math.max(Number(value) || 0, 0); return this; }
  offset(value) { this._offset = Math.max(Number(value) || 0, 0); return this; }
  select(...fields) { this.selection = fields.length ? fields.map(quoteIdentifier).join(', ') : '*'; return this; }
  count(spec = { count: '*' }) { this.countAlias = Object.keys(spec)[0] || 'count'; this.selection = `COUNT(${spec[this.countAlias] === '*' ? '*' : quoteIdentifier(spec[this.countAlias])}) AS ${quoteIdentifier(this.countAlias)}`; return this; }
  _whereSql() { return this.conditions.length ? ` WHERE ${this.conditions.map((condition) => condition.sql).join(' AND ')}` : ''; }
  async first() { this._limit = 1; const rows = await this.execute(); return rows[0]; }
  async execute() {
    const sql = `SELECT ${this.selection} FROM ${quoteIdentifier(this.table)}${this._whereSql()}${this.ordering.length ? ` ORDER BY ${this.ordering.join(', ')}` : ''}${this._limit !== null ? ` LIMIT ${this._limit}` : ''}${this._offset !== null ? ` OFFSET ${this._offset}` : ''}`;
    return this.adapter.all(sql, this.conditions.flatMap((condition) => condition.bindings));
  }
  async insert(payload) {
    const rows = Array.isArray(payload) ? payload : [payload];
    let lastId = null;
    for (const row of rows) {
      const entries = Object.entries(row).filter(([, value]) => value !== undefined);
      const sql = `INSERT INTO ${quoteIdentifier(this.table)} (${entries.map(([key]) => quoteIdentifier(key)).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`;
      const result = this.adapter.run(sql, entries.map(([, value]) => normalizeValue(value)));
      lastId = Number(result.lastInsertRowid);
    }
    return [lastId];
  }
  async update(payload) {
    const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
    const sql = `UPDATE ${quoteIdentifier(this.table)} SET ${entries.map(([key]) => `${quoteIdentifier(key)} = ?`).join(', ')}${this._whereSql()}`;
    const result = this.adapter.run(sql, [...entries.map(([, value]) => normalizeValue(value)), ...this.conditions.flatMap((condition) => condition.bindings)]);
    return result.changes;
  }
  async delete() {
    const sql = `DELETE FROM ${quoteIdentifier(this.table)}${this._whereSql()}`;
    const result = this.adapter.run(sql, this.conditions.flatMap((condition) => condition.bindings));
    return result.changes;
  }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

class SQLiteAdapter {
  constructor(filename) {
    this.sqlite = new DatabaseSync(filename);
    this.sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.schema = {
      hasTable: async (table) => Boolean(this.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table])),
      createTable: async (tableName, callback) => {
        const builder = new SchemaTableBuilder(tableName);
        callback(builder);
        for (const sql of builder.build()) this.sqlite.exec(sql);
      },
      dropTableIfExists: async (tableName) => this.sqlite.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`),
    };
    this.fn = { now: () => 'CURRENT_TIMESTAMP' };
  }
  get(sql, bindings = []) { return this.sqlite.prepare(sql).get(...bindings); }
  all(sql, bindings = []) { return this.sqlite.prepare(sql).all(...bindings); }
  run(sql, bindings = []) { return this.sqlite.prepare(sql).run(...bindings); }
  raw(sql, bindings = []) { return { rows: this.all(sql, bindings) }; }
  transaction(callback) {
    const trx = (table) => this.query(table);
    trx.schema = this.schema;
    trx.fn = this.fn;
    trx.raw = this.raw.bind(this);
    return (async () => {
      this.sqlite.exec('BEGIN');
      try { const result = await callback(trx); this.sqlite.exec('COMMIT'); return result; } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
    })();
  }
  destroy() { this.sqlite.close(); return Promise.resolve(); }
  query(table) { return new SQLiteQuery(this, table); }
}

const sqliteAdapter = isPostgres ? null : new SQLiteAdapter(sqliteFilename);
const pgAdapter = isPostgres ? knex({ client: 'pg', connection: configuredUrl, pool: { min: 1, max: Number(process.env.DB_POOL_MAX || 10) }, acquireConnectionTimeout: 10000 }) : null;

export const db = isPostgres
  ? pgAdapter
  : Object.assign((table) => sqliteAdapter.query(table), {
      schema: sqliteAdapter.schema,
      fn: sqliteAdapter.fn,
      raw: sqliteAdapter.raw.bind(sqliteAdapter),
      transaction: sqliteAdapter.transaction.bind(sqliteAdapter),
      destroy: sqliteAdapter.destroy.bind(sqliteAdapter),
    });

export const databaseInfo = { driver: isPostgres ? 'postgresql' : 'sqlite', location: isPostgres ? 'remote' : sqliteFilename };
export async function closeDatabase() { await db.destroy(); }
