#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const impl = join(here, "seed-dealers-trade-points.impl.ts");
const r = spawnSync("npx", ["tsx", impl], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
