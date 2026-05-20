import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bitrix24ChatVercelHandler } from "../../../server/bitrix24-vercel-chat-entry";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await bitrix24ChatVercelHandler(req, res);
}
