import { build } from "esbuild";
import { readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
async function scan(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith("_") || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await scan(file));
    else if (entry.name.endsWith(".ts") && !/\.(test|spec|d)\.ts$/.test(entry.name)) files.push(file);
  }
  return files;
}
const files = await scan(path.join(root, "api"));
const routes = files.map(file => ({
  path: "/api/" + path.relative(path.join(root, "api"), file).replace(/\.ts$/, "").replace(/\[([^\]]+)\]/g, ":$1"),
  file,
})).sort((a, b) => {
  const dynamicA = a.path.split("/").findIndex(s => s.startsWith(":"));
  const dynamicB = b.path.split("/").findIndex(s => s.startsWith(":"));
  return (dynamicA < 0 ? -1 : dynamicB < 0 ? 1 : dynamicB - dynamicA) || a.path.localeCompare(b.path);
});
await rm("dist/timeweb", { recursive: true, force: true });
await build({
  entryPoints: { index: "server/timeweb-index.ts" },
  outdir: "dist/timeweb", outExtension: { ".js": ".mjs" }, chunkNames: "chunks/[name]-[hash]",
  platform: "node", target: "node22", format: "esm", bundle: true, splitting: true,
  packages: "external",
  alias: { "@neondatabase/serverless": path.join(root, "server/timeweb-pg.ts") },
  plugins: [{
    name: "api-routes",
    setup(builder) {
      builder.onResolve({ filter: /^timeweb:routes$/ }, () => ({ path: "routes", namespace: "timeweb" }));
      builder.onLoad({ filter: /.*/, namespace: "timeweb" }, () => ({
        contents: `export default [${routes.map(r => `{path:${JSON.stringify(r.path)},load:()=>import(${JSON.stringify(r.file)})}`).join(",")}];`,
        loader: "ts", resolveDir: root,
      }));
    },
  }],
  logLevel: "info",
});
await writeFile("dist/timeweb/routes.json", JSON.stringify(routes.map(r => r.path), null, 2));
console.log(`Timeweb: ${routes.length} API routes`);
