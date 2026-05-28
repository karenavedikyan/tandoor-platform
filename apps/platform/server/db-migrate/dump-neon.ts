/**
 * Одноразовый дамп Neon PostgreSQL → JSONL.gz в Vercel Blob (миграция на Yandex).
 */

import { Readable } from "node:stream";
import { createGzip } from "node:zlib";
import pg from "pg";
import { put } from "@vercel/blob";

export type DumpResult = {
  ok: true;
  blobUrl: string;
  filename: string;
  sizeBytes: number;
  rowCounts: Record<string, number>;
  durationMs: number;
};

function resolveSsl(): pg.ClientConfig["ssl"] {
  const ca = process.env.PG_SSL_ROOT_CERT?.trim();
  if (ca) {
    return { ca, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function cursorNameForTable(table: string): string {
  return `dump_cur_${table.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

async function listPublicTables(client: pg.Client): Promise<string[]> {
  const res = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  return res.rows.map((r) => r.tablename);
}

export async function dumpNeonToBlob(opts: {
  sourceUrl: string;
  blobToken: string;
  filenamePrefix?: string;
}): Promise<DumpResult> {
  const started = Date.now();
  const rowCounts: Record<string, number> = {};
  const filename = `${opts.filenamePrefix ?? "tandoor-neon-dump"}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl.gz`;

  const client = new pg.Client({
    connectionString: opts.sourceUrl,
    ssl: resolveSsl(),
  });

  const gzip = createGzip();
  const chunks: Buffer[] = [];
  gzip.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  const gzipDone = new Promise<void>((resolve, reject) => {
    gzip.on("end", () => resolve());
    gzip.on("error", reject);
  });

  let tablesProcessed = 0;
  let totalRows = 0;

  try {
    await client.connect();
    const tables = await listPublicTables(client);

    const lineStream = Readable.from(async function* () {
      for (const table of tables) {
        const cur = cursorNameForTable(table);
        const qTable = quoteIdent(table);
        const qCur = quoteIdent(cur);
        await client.query("BEGIN READ ONLY");
        try {
          await client.query(`DECLARE ${qCur} NO SCROLL CURSOR FOR SELECT * FROM ${qTable}`);
          let tableRows = 0;
          while (true) {
            const batch = await client.query(`FETCH FORWARD 1000 FROM ${qCur}`);
            if (batch.rows.length === 0) break;
            for (const row of batch.rows) {
              tableRows += 1;
              totalRows += 1;
              if (totalRows % 10000 === 0) {
                console.log(`[dump-neon] rows exported: ${totalRows}`);
              }
              yield `${JSON.stringify({ table, row })}\n`;
            }
          }
          await client.query(`CLOSE ${qCur}`);
          rowCounts[table] = tableRows;
        } finally {
          await client.query("ROLLBACK");
        }
        tablesProcessed += 1;
        if (tablesProcessed % 10 === 0) {
          console.log(`[dump-neon] tables processed: ${tablesProcessed}/${tables.length}`);
        }
      }
    }());

    lineStream.on("error", (err) => {
      gzip.destroy(err);
    });

    lineStream.pipe(gzip);

    await gzipDone;

    const body = Buffer.concat(chunks);
    const putResult = await put(filename, body, {
      access: "public",
      token: opts.blobToken,
      addRandomSuffix: false,
      contentType: "application/gzip",
    });

    return {
      ok: true,
      blobUrl: putResult.url,
      filename,
      sizeBytes: body.length,
      rowCounts,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    gzip.destroy();
    throw err;
  } finally {
    await client.end().catch(() => undefined);
  }
}
