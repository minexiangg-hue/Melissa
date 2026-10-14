import { loadEnvFile } from "node:process";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, existsSync, chmodSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

loadEnvFile(resolve(process.argv[2] ?? ".env.preview"));
const source = resolve(process.env.DATABASE_PATH ?? ".data/teacher.db");
if (!existsSync(source))
  throw new Error(
    "The configured learner database does not exist; refusing an empty backup.",
  );
const directory = join(dirname(source), "backups");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const target = join(
  directory,
  `melissa-${new Date().toISOString().replace(/[:.]/g, "-")}.db`,
);
const database = new DatabaseSync(source, { readOnly: true });
try {
  await backup(database, target);
  chmodSync(target, 0o600);
  console.log(`Consistent SQLite backup saved: ${target}`);
} finally {
  database.close();
}
