import { openDatabase } from "./db.mjs";
import { resolve } from "node:path";
const db = openDatabase(
  resolve(process.env.FOLIO_DATA_DIR || ".data", "folio.sqlite"),
);
console.log(
  `Database migrations applied: ${db.prepare("SELECT COUNT(*) count FROM schema_migrations").get().count}`,
);
db.close();
