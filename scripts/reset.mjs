/** Reset the database (delete the SQLite file). */
import { rmSync, existsSync } from "node:fs";
import path from "path";

const ROOT = process.cwd();
const DB_PATH = process.env.SQLITE_PATH
  ? path.isAbsolute(process.env.SQLITE_PATH) ? process.env.SQLITE_PATH : path.join(ROOT, process.env.SQLITE_PATH)
  : path.join(ROOT, "data", "sfgs.db");

for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  if (existsSync(DB_PATH + suffix)) {
    rmSync(DB_PATH + suffix);
    console.log(`Removed ${DB_PATH}${suffix}`);
  }
}
console.log("Database reset. Run `npm run db:seed` to repopulate demo data.");
