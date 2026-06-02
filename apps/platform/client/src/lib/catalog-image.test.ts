import { describe, expect, it } from "vitest";
import { optimizedImage } from "./catalog-image";

describe("optimizedImage", () => {
  const blob =
    "https://ospv42n5b4su63ca.public.blob.vercel-storage.com/catalog/abc.jpg";

  it("wraps https blob URLs in Vercel image optimizer", () => {
    const out = optimizedImage(blob, 320, 70);
    expect(out).toMatch(/^\/_vercel\/image\?url=/);
    expect(out).toContain("w=320");
    expect(out).toContain("q=70");
    expect(out).toContain(encodeURIComponent(blob));
  });

  it("returns null for empty input", () => {
    expect(optimizedImage(null, 160)).toBeNull();
    expect(optimizedImage(undefined, 160)).toBeNull();
    expect(optimizedImage("", 160)).toBeNull();
  });

  it("leaves relative and data URLs unchanged", () => {
    expect(optimizedImage("/assets/foo.png", 160)).toBe("/assets/foo.png");
    expect(optimizedImage("data:image/png;base64,abc", 160)).toBe("data:image/png;base64,abc");
  });
});
