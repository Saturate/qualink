#!/usr/bin/env node

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const cliFile = join(currentDir, "..", "dist", "cli", "index.js");

if (!existsSync(cliFile)) {
  console.error(
    "qualink build output not found. Run `npm run build` before using the CLI.",
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { version } = require("../package.json");
process.stderr.write(`qualink v${version}\n`);

await import(cliFile);
