import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";

const putMock = vi.fn().mockResolvedValue({ url: "https://blob.example/dump.jsonl.gz" });

vi.mock("@vercel/blob", () => ({
  put: putMock,
}));

type QueryHandler = (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

function makeClient(queryImpl: QueryHandler) {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(queryImpl),
  };
}

let clientInstance: ReturnType<typeof makeClient>;

vi.mock("pg", () => ({
  default: {
    Client: vi.fn(function ClientMock() {
      return clientInstance;
    }),
  },
}));

describe("dumpNeonToBlob", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exports JSONL gzip with rowCounts for mocked tables", async () => {
    const usersRows = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 3, name: "c" },
    ];
    const sessionsRows = [
      { id: "s1" },
      { id: "s2" },
      { id: "s3" },
    ];

    let activeTable: string | null = null;
    clientInstance = makeClient(async (text: string) => {
      if (text.includes("pg_tables")) {
        return { rows: [{ tablename: "users" }, { tablename: "sessions" }] };
      }
      if (text === "BEGIN READ ONLY") return { rows: [] };
      if (text === "ROLLBACK") return { rows: [] };
      if (text.includes("DECLARE") && text.includes("users")) {
        activeTable = "users";
        return { rows: [] };
      }
      if (text.includes("DECLARE") && text.includes("sessions")) {
        activeTable = "sessions";
        return { rows: [] };
      }
      if (text.includes("CLOSE")) return { rows: [] };
      if (text.includes("FETCH")) {
        if (activeTable === "users") {
          activeTable = null;
          return { rows: usersRows };
        }
        if (activeTable === "sessions") {
          activeTable = null;
          return { rows: sessionsRows };
        }
        return { rows: [] };
      }
      return { rows: [] };
    });

    const { dumpNeonToBlob } = await import("../dump-neon.js");
    const result = await dumpNeonToBlob({
      sourceUrl: "postgres://test/db",
      blobToken: "blob-token",
      filenamePrefix: "test-dump",
    });

    expect(result.ok).toBe(true);
    expect(result.rowCounts).toEqual({ users: 3, sessions: 3 });
    expect(putMock).toHaveBeenCalledTimes(1);

    const putBody = putMock.mock.calls[0]![1] as Buffer;
    const jsonl = gunzipSync(putBody).toString("utf8");
    const lines = jsonl.trim().split("\n");
    expect(lines).toHaveLength(6);
    for (const line of lines) {
      const parsed = JSON.parse(line) as { table: string; row: Record<string, unknown> };
      expect(parsed.table === "users" || parsed.table === "sessions").toBe(true);
      expect(parsed.row).toBeTruthy();
    }
  });
});
