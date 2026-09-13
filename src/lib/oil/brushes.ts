export type BrushShape =
  | "round"
  | "filbert"
  | "flat"
  | "bright"
  | "fan"
  | "rigger"
  | "bristle"
  | "mop"
  | "stipple";

export const BRUSHES: { id: BrushShape; label: string; hint: string }[] = [
  { id: "round", label: "Round", hint: "Soft round hog" },
  { id: "filbert", label: "Filbert", hint: "Oval, blended edge" },
  { id: "flat", label: "Flat", hint: "Long chisel" },
  { id: "bright", label: "Bright", hint: "Short square" },
  { id: "fan", label: "Fan", hint: "Separated hairs" },
  { id: "rigger", label: "Rigger", hint: "Long liner" },
  { id: "bristle", label: "Bristle", hint: "Broken tooth" },
  { id: "mop", label: "Mop", hint: "Soft wash" },
  { id: "stipple", label: "Stipple", hint: "Dotted pounce" },
];

export const BRUSH_IDS: BrushShape[] = BRUSHES.map((b) => b.id);

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function brushScale(shape: BrushShape): { ax: number; ay: number; size: number } {
  switch (shape) {
    case "filbert":
      return { ax: 1.42, ay: 0.82, size: 1 };
    case "flat":
      return { ax: 1.85, ay: 0.48, size: 1.05 };
    case "bright":
      return { ax: 1.28, ay: 0.78, size: 0.98 };
    case "fan":
      return { ax: 1.12, ay: 1.35, size: 1.15 };
    case "rigger":
      return { ax: 2.4, ay: 0.46, size: 1 };
    case "bristle":
      return { ax: 1.1, ay: 0.98, size: 1 };
    case "mop":
      return { ax: 1, ay: 1, size: 1.28 };
    case "stipple":
      return { ax: 1.05, ay: 1.05, size: 1.1 };
    default:
      return { ax: 1.08, ay: 1, size: 1 };
  }
}

/** Height modulation across the stroke — hair tracks and edge beads. */
export function hairGroove(v: number, ry: number, shape: BrushShape): number {
  const nv = v / Math.max(ry, 0.001);
  switch (shape) {
    case "bristle":
      return 0.48 + 0.52 * (0.5 + 0.5 * Math.sin(nv * 16));
    case "fan":
      return 0.32 + 0.68 * Math.abs(Math.sin(nv * 9.2));
    case "flat":
      return 0.62 + 0.38 * Math.min(1, Math.abs(nv));
    case "bright":
      return 0.7 + 0.3 * Math.abs(nv);
    case "rigger":
      return 0.88 + 0.12 * Math.abs(nv);
    case "stipple":
      return 0.4 + 0.6 * Math.abs(Math.sin(nv * 18));
    case "mop":
      return 0.92;
    case "filbert":
      return 0.78 + 0.22 * (1 - nv * nv);
    default:
      return 0.7 + 0.3 * (1 - nv * nv);
  }
}

/** 0–1 coverage for a pixel in stroke space (u along, v across). */
export function stampWeight(
  u: number,
  v: number,
  rx: number,
  ry: number,
  shape: BrushShape,
  px: number,
  py: number,
): number {
  const eu = u / Math.max(rx, 0.5);
  const ev = v / Math.max(ry, 0.5);
  switch (shape) {
    case "flat": {
      const au = Math.abs(eu);
      const av = Math.abs(ev);
      if (au > 1 || av > 1) return 0;
      const end = au > 0.62 ? (1 - au) / 0.38 : 1;
      const edge = 1 - av * av;
      return Math.max(0, end * edge);
    }
    case "bright": {
      const au = Math.abs(eu);
      const av = Math.abs(ev);
      if (au > 1 || av > 1) return 0;
      const end = au > 0.72 ? (1 - au) / 0.28 : 1;
      return Math.max(0, end * (1 - av * av * av));
    }
    case "rigger": {
      const e = eu * eu + ev * ev * 2.6;
      if (e >= 1) return 0;
      const s = 1 - e;
      return s * s;
    }
    case "fan": {
      let m = 0;
      for (let i = -2; i <= 2; i++) {
        const vv = ev - i * 0.32;
        const e = eu * eu * 1.4 + vv * vv * 7.5;
        if (e >= 1) continue;
        const s = 1 - e;
        m = Math.max(m, s * s * (1 - Math.abs(i) * 0.08));
      }
      return m;
    }
    case "bristle": {
      const e = eu * eu + ev * ev;
      if (e >= 1) return 0;
      if (hash2(px * 0.19, Math.floor(v * 0.42) + py * 0.01) < 0.08) return 0;
      const hair = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(v * 1.7 + hash2(px, py) * 6));
      const s = 1 - e;
      return s * s * hair;
    }
    case "stipple": {
      const e = eu * eu + ev * ev;
      if (e >= 1) return 0;
      const cell = hash2(Math.floor(px * 0.22), Math.floor(py * 0.22));
      if (cell < 0.22) return 0;
      const s = 1 - e;
      return s * s * (0.45 + 0.55 * cell);
    }
    case "mop": {
      const e = eu * eu + ev * ev;
      if (e >= 1) return 0;
      const s = 1 - e;
      return s * s * s;
    }
    case "filbert": {
      const e = eu * eu + ev * ev;
      if (e >= 1) return 0;
      const s = 1 - e;
      return s * s * (0.82 + 0.18 * s);
    }
    default: {
      const e = eu * eu + ev * ev;
      if (e >= 1) return 0;
      const s = 1 - e;
      return s * s;
    }
  }
}
