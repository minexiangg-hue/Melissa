import { loadEnvFile } from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("..", import.meta.url));
// Load the private preview settings without forwarding --env-file to Next's
// worker threads, where Node rejects that flag in inherited execution options.
loadEnvFile(fileURLToPath(new URL("../.env.preview", import.meta.url)));
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/next/dist/bin/next", import.meta.url),
    ),
    "build",
  ],
  { cwd: project, env: process.env, stdio: "inherit" },
);
if (result.error)
  console.error("Unable to start the preview build:", result.error.message);
process.exit(result.status ?? 1);
