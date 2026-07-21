import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

/**
 * Lazily open (and cache) the SQLite database connection.
 * Ensures the containing directory exists and enables sane pragmas.
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (db) return db;

  const dir = path.dirname(config.db.path);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(config.db.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  logger.info('Database connection established', { path: config.db.path });
  return db;
}

/**
 * Apply the schema defined in schema.sql. Safe to run repeatedly.
 * @returns {void}
 */
export function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  getDb().exec(sql);
  logger.info('Database migrations applied');
}

/**
 * Close the database connection (used on graceful shutdown).
 * @returns {void}
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
