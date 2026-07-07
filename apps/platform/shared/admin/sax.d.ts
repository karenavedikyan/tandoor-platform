declare module "sax" {
  import type { Readable } from "node:stream";

  export interface SaxTag {
    name: string;
    attributes: Record<string, string>;
  }

  export interface SaxStream extends Readable {
    on(event: "opentag", listener: (node: SaxTag) => void): this;
    on(event: "closetag", listener: (tagName: string) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "end", listener: () => void): this;
    write(chunk: string): void;
    end(): void;
  }

  export function createStream(strict: boolean, opts?: { trim?: boolean; normalize?: boolean }): SaxStream;

  const sax: { createStream: typeof createStream };
  export default sax;
}
