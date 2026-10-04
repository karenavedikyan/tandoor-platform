import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import routes from "timeweb:routes";
import { createTimewebApp } from "./timeweb-app.js";
import { closeTimewebPools } from "./timeweb-pg.js";

// Migration instance must never mirror writes to the former Yandex installation.
process.env.SHADOW_WRITE_ENABLED = "0";
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const app = createTimewebApp(routes, publicDir);
const server = app.listen(Number(process.env.PORT || 5000), "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "listening", runtime: "timeweb", apiRoutes: routes.length }));
});
process.on("SIGTERM", () => {
  server.close(() => void closeTimewebPools().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
});
