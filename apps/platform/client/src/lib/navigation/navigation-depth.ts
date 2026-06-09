/**
 * Счётчик внутренней глубины навигации SPA (для useSmartBack).
 * Инкремент при push-переходах, декремент при popstate, без инкремента при replace.
 */

let internalDepth = 0;
let lastPath = "";
let pendingPop = false;
let skipNextIncrement = false;

export function getInternalNavDepth(): number {
  return internalDepth;
}

export function onPopState(): void {
  pendingPop = true;
  internalDepth = Math.max(0, internalDepth - 1);
}

export function markNextNavigationAsReplace(): void {
  skipNextIncrement = true;
}

export function onLocationChange(newPath: string, isInitial = false): void {
  const normalized = newPath.split("?")[0]?.split("#")[0] ?? "/";

  if (isInitial) {
    lastPath = normalized;
    internalDepth = 0;
    return;
  }

  if (pendingPop) {
    pendingPop = false;
    lastPath = normalized;
    return;
  }

  if (skipNextIncrement) {
    skipNextIncrement = false;
    lastPath = normalized;
    return;
  }

  if (normalized !== lastPath) {
    internalDepth += 1;
    lastPath = normalized;
  }
}
