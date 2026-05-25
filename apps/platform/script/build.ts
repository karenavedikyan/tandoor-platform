import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "bcryptjs",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function logCatalogRelatedChunks() {
  const assetsDir = path.resolve("dist/public/assets");
  const names = await readdir(assetsDir).catch(() => []);
  const rows: { name: string; bytes: number }[] = [];
  for (const name of names) {
    if (!name.endsWith(".js")) continue;
    if (!/catalog-real-seed|catalog-data|catalog-mock-products/i.test(name)) continue;
    const st = await stat(path.join(assetsDir, name));
    rows.push({ name, bytes: st.size });
  }
  rows.sort((a, b) => b.bytes - a.bytes);
  if (rows.length) {
    console.log("client chunks (catalog-related, minified):");
    for (const r of rows.slice(0, 12)) {
      const kb = Math.round(r.bytes / 102.4) / 10;
      console.log(`  ${kb} kB  ${r.name}`);
    }
  }
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();
  await logCatalogRelatedChunks();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
