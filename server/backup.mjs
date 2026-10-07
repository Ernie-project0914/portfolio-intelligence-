import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, chmodSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
const directory = resolve(process.env.FOLIO_DATA_DIR || ".data");
const source = join(directory, "folio.sqlite");
if (!existsSync(source))
  throw new Error("Initialize the database before creating a backup");
const backups = join(directory, "backups");
mkdirSync(backups, { recursive: true, mode: 0o700 });
const destination = join(
  backups,
  `folio-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  chmodSync(destination, 0o600);
  console.log(`SQLite backup saved: ${destination}`);
} finally {
  db.close();
}
