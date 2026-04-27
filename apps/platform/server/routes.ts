import type { Express } from "express";
import type { Server } from 'node:http';
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/organizations", async (_req, res) => {
    const organizations = await storage.listOrganizations();
    return res.json(organizations);
  });

  app.get("/api/users", async (_req, res) => {
    const users = await storage.listUsers();
    return res.json(users);
  });

  app.get("/api/dealers", async (_req, res) => {
    const dealers = await storage.listDealers();
    return res.json(dealers);
  });

  app.get("/api/products", async (_req, res) => {
    const products = await storage.listProducts();
    return res.json(products);
  });

  app.get("/api/orders", async (_req, res) => {
    const orders = await storage.listOrders();
    return res.json(orders);
  });

  app.get("/api/orders/:id", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Order id must be a valid number" });
    }

    const order = await storage.getOrderById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json(order);
  });

  app.get("/api/claims", async (_req, res) => {
    const claims = await storage.listClaims();
    return res.json(claims);
  });

  app.get("/api/activity", async (_req, res) => {
    const activityEvents = await storage.listActivityEvents();
    return res.json(activityEvents);
  });

  return httpServer;
}
