import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create or open the database
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/shpole.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
try {
  mkdirSync(dirname(dbPath), { recursive: true });
} catch (e) {
  // Directory might already exist
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database with schema
export function initializeDatabase() {
  const schemaPath = join(__dirname, 'shpole_schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('Database initialized successfully');
}

export default db;
