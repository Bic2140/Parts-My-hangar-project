// Base de données SQLite pour iRent
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.IRENT_DB || path.join(__dirname, '..', 'irent.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schéma
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  email        TEXT    NOT NULL UNIQUE,
  password     TEXT    NOT NULL,
  phone        TEXT,
  city         TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  description  TEXT,
  category     TEXT    NOT NULL,
  price_day    REAL    NOT NULL,
  deposit      REAL    NOT NULL DEFAULT 0,
  city         TEXT,
  image_url    TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id      INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  renter_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date   TEXT    NOT NULL,
  end_date     TEXT    NOT NULL,
  days         INTEGER NOT NULL,
  price_day    REAL    NOT NULL,
  deposit      REAL    NOT NULL DEFAULT 0,
  service_fee  REAL    NOT NULL DEFAULT 0,
  total        REAL    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'en_attente',
  message      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_id      INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  author_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating       INTEGER NOT NULL,
  comment      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_owner   ON items(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_item ON bookings(item_id);
CREATE INDEX IF NOT EXISTS idx_bookings_rent ON bookings(renter_id);
`);

export default db;
