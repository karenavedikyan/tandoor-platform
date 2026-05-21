import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { registerBitrix24Routes } from "./bitrix24-routes";
import { registerDadataRoutes } from "./dadata-routes";
import { registerUploadRoutes } from "./upload-routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // prefix all routes with /api
  // use storage to perform CRUD operations on the storage interface
  // e.g. app.get("/api/items", async (_req, res) => { ... })

  registerBitrix24Routes(app);
  registerDadataRoutes(app);
  registerUploadRoutes(app);

  return httpServer;
}
