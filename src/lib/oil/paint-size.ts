export function paintSize() {
  if (typeof window === "undefined") return { w: 2400, h: 1800 };
  const touch =
    (navigator.maxTouchPoints > 1 && /iPad|iPhone|Macintosh/.test(navigator.userAgent)) ||
    window.matchMedia("(pointer: coarse)").matches;
  return touch ? { w: 1600, h: 1200 } : { w: 2400, h: 1800 };
}
