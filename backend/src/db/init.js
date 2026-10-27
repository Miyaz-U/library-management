require("dotenv").config();
const { getDb } = require("./database");

const db = getDb();

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )
  .all();

console.log("Database ready. Tables:");
for (const { name } of tables) {
  const columns = db.prepare(`PRAGMA table_info(${name})`).all();
  console.log(`  - ${name} (${columns.length} columns)`);
}