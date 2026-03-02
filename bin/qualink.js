#!/usr/bin/env node

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const cliFile = join(currentDir, "..", "dist", "cli", "index.js");

if (!existsSync(cliFile)) {
  process.stderr.write(
    "qualink build output not found. Run `npm run build` before using the CLI.\n",
  );
  process.exit(1);
}

await import(cliFile);
