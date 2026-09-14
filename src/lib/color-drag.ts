export type ColorDragDetail = {
  hex: string;
  x: number;
  y: number;
  phase: "drop" | "end";
};

const GHOST_ID = "sfumato-color-ghost";
const HOLD_MS = 180;
const SCROLL_SLOP = 12;
const DRAG_SLOP = 7;

let session: {
  id: number;
  hex: string;
  x0: number;
  y0: number;
  held: boolean;
  dragged: boolean;
  coarse: boolean;
  timer: number;
  onTap?: () => void;
} | null = null;

function ghostEl() {
  return document.getElementById(GHOST_ID) as HTMLDivElement | null;
}

function isCoarse() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function clearTimer() {
  if (session?.timer) {
    window.clearTimeout(session.timer);
    session.timer = 0;
  }
}

function unbind() {
  window.removeEventListener("pointermove", onMove, true);
  window.removeEventListener("pointerup", onLost, true);
  window.removeEventListener("pointercancel", onLost, true);
  window.removeEventListener("blur", onLost);
}

function abort() {
  clearTimer();
  unbind();
  session = null;
  clearColorGhost();
}

function onLost(ev?: Event) {
  if (ev instanceof PointerEvent && session && ev.pointerId !== session.id) return;
  const s = session;
  clearTimer();
  unbind();
  session = null;
  const cancelled = !ev || ev.type === "pointercancel" || ev.type === "blur";
  if (s?.dragged && !cancelled && ev instanceof PointerEvent) {
    emitColorDrop(s.hex, ev.clientX, ev.clientY);
    return;
  }
  clearColorGhost();
  if (s && !s.dragged && !cancelled && ev instanceof PointerEvent) {
    const dist = Math.hypot(ev.clientX - s.x0, ev.clientY - s.y0);
    if (dist < 16) s.onTap?.();
  }
}

function onMove(ev: PointerEvent) {
  const s = session;
  if (!s || ev.pointerId !== s.id) return;
  const dx = ev.clientX - s.x0;
  const dy = ev.clientY - s.y0;
  const dist = Math.hypot(dx, dy);

  if (s.dragged) {
    ev.preventDefault();
    moveColorGhost(s.hex, ev.clientX, ev.clientY);
    return;
  }

  if (!s.held) {
    if (dist > SCROLL_SLOP) abort();
    return;
  }

  if (dist < DRAG_SLOP) return;
  s.dragged = true;
  s.onTap?.();
  ev.preventDefault();
  moveColorGhost(s.hex, ev.clientX, ev.clientY);
}

export function startColorDrag(hex: string, pointerId: number, x: number, y: number, onTap?: () => void) {
  if (session) onLost();
  const coarse = isCoarse();
  session = {
    id: pointerId,
    hex,
    x0: x,
    y0: y,
    held: !coarse,
    dragged: false,
    coarse,
    timer: 0,
    onTap,
  };
  window.addEventListener("pointermove", onMove, { capture: true, passive: false });
  window.addEventListener("pointerup", onLost, true);
  window.addEventListener("pointercancel", onLost, true);
  window.addEventListener("blur", onLost);
  if (coarse) {
    session.timer = window.setTimeout(() => {
      if (!session || session.id !== pointerId) return;
      session.held = true;
    }, HOLD_MS);
  }
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
