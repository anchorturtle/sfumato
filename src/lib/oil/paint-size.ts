export function paintSize() {
  if (typeof window === "undefined") return { w: 1600, h: 1200 };
  const touch =
    (navigator.maxTouchPoints > 1 && /iPad|iPhone|Macintosh/.test(navigator.userAgent)) ||
    window.matchMedia("(pointer: coarse)").matches;
  return touch ? { w: 1280, h: 960 } : { w: 1600, h: 1200 };
}
