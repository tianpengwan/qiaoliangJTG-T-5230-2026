// SQLite 数据库层（Node.js 内置 node:sqlite，无需原生编译）
// 评定依据：JTG/T 5230—2026
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const EXPORT_DIR = path.join(__dirname, "exports");
[DATA_DIR, UPLOAD_DIR, EXPORT_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

// 使用独立数据库文件，避免与旧版 JTG/T H21—2011 数据混淆
const db = new DatabaseSync(path.join(DATA_DIR, "bridge5230.db"));
db.exec("PRAGMA journal_mode=WAL;");
db.exec("PRAGMA foreign_keys=ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS bridges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  bridge_type TEXT,
  structure_form TEXT NOT NULL,
  span_count INTEGER DEFAULT 1,
  span_combination TEXT,
  total_length REAL,
  max_span REAL,
  build_year INTEGER,
  last_grade TEXT,
  last_year INTEGER,
  assess_date TEXT,
  org TEXT,
  owner TEXT,
  remark TEXT,
  five_class TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS spans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bridge_id INTEGER NOT NULL REFERENCES bridges(id) ON DELETE CASCADE,
  span_no INTEGER NOT NULL,
  name TEXT,
  major_override TEXT,
  UNIQUE(bridge_id, span_no)
);

CREATE TABLE IF NOT EXISTS components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bridge_id INTEGER NOT NULL REFERENCES bridges(id) ON DELETE CASCADE,
  span_id INTEGER NOT NULL REFERENCES spans(id) ON DELETE CASCADE,
  part TEXT NOT NULL,
  comp_key TEXT NOT NULL,
  name TEXT NOT NULL,
  weight REAL DEFAULT 0,
  gamma REAL DEFAULT 0,
  is_major INTEGER DEFAULT 0,
  material TEXT DEFAULT 'concrete',
  structural_table TEXT,
  efi_table TEXT,
  member_count INTEGER DEFAULT 0,
  absent INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  member_label TEXT,
  category TEXT NOT NULL,
  indicator TEXT NOT NULL,
  table_id TEXT,
  scale INTEGER,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bridge_id INTEGER REFERENCES bridges(id) ON DELETE CASCADE,
  component_id INTEGER REFERENCES components(id) ON DELETE CASCADE,
  finding_id INTEGER REFERENCES findings(id) ON DELETE CASCADE,
  filename TEXT,
  original_name TEXT,
  bridge_photo_type TEXT,
  ai_result TEXT,
  ai_category TEXT,
  ai_indicator TEXT,
  ai_scale INTEGER,
  ai_description TEXT,
  ai_confidence REAL,
  ai_status TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_spans_bridge ON spans(bridge_id);
CREATE INDEX IF NOT EXISTS idx_components_bridge ON components(bridge_id);
CREATE INDEX IF NOT EXISTS idx_components_span ON components(span_id);
CREATE INDEX IF NOT EXISTS idx_findings_component ON findings(component_id);
CREATE INDEX IF NOT EXISTS idx_photos_finding ON photos(finding_id);
`);

module.exports = { db, UPLOAD_DIR, EXPORT_DIR };
