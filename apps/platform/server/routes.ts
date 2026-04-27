import type { Express } from "express";
import type { Server } from 'node:http';
import { z } from "zod";
import { StorageError, storage } from "./storage";

const createOrderRequestSchema = z.object({
  dealerId: z.number().int().positive(),
  createdByUserId: z.number().int().positive().optional(),
  salesManagerId: z.number().int().positive().optional(),
  comment: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int(),
      }),
    )
    .min(1),
});

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

  app.post("/api/orders", async (req, res) => {
    const parsed = createOrderRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid order payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const payload = parsed.data;
    const createdByUserId = payload.createdByUserId ?? payload.salesManagerId;
    if (!createdByUserId) {
      return res.status(400).json({
        message: "Either createdByUserId or salesManagerId must be provided",
      });
    }

    const hasInvalidQuantity = payload.items.some(
      (item) => !Number.isInteger(item.quantity) || item.quantity < 1,
    );
    if (hasInvalidQuantity) {
      return res.status(422).json({
        message: "Each order item quantity must be at least 1",
      });
    }

    try {
      const createdOrder = await storage.createOrder({
        dealerId: payload.dealerId,
        createdByUserId,
        comment: payload.comment,
        items: payload.items,
      });
      return res.status(201).json(createdOrder);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.status).json({ message: error.message });
      }

      return res.status(500).json({ message: "Failed to create order" });
    }
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
