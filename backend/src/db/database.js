const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const schemaPath = path.join(__dirname, "schema.sql");

// Opens a database file (or ":memory:" for tests) and makes sure all tables exist.
function createDatabase(file = ":memory:") {
  const db = new Database(file);
  db.pragma("foreign_keys = ON"); // SQLite ignores foreign keys unless this is on
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  return db;
}

// The app uses one shared connection to the real database file.
let instance = null;

function getDb() {
  if (!instance) {
    instance = createDatabase(process.env.DATABASE_PATH || "./library.db");
  }
  return instance;
}

module.exports = { createDatabase, getDb };