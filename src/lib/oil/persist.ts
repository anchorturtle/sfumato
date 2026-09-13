import { BRUSH_IDS, type BrushShape } from "./brushes";
import type { MaskMode, OilSnapshot, OilTool, StencilForm } from "./engine";
import { isGroundId, isPresetId, type GroundId, type PresetId } from "./surfaces";

const DB_NAME = "sfumato";
const STORE = "paint";
const KEY = "current";
const MIX_KEY = "mixboard";
const HISTORY_KEY = "history";
const SETTINGS_KEY = "sfumato:settings:v5";
const MIX_GROUND_KEY = "sfumato:mix-ground:v1";
const SAVE_VERSION = 5;

export type StudioSettings = {
  version: number;
  tool: OilTool;
  pigmentId: string;
  color: [number, number, number];
  size: number;
  flow: number;
  smear: number;
  wetness: number;
  drift: number;
  body: number;
  steady: number;
  magic: boolean;
  brush: BrushShape;
  maskMode: MaskMode;
  stencil: StencilForm;
  ground: GroundId;
  presetId: PresetId;
};

export const DEFAULT_SETTINGS: StudioSettings = {
  version: SAVE_VERSION,
  tool: "oil",
  pigmentId: "cr",
  color: [196, 58, 42],
  size: 48,
  flow: 1,
  smear: 1,
  wetness: 1,
  drift: 0.06,
  body: 0.62,
  steady: 1,
  magic: true,
  brush: "round",
  maskMode: "off",
  stencil: "free",
  ground: "linen",
  presetId: "studio",
};

const TOOLS: OilTool[] = [
  "oil",
  "glaze",
  "impasto",
  "dry",
  "smudge",
  "soften",
  "knife",
  "scrape",
  "lift",
  "fill",
  "sample",
  "stencil",
  "blend",
  "swirl",
];

export function loadSettings(): StudioSettings {
  try {
    const raw =
      localStorage.getItem(SETTINGS_KEY) ??
      localStorage.getItem("sfumato:settings:v4") ??
      localStorage.getItem("sfumato:settings:v3") ??
      localStorage.getItem("sfumato:settings:v2") ??
      localStorage.getItem("sfumato:settings:v1");
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    const next = { ...DEFAULT_SETTINGS, ...parsed, version: SAVE_VERSION };
    if (!TOOLS.includes(next.tool)) next.tool = DEFAULT_SETTINGS.tool;
    if (!BRUSH_IDS.includes(next.brush)) next.brush = DEFAULT_SETTINGS.brush;
    if (next.maskMode !== "off" && next.maskMode !== "inside" && next.maskMode !== "outside") {
      next.maskMode = "off";
    }
    if (next.stencil !== "free" && next.stencil !== "circle" && next.stencil !== "oval" && next.stencil !== "rect") {
      next.stencil = "free";
    }
    if (!Array.isArray(next.color) || next.color.length !== 3) next.color = DEFAULT_SETTINGS.color;
    else {
      next.color = [
        Math.max(0, Math.min(255, Math.round(Number(next.color[0]) || 0))),
        Math.max(0, Math.min(255, Math.round(Number(next.color[1]) || 0))),
        Math.max(0, Math.min(255, Math.round(Number(next.color[2]) || 0))),
      ];
    }
    if (!isGroundId(next.ground)) next.ground = DEFAULT_SETTINGS.ground;
    if (!isPresetId(next.presetId)) next.presetId = DEFAULT_SETTINGS.presetId;
    next.steady = clamp01(next.steady ?? DEFAULT_SETTINGS.steady);
    next.flow = clamp01(next.flow);
    next.smear = clamp01(next.smear);
    next.wetness = clamp01(next.wetness);
    next.body = clamp01(next.body);
    next.size = Math.max(2, Math.min(520, next.size || DEFAULT_SETTINGS.size));
    if ((parsed.version ?? 0) < 5) {
      next.flow = DEFAULT_SETTINGS.flow;
      next.smear = DEFAULT_SETTINGS.smear;
      next.wetness = DEFAULT_SETTINGS.wetness;
      next.steady = DEFAULT_SETTINGS.steady;
      next.drift = DEFAULT_SETTINGS.drift;
    }
    return next;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function clamp01(n: number) {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

export function saveSettings(s: StudioSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, version: SAVE_VERSION }));
  } catch {
    /* quota / private mode */
  }
}

export function loadMixGround(): GroundId {
  try {
    const v = localStorage.getItem(MIX_GROUND_KEY);
    if (isGroundId(v)) return v;
  } catch {
    /* private mode */
  }
  return "glass";
}

export function saveMixGround(id: GroundId) {
  try {
    localStorage.setItem(MIX_GROUND_KEY, id);
  } catch {
    /* quota / private mode */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function sliceBuf(a: Uint8Array | Uint8ClampedArray) {
  return a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength);
}

export async function savePainting(snap: OilSnapshot) {
  const db = await openDb();
  try {
    const payload = {
      version: SAVE_VERSION,
      width: snap.width,
      height: snap.height,
      rgba: sliceBuf(snap.rgba),
      wet: sliceBuf(snap.wet),
      thick: sliceBuf(snap.thick),
      mask: sliceBuf(snap.mask),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(payload, KEY);
    });
  } finally {
    db.close();
  }
}

export async function saveMixBoard(snap: OilSnapshot) {
  const db = await openDb();
  try {
    const payload = {
      version: SAVE_VERSION,
      width: snap.width,
      height: snap.height,
      rgba: sliceBuf(snap.rgba),
      wet: sliceBuf(snap.wet),
      thick: sliceBuf(snap.thick),
      mask: sliceBuf(snap.mask),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(payload, MIX_KEY);
    });
  } finally {
    db.close();
  }
}

function snapFromRow(row: unknown): OilSnapshot | null {
  if (!row || typeof row !== "object") return null;
  const r = row as {
    width?: number;
    height?: number;
    rgba?: ArrayBuffer;
    wet?: ArrayBuffer;
    thick?: ArrayBuffer;
    mask?: ArrayBuffer;
  };
  if (!r.width || !r.height || !r.rgba || !r.wet) return null;
  const n = r.width * r.height;
  if (r.rgba.byteLength !== n * 4) return null;
  if (r.wet.byteLength !== n) return null;
  return {
    width: r.width,
    height: r.height,
    rgba: new Uint8ClampedArray(r.rgba.slice(0)),
    wet: new Uint8Array(r.wet.slice(0)),
    thick: r.thick && r.thick.byteLength === n ? new Uint8Array(r.thick.slice(0)) : new Uint8Array(n),
    mask: r.mask && r.mask.byteLength === n ? new Uint8Array(r.mask.slice(0)) : new Uint8Array(n),
  };
}

export async function clearPainting() {
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE).delete(KEY);
      });
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}

export async function clearMixBoard() {
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE).delete(MIX_KEY);
      });
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}

export async function loadPainting(): Promise<OilSnapshot | null> {
  try {
    const db = await openDb();
    try {
      const row = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return snapFromRow(row);
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function loadMixBoard(): Promise<OilSnapshot | null> {
  try {
    const db = await openDb();
    try {
      const row = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(MIX_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return snapFromRow(row);
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

type PackedSnap = {
  w: number;
  h: number;
  png: Blob;
  thick?: ArrayBuffer;
};

type PackedHistory = {
  version: number;
  undo: PackedSnap[];
  redo: PackedSnap[];
};

function hasSignal(a: Uint8Array) {
  for (let i = 0; i < a.length; i += 17) {
    if ((a[i] ?? 0) > 6) return true;
  }
  return false;
}

async function packSnap(snap: OilSnapshot): Promise<PackedSnap> {
  const canvas = document.createElement("canvas");
  canvas.width = snap.width;
  canvas.height = snap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("pack");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(snap.rgba), snap.width, snap.height), 0, 0);
  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png");
  });
  const packed: PackedSnap = { w: snap.width, h: snap.height, png };
  if (hasSignal(snap.thick)) packed.thick = snap.thick.slice().buffer as ArrayBuffer;
  return packed;
}

async function unpackSnap(p: PackedSnap): Promise<OilSnapshot | null> {
  if (!p?.png || !p.w || !p.h) return null;
  const url = URL.createObjectURL(p.png);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = p.w;
    canvas.height = p.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const rgba = ctx.getImageData(0, 0, p.w, p.h).data;
    const n = p.w * p.h;
    return {
      width: p.w,
      height: p.h,
      rgba,
      wet: new Uint8Array(n),
      thick: p.thick && p.thick.byteLength === n ? new Uint8Array(p.thick.slice(0)) : new Uint8Array(n),
      mask: new Uint8Array(n),
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

let historyBusy = false;

export async function saveHistory(history: { undo: OilSnapshot[]; redo: OilSnapshot[] }) {
  if (historyBusy) return;
  historyBusy = true;
  const db = await openDb();
  try {
    const undo: PackedSnap[] = [];
    for (const snap of history.undo.slice(-4)) undo.push(await packSnap(snap));
    const redo: PackedSnap[] = [];
    for (const snap of history.redo.slice(-3)) redo.push(await packSnap(snap));
    const payload: PackedHistory = { version: SAVE_VERSION, undo, redo };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(payload, HISTORY_KEY);
    });
  } finally {
    db.close();
    historyBusy = false;
  }
}

export async function loadHistory(): Promise<{ undo: OilSnapshot[]; redo: OilSnapshot[] } | null> {
  try {
    const db = await openDb();
    try {
      const row = await new Promise<PackedHistory | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(HISTORY_KEY);
        req.onsuccess = () => resolve(req.result as PackedHistory | undefined);
        req.onerror = () => reject(req.error);
      });
      if (!row?.undo) return null;
      const undo: OilSnapshot[] = [];
      for (const p of row.undo) {
        const snap = await unpackSnap(p);
        if (snap) undo.push(snap);
      }
      const redo: OilSnapshot[] = [];
      for (const p of row.redo ?? []) {
        const snap = await unpackSnap(p);
        if (snap) redo.push(snap);
      }
      return { undo, redo };
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}
