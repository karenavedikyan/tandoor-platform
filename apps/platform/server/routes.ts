import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { registerAuthRoutes } from "./auth-routes";
import { registerInvitationRoutes } from "./invitation-routes";
import { registerAdminRoutes } from "./admin-routes";
import { registerProfileRoutes } from "./profile-routes";
import { registerBitrix24Routes } from "./bitrix24-routes";
import { registerDadataRoutes } from "./dadata-routes";
import { registerUploadRoutes } from "./upload-routes";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // prefix all routes with /api
  // use storage to perform CRUD operations on the storage interface
  // e.g. app.get("/api/items", async (_req, res) => { ... })

  registerAuthRoutes(app);
  registerInvitationRoutes(app);
  registerAdminRoutes(app);
  registerProfileRoutes(app);
  registerBitrix24Routes(app);
  registerDadataRoutes(app);
  registerUploadRoutes(app);

  return httpServer;
}
