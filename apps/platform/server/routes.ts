import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import {
  createOrder,
  getActivity,
  getClaims,
  getDealers,
  getOrderById,
  getOrders,
  getOrganizations,
  getProducts,
  getUsers,
  type ApiResult,
} from "./api-handlers";

function send(res: Response, result: ApiResult) {
  return res.status(result.status).json(result.body);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get("/api/organizations", async (_req, res) => send(res, await getOrganizations()));
  app.get("/api/users", async (_req, res) => send(res, await getUsers()));
  app.get("/api/dealers", async (_req, res) => send(res, await getDealers()));
  app.get("/api/products", async (_req, res) => send(res, await getProducts()));
  app.get("/api/orders", async (_req, res) => send(res, await getOrders()));
  app.post("/api/orders", async (req: Request, res) =>
    send(res, await createOrder(req.body)),
  );
  app.get("/api/orders/:id", async (req: Request, res) => {
    const rawId = req.params.id;
    const idValue = Array.isArray(rawId) ? rawId[0] : rawId;
    return send(res, await getOrderById(idValue ?? ""));
  });
  app.get("/api/claims", async (_req, res) => send(res, await getClaims()));
  app.get("/api/activity", async (_req, res) => send(res, await getActivity()));

  return httpServer;
}
