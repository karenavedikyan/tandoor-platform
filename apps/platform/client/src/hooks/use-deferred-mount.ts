import { useEffect, useState } from "react";

/** true через один rAF-кадр после того, как условие стало true. */
export function useDeferredMount(active: boolean, delayFrames = 1): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    let cancelled = false;
    let framesLeft = delayFrames;
    const tick = () => {
      if (cancelled) return;
      framesLeft -= 1;
      if (framesLeft <= 0) {
        setReady(true);
        return;
      }
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [active, delayFrames]);
  return ready;
}
