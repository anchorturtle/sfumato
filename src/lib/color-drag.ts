export type ColorDragDetail = {
  hex: string;
  x: number;
  y: number;
  phase: "drop" | "end";
};

const GHOST_ID = "sfumato-color-ghost";
let session: {
  id: number;
  hex: string;
  x0: number;
  y0: number;
  dragged: boolean;
  onTap?: () => void;
} | null = null;

function ghostEl() {
  return document.getElementById(GHOST_ID) as HTMLDivElement | null;
}

function onLost(ev?: Event) {
  if (ev instanceof PointerEvent && session && ev.pointerId !== session.id) return;
  window.removeEventListener("pointermove", onMove, true);
  window.removeEventListener("pointerup", onLost, true);
  window.removeEventListener("pointercancel", onLost, true);
  window.removeEventListener("blur", onLost);
  const s = session;
  session = null;
  const cancelled = !ev || ev.type === "pointercancel" || ev.type === "blur";
  if (s?.dragged && !cancelled && ev instanceof PointerEvent) {
    emitColorDrop(s.hex, ev.clientX, ev.clientY);
    return;
  }
  clearColorGhost();
  if (s && !s.dragged && ev instanceof PointerEvent) {
    const dist = Math.hypot(ev.clientX - s.x0, ev.clientY - s.y0);
    if (dist < 16) s.onTap?.();
  }
}

function onMove(ev: PointerEvent) {
  const s = session;
  if (!s || ev.pointerId !== s.id) return;
  const dist = Math.hypot(ev.clientX - s.x0, ev.clientY - s.y0);
  if (dist < 14) return;
  s.dragged = true;
  ev.preventDefault();
  moveColorGhost(s.hex, ev.clientX, ev.clientY);
}

export function startColorDrag(hex: string, pointerId: number, x: number, y: number, onTap?: () => void) {
  if (session) onLost();
  session = { id: pointerId, hex, x0: x, y0: y, dragged: false, onTap };
  window.addEventListener("pointermove", onMove, { capture: true, passive: false });
  window.addEventListener("pointerup", onLost, true);
  window.addEventListener("pointercancel", onLost, true);
  window.addEventListener("blur", onLost);
}

export function moveColorGhost(hex: string, x: number, y: number) {
  let el = ghostEl();
  if (!el) {
    el = document.createElement("div");
    el.id = GHOST_ID;
    el.className = "color-drag-ghost";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<span class="pigment-well block size-full rounded-full"></span>';
    document.body.appendChild(el);
  }
  el.style.setProperty("--pigment", hex);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.classList.add("is-color-drag");
}

export function clearColorGhost() {
  ghostEl()?.remove();
  document.body.classList.remove("is-color-drag");
}

export function emitColorDrop(hex: string, x: number, y: number) {
  clearColorGhost();
  window.dispatchEvent(new CustomEvent<ColorDragDetail>("sfumato-drag", { detail: { hex, x, y, phase: "drop" } }));
}

export function emitColorEnd() {
  clearColorGhost();
  window.dispatchEvent(new CustomEvent<ColorDragDetail>("sfumato-drag", { detail: { hex: "", x: 0, y: 0, phase: "end" } }));
}
