import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bitrix24OauthVercelHandler } from "../../../server/bitrix24-vercel-oauth-entry";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await bitrix24OauthVercelHandler(req, res);
}
