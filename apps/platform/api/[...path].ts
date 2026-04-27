import { routeApiRequest } from "../server/api-handlers";

type VercelRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (data: unknown) => void;
  end: (data?: string) => void;
};

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body === undefined || req.body === null) {
    return undefined;
  }
  if (typeof req.body === "string") {
    if (req.body.length === 0) return undefined;
    try {
      return JSON.parse(req.body);
    } catch {
      return undefined;
    }
  }
  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString("utf8");
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }
  return req.body;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const method = req.method ?? "GET";
  const rawUrl = req.url ?? "/";
  // req.url is the path after the function mount point. On Vercel with
  // api/[...path].ts and the rewrite in vercel.json, the original /api/...
  // path is preserved on req.url. Strip query string.
  const pathname = rawUrl.split("?")[0] ?? "/";

  const body = method === "POST" || method === "PUT" || method === "PATCH"
    ? await readJsonBody(req)
    : undefined;

  try {
    const result = await routeApiRequest(method, pathname, body);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(result.status).json(result.body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(500).json({ message });
  }
}
