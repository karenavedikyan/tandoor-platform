const DEFAULT_BASE = "/api/showcase-matrix";

let currentBase = DEFAULT_BASE;

export function setShowcaseMatrixApiBase(base: string): void {
  currentBase = base.replace(/\/$/, "") || DEFAULT_BASE;
}

export function getShowcaseMatrixApiBase(): string {
  return currentBase;
}

export function resetShowcaseMatrixApiBase(): void {
  currentBase = DEFAULT_BASE;
}

export function isOneCShowcaseMatrixApiBase(): boolean {
  return currentBase.startsWith("/api/one-c/showcase-matrix");
}
