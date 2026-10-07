import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export function openDatabase(path) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const directory = fileURLToPath(new URL("./migrations/", import.meta.url));
  for (const file of readdirSync(directory).sort()) {
    const version = Number(file.split("_")[0]);
    if (
      !db
        .prepare("SELECT version FROM schema_migrations WHERE version=?")
        .get(version)
    ) {
      db.exec("BEGIN IMMEDIATE");
      try {
        db.exec(readFileSync(resolve(directory, file), "utf8"));
        db.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(
          version,
          new Date().toISOString(),
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
  }
  return db;
}
