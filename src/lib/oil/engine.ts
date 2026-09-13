import { linToByte, rotateHueLin, SRGB_TO_LINEAR } from "./color";
import { brushScale, hairGroove, stampWeight, type BrushShape } from "./brushes";
import { groundOf, type GroundId } from "./surfaces";

export type OilTool =
  | "oil"
  | "glaze"
  | "impasto"
  | "dry"
  | "smudge"
  | "soften"
  | "knife"
  | "scrape"
  | "lift"
  | "fill"
  | "sample"
  | "stencil"
  | "blend"
  | "swirl";

export type MaskMode = "off" | "inside" | "outside";
export type StencilForm = "free" | "circle" | "oval" | "rect";

export type OilParams = {
  tool: OilTool;
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
  eraseMask: boolean;
};

export type OilSnapshot = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  wet: Uint8Array;
  thick: Uint8Array;
  mask: Uint8Array;
};

export type Marquee = { x0: number; y0: number; x1: number; y1: number; form: StencilForm };

const TILE = 16;
const UNDO_LIMIT = 24;

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class OilEngine {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  wet: Uint8Array;
  thick: Uint8Array;
  mask: Uint8Array;
  display: ImageData;

  params: OilParams = {
    tool: "oil",
    color: [196, 58, 42],
    size: 32,
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
    eraseMask: false,
  };

  reducedMotion = false;
  onChange: (() => void) | null = null;
  surface: GroundId;


  private linen: Float32Array;
  private groundRgb: Uint8ClampedArray;
  private tileWet: Uint16Array;
  private tilesX: number;
  private tilesY: number;
  private dirty = { x0: 0, y0: 0, x1: 0, y1: 0, all: true };
  private stroking = false;
  private lastX = 0;
  private lastY = 0;
  private lastP = 0.7;
  private smoothX = 0;
  private smoothY = 0;
  private targetX = 0;
  private targetY = 0;
  private targetP = 0.7;
  private headingX = 1;
  private headingY = 0;
  private strokeDist = 0;
  private brushR = 0;
  private brushG = 0;
  private brushB = 0;
  private lastSpeed = 0;
  private inputKind: "pen" | "touch" | "mouse" = "mouse";
  private pickupN = 0;
  private sR = 0;
  private sG = 0;
  private sB = 0;
  private sA = 0;
  private sWet = 0;
  private sTh = 0;
  private undo: OilSnapshot[] = [];
  private redo: OilSnapshot[] = [];
  private undoLimit: number;
  private time = 0;
  private hasWet = false;
  private checker = 0;
  private dryAcc = 0;
  private strokeStart: OilSnapshot | null = null;
  private painted = false;
  private hasMask = false;
  private marqueeBox: Marquee | null = null;

  constructor(width: number, height: number, surface: GroundId = "linen", undoLimit = UNDO_LIMIT) {
    this.width = width;
    this.height = height;
    this.surface = surface;
    this.undoLimit = Math.max(8, undoLimit);
    const n = width * height;
    this.rgba = new Uint8ClampedArray(n * 4);
    this.wet = new Uint8Array(n);
    this.thick = new Uint8Array(n);
    this.mask = new Uint8Array(n);
    this.display = new ImageData(width, height);
    this.linen = new Float32Array(n);
    this.groundRgb = new Uint8ClampedArray(n * 3);
    this.tilesX = Math.ceil(width / TILE);
    this.tilesY = Math.ceil(height / TILE);
    this.tileWet = new Uint16Array(this.tilesX * this.tilesY);
    this.buildLinen();
    this.markAllDirty();
    this.composite();
  }

  get canUndo() {
    return this.undo.length > 0;
  }
  get canRedo() {
    return this.redo.length > 0;
  }
  get hasPainted() {
    return this.painted;
  }
  get isStroking() {
    return this.stroking;
  }
  get maskActive() {
    return this.hasMask;
  }
  get marquee(): Marquee | null {
    return this.marqueeBox;
  }

  setParams(partial: Partial<OilParams>) {
    const wasStencil = this.params.tool === "stencil";
    const wasMode = this.params.maskMode;
    Object.assign(this.params, partial);
    if (wasStencil !== (this.params.tool === "stencil") || wasMode !== this.params.maskMode) {
      this.markAllDirty();
    }
  }

  setSurface(id: GroundId) {
    if (this.surface === id) return;
    this.surface = id;
    this.buildLinen();
    this.markAllDirty();
    this.composite();
    this.emit();
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.cancelStroke(false);
    const oldW = this.width;
    const oldH = this.height;
    const oldRgba = this.rgba;
    const oldWet = this.wet;
    const oldThick = this.thick;
    const oldMask = this.mask;
    const n = width * height;
    this.width = width;
    this.height = height;
    this.rgba = new Uint8ClampedArray(n * 4);
    this.wet = new Uint8Array(n);
    this.thick = new Uint8Array(n);
    this.mask = new Uint8Array(n);
    this.display = new ImageData(width, height);
    this.linen = new Float32Array(n);
    this.groundRgb = new Uint8ClampedArray(n * 3);
    this.tilesX = Math.ceil(width / TILE);
    this.tilesY = Math.ceil(height / TILE);
    this.tileWet = new Uint16Array(this.tilesX * this.tilesY);
    for (let y = 0; y < height; y++) {
      const sy = Math.min(oldH - 1, Math.round((y + 0.5) * (oldH / height) - 0.5));
      for (let x = 0; x < width; x++) {
        const sx = Math.min(oldW - 1, Math.round((x + 0.5) * (oldW / width) - 0.5));
        const si = (sy * oldW + sx) * 4;
        const di = (y * width + x) * 4;
        this.rgba[di] = oldRgba[si]!;
        this.rgba[di + 1] = oldRgba[si + 1]!;
        this.rgba[di + 2] = oldRgba[si + 2]!;
        this.rgba[di + 3] = oldRgba[si + 3]!;
        const sp = sy * oldW + sx;
        const dp = y * width + x;
        this.wet[dp] = oldWet[sp]!;
        this.thick[dp] = oldThick[sp]!;
        this.mask[dp] = oldMask[sp]!;
      }
    }
    this.hasMask = this.mask.some((v) => v > 8);
    this.undo = [];
    this.redo = [];
    this.strokeStart = null;
    this.buildLinen();
    this.markAllDirty();
    this.composite();
    this.emit();
  }

  pointerDown(x: number, y: number, pressure: number, kind?: string) {
    this.cancelStroke(false);
    this.inputKind = kind === "pen" ? "pen" : kind === "touch" ? "touch" : "mouse";
    this.lastSpeed = 0;
    const p = this.normPressure(pressure);
    if (this.params.tool === "sample") {
      this.sampleAt(x, y);
      this.emit();
      return;
    }
    if (this.params.tool === "fill") {
      this.floodFill(x, y);
      return;
    }
    this.strokeStart = this.clonePaint();
    this.redo = [];
    this.stroking = true;
    this.lastX = x;
    this.lastY = y;
    this.lastP = p;
    this.smoothX = x;
    this.smoothY = y;
    this.targetX = x;
    this.targetY = y;
    this.targetP = p;
    this.strokeDist = 0;
    this.pickupN = 0;
    this.primeBrush(x, y);
    if (this.params.tool === "stencil" && this.params.stencil !== "free") {
      this.marqueeBox = { x0: x, y0: y, x1: x, y1: y, form: this.params.stencil };
    } else {
      this.stamp(x, y, p);
    }
    if (this.params.tool !== "stencil") this.painted = true;
    this.emit();
  }

  pointerMove(x: number, y: number, pressure: number, kind?: string) {
    if (!this.stroking) return;
    if (kind === "pen" || kind === "touch" || kind === "mouse") this.inputKind = kind;
    const p = this.normPressure(pressure);
    this.targetX = x;
    this.targetY = y;
    this.targetP = p;
    if (this.marqueeBox) {
      this.marqueeBox.x1 = x;
      this.marqueeBox.y1 = y;
      this.emit();
      return;
    }
    this.advanceStroke(false);
  }

  pointerUp() {
    if (!this.stroking) return;
    if (this.marqueeBox) {
      this.commitMarquee();
      this.marqueeBox = null;
    } else {
      this.advanceStroke(true);
    }
    this.stroking = false;
    if (this.strokeStart) {
      this.undo.push(this.strokeStart);
      if (this.undo.length > this.undoLimit) this.undo.shift();
      this.strokeStart = null;
    }
    this.emit();
  }

  /** Squeeze a wet dollop of color at a point (mixer drop). */
  dropDollop(x: number, y: number, rgb?: [number, number, number], radius?: number) {
    this.cancelStroke(false);
    const snap = this.clonePaint();
    this.redo = [];
    const saved = { ...this.params };
    const color = rgb ?? this.params.color;
    const size = radius ?? Math.max(36, this.params.size * 1.45);
    Object.assign(this.params, {
      tool: "oil",
      color,
      size,
      flow: 0.97,
      smear: 0.16,
      wetness: 0.94,
      drift: 0,
      body: 0.92,
      brush: "mop",
      eraseMask: false,
    });
    this.primeBrush(x, y);
    this.stamp(x, y, 1);
    this.stamp(x + size * 0.1, y - size * 0.05, 0.74);
    this.stamp(x - size * 0.07, y + size * 0.06, 0.58);
    Object.assign(this.params, saved);
    this.painted = true;
    this.undo.push(snap);
    if (this.undo.length > this.undoLimit) this.undo.shift();
    this.emit();
  }

  /** Cover the whole gated canvas with a color. Palette drop fills the page. */
  fillCanvas(rgb?: [number, number, number]) {
    this.cancelStroke(false);
    const snap = this.clonePaint();
    this.redo = [];
    const [nr, ng, nb] = rgb ?? this.params.color;
    this.params.color = [nr, ng, nb];
    const n = this.width * this.height;
    const rgba = this.rgba;
    const wetAdd = Math.round(70 + this.params.wetness * 50);
    const thickAdd = Math.round(10 + this.params.body * 22);
    for (let p = 0; p < n; p++) {
      if (!this.gated(p)) continue;
      const i = p * 4;
      rgba[i] = nr;
      rgba[i + 1] = ng;
      rgba[i + 2] = nb;
      rgba[i + 3] = 255;
      const wet = this.wet[p]!;
      this.wet[p] = wet + Math.round((255 - wet) * (wetAdd / 255));
      const th = this.thick[p]!;
      this.thick[p] = th + Math.round((255 - th) * (thickAdd / 255));
    }
    this.hasWet = true;
    this.painted = true;
    this.markAllDirty();
    this.composite();
    this.undo.push(snap);
    if (this.undo.length > this.undoLimit) this.undo.shift();
    this.emit();
  }

  /** Flood-fill connected paint, or wash the whole surface if the start is bare. */
  floodFill(x: number, y: number, rgb?: [number, number, number], tolerance = 44) {
    this.cancelStroke(false);
    const w = this.width;
    const h = this.height;
    const cx = clamp(x | 0, 0, w - 1);
    const cy = clamp(y | 0, 0, h - 1);
    const start = cy * w + cx;
    if (!this.gated(start)) return;
    const snap = this.clonePaint();
    this.redo = [];
    const color = rgb ?? this.params.color;
    const rgba = this.rgba;
    const si = start * 4;
    const sr = rgba[si]!;
    const sg = rgba[si + 1]!;
    const sb = rgba[si + 2]!;
    const sa = rgba[si + 3]!;
    const [nr, ng, nb] = color;
    if (sa < 12) {
      this.wash(nr, ng, nb);
      this.painted = true;
      this.undo.push(snap);
      if (this.undo.length > this.undoLimit) this.undo.shift();
      this.emit();
      return;
    }
    const same = (sr - nr) * (sr - nr) + (sg - ng) * (sg - ng) + (sb - nb) * (sb - nb);
    if (same < 36 && sa > 210) return;

    const tol = tolerance * tolerance;
    const matches = (p: number) => {
      if (!this.gated(p)) return false;
      const i = p * 4;
      const dr = rgba[i]! - sr;
      const dg = rgba[i + 1]! - sg;
      const db = rgba[i + 2]! - sb;
      const da = rgba[i + 3]! - sa;
      return dr * dr + dg * dg + db * db + da * da * 0.4 < tol;
    };

    const seen = new Uint8Array(w * h);
    const stack = [start];
    seen[start] = 1;
    const flow = this.params.flow;
    const cover = 0.62 + flow * 0.34;
    const inv = 1 - cover;
    const wetAdd = Math.round(140 + this.params.wetness * 90);
    const thickAdd = Math.round(16 + this.params.body * 72);
    const br = SRGB_TO_LINEAR[nr]!;
    const bg = SRGB_TO_LINEAR[ng]!;
    const bb = SRGB_TO_LINEAR[nb]!;
    let n = 0;
    const cap = w * h;
    let minX = cx;
    let minY = cy;
    let maxX = cx;
    let maxY = cy;

    while (stack.length) {
      const p = stack.pop()!;
      const i = p * 4;
      const a = rgba[i + 3]! / 255;
      const er = SRGB_TO_LINEAR[rgba[i]!]! * a;
      const eg = SRGB_TO_LINEAR[rgba[i + 1]!]! * a;
      const eb = SRGB_TO_LINEAR[rgba[i + 2]!]! * a;
      const outA = clamp(a + cover * (1 - a), 0, 1);
      const outR = (er * inv + br * cover) / Math.max(0.001, outA);
      const outG = (eg * inv + bg * cover) / Math.max(0.001, outA);
      const outB = (eb * inv + bb * cover) / Math.max(0.001, outA);
      rgba[i] = linToByte(outR);
      rgba[i + 1] = linToByte(outG);
      rgba[i + 2] = linToByte(outB);
      rgba[i + 3] = Math.round(outA * 255);
      const wet = this.wet[p]!;
      this.wet[p] = wet + Math.round((255 - wet) * (wetAdd / 255));
      const th = this.thick[p]!;
      this.thick[p] = th + Math.round((255 - th) * (thickAdd / 255) * 0.45);
      const px = p % w;
      const py = (p / w) | 0;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
      n++;
      if (n > cap) break;
      if (px > 0 && !seen[p - 1] && matches(p - 1)) {
        seen[p - 1] = 1;
        stack.push(p - 1);
      }
      if (px + 1 < w && !seen[p + 1] && matches(p + 1)) {
        seen[p + 1] = 1;
        stack.push(p + 1);
      }
      if (py > 0 && !seen[p - w] && matches(p - w)) {
        seen[p - w] = 1;
        stack.push(p - w);
      }
      if (py + 1 < h && !seen[p + w] && matches(p + w)) {
        seen[p + w] = 1;
        stack.push(p + w);
      }
    }

    this.hasWet = true;
    this.painted = true;
    this.expandDirty(minX, minY, maxX + 1, maxY + 1);
    this.composite();
    this.undo.push(snap);
    if (this.undo.length > this.undoLimit) this.undo.shift();
    this.emit();
  }

  private wash(nr: number, ng: number, nb: number) {
    const w = this.width;
    const h = this.height;
    const n = w * h;
    const rgba = this.rgba;
    const cover = 0.38 + this.params.flow * 0.4;
    const inv = 1 - cover;
    const br = SRGB_TO_LINEAR[nr]!;
    const bg = SRGB_TO_LINEAR[ng]!;
    const bb = SRGB_TO_LINEAR[nb]!;
    const wetAdd = Math.round(90 + this.params.wetness * 70);
    const thickAdd = Math.round(8 + this.params.body * 28);
    for (let p = 0; p < n; p++) {
      if (!this.gated(p)) continue;
      const i = p * 4;
      const a = rgba[i + 3]! / 255;
      const er = SRGB_TO_LINEAR[rgba[i]!]! * a;
      const eg = SRGB_TO_LINEAR[rgba[i + 1]!]! * a;
      const eb = SRGB_TO_LINEAR[rgba[i + 2]!]! * a;
      const outA = clamp(a + cover * (1 - a), 0, 1);
      rgba[i] = linToByte((er * inv + br * cover) / Math.max(0.001, outA));
      rgba[i + 1] = linToByte((eg * inv + bg * cover) / Math.max(0.001, outA));
      rgba[i + 2] = linToByte((eb * inv + bb * cover) / Math.max(0.001, outA));
      rgba[i + 3] = Math.round(outA * 255);
      const wet = this.wet[p]!;
      this.wet[p] = wet + Math.round((255 - wet) * (wetAdd / 255));
      const th = this.thick[p]!;
      this.thick[p] = th + Math.round((255 - th) * (thickAdd / 255));
    }
    this.hasWet = true;
    this.markAllDirty();
    this.composite();
  }

  cancelStroke(commitUndo: boolean) {
    if (!this.stroking) return;
    this.marqueeBox = null;
    this.stroking = false;
    if (this.strokeStart) {
      if (commitUndo) {
        this.undo.push(this.strokeStart);
        if (this.undo.length > this.undoLimit) this.undo.shift();
      } else {
        this.applySnapshot(this.strokeStart);
        this.markAllDirty();
        this.composite();
        this.emit();
      }
      this.strokeStart = null;
    }
  }

  undoStroke() {
    this.cancelStroke(false);
    if (this.undo.length === 0) return;
    const prev = this.undo.pop()!;
    this.redo.push(this.clonePaint());
    this.applySnapshot(prev);
    this.markAllDirty();
    this.composite();
    this.emit();
  }

  redoStroke() {
    this.cancelStroke(false);
    if (this.redo.length === 0) return;
    const next = this.redo.pop()!;
    this.undo.push(this.clonePaint());
    this.applySnapshot(next);
    this.markAllDirty();
    this.composite();
    this.emit();
  }

  clear() {
    this.cancelStroke(false);
    this.undo.push(this.clonePaint());
    if (this.undo.length > this.undoLimit) this.undo.shift();
    this.redo = [];
    this.rgba.fill(0);
    this.wet.fill(0);
    this.thick.fill(0);
    this.tileWet.fill(0);
    this.painted = false;
    this.hasWet = false;
    this.markAllDirty();
    this.composite();
    this.emit();
  }

  clearMask() {
    this.cancelStroke(false);
    this.undo.push(this.clonePaint());
    if (this.undo.length > this.undoLimit) this.undo.shift();
    this.mask.fill(0);
    this.hasMask = false;
    this.markAllDirty();
    this.composite();
    this.emit();
  }

  invertMask() {
    this.cancelStroke(false);
    this.undo.push(this.clonePaint());
    if (this.undo.length > this.undoLimit) this.undo.shift();
    const m = this.mask;
    let any = false;
    for (let i = 0; i < m.length; i++) {
      const v = 255 - m[i]!;
      m[i] = v;
      if (v > 8) any = true;
    }
    this.hasMask = any;
    this.markAllDirty();
    this.composite();
    this.emit();
  }

  fillMask() {
    this.cancelStroke(false);
    if (!this.hasMask) return;
    this.undo.push(this.clonePaint());
    if (this.undo.length > this.undoLimit) this.undo.shift();
    this.redo = [];
    const w = this.width;
    const h = this.height;
    const rgba = this.rgba;
    const thick = this.thick;
    const wet = this.wet;
    const [cr, cg, cb] = this.params.color;
    const br = SRGB_TO_LINEAR[cr]!;
    const bg = SRGB_TO_LINEAR[cg]!;
    const bb = SRGB_TO_LINEAR[cb]!;
    const flow = this.params.flow;
    const body = this.params.body;
    const wetness = this.params.wetness;
    const mask = this.mask;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (mask[p]! <= 12) continue;
        const i = p * 4;
        const destA = rgba[i + 3]! / 255;
        const srcA = clamp(flow * 0.72 * (mask[p]! / 255), 0, 1);
        const outA = srcA + destA * (1 - srcA);
        rgba[i] = linToByte((br * srcA + SRGB_TO_LINEAR[rgba[i]!]! * destA * (1 - srcA)) / Math.max(outA, 1e-5));
        rgba[i + 1] = linToByte((bg * srcA + SRGB_TO_LINEAR[rgba[i + 1]!]! * destA * (1 - srcA)) / Math.max(outA, 1e-5));
        rgba[i + 2] = linToByte((bb * srcA + SRGB_TO_LINEAR[rgba[i + 2]!]! * destA * (1 - srcA)) / Math.max(outA, 1e-5));
        rgba[i + 3] = Math.round(outA * 255);
        thick[p] = clamp((thick[p]! + body * 70 * (1 - thick[p]! / 255 * 0.35)) | 0, 0, 255);
        wet[p] = Math.max(wet[p]!, Math.round(wetness * 180));
        this.noteWet(x, y, wet[p]!);
      }
    }
    this.hasWet = true;
    this.painted = true;
    this.markAllDirty();
    this.composite();
    this.emit();
  }

  tick(dt: number, now: number) {
    this.time = now * 0.001;
    if (this.stroking) return true;
    if (!this.params.magic || !this.hasWet || this.reducedMotion) return false;
    this.dryAcc += dt;
    if (this.dryAcc < 0.045) return true;
    this.diffuse(this.dryAcc);
    this.dryAcc = 0;
    return this.hasWet;
  }

  private blitRect = { x: 0, y: 0, w: 0, h: 0, all: true };

  private blit(ctx: CanvasRenderingContext2D) {
    const b = this.blitRect;
    if (b.all || b.w <= 0 || b.h <= 0) {
      ctx.putImageData(this.display, 0, 0);
      return;
    }
    ctx.putImageData(this.display, 0, 0, b.x, b.y, b.w, b.h);
  }

  drawTo(ctx: CanvasRenderingContext2D) {
    this.blit(ctx);
  }

  present(ctx: CanvasRenderingContext2D, lite = false) {
    if (this.dirty.all || this.dirty.x1 > this.dirty.x0) this.composite(lite || this.stroking);
    this.blit(ctx);
  }

  sampleAt(x: number, y: number): [number, number, number] | null {
    const w = this.width;
    const h = this.height;
    const ix = clamp(x | 0, 0, w - 1);
    const iy = clamp(y | 0, 0, h - 1);
    if (this.dirty.all || this.dirty.x1 > this.dirty.x0) this.composite();
    let r = 0,
      g = 0,
      b = 0,
      mass = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = clamp(ix + dx, 0, w - 1);
        const py = clamp(iy + dy, 0, h - 1);
        const i = (py * w + px) * 4;
        const a = this.rgba[i + 3]! / 255;
        if (a < 0.03) continue;
        const wt = a * (dx === 0 && dy === 0 ? 2 : 1);
        r += this.rgba[i]! * wt;
        g += this.rgba[i + 1]! * wt;
        b += this.rgba[i + 2]! * wt;
        mass += wt;
      }
    }
    let rgb: [number, number, number];
    if (mass > 0.02) {
      rgb = [Math.round(r / mass), Math.round(g / mass), Math.round(b / mass)];
    } else {
      const i = (iy * w + ix) * 4;
      rgb = [this.display.data[i]!, this.display.data[i + 1]!, this.display.data[i + 2]!];
    }
    this.params.color = rgb;
    return rgb;
  }

  toSnapshot(): OilSnapshot {
    return this.clonePaint();
  }

  exportHistory() {
    return {
      undo: this.undo.slice(-4),
      redo: this.redo.slice(-3),
    };
  }

  loadHistory(history: { undo: OilSnapshot[]; redo: OilSnapshot[] }) {
    const fit = (s: OilSnapshot) => s.width === this.width && s.height === this.height;
    this.undo = history.undo.filter(fit).slice(-this.undoLimit);
    this.redo = history.redo.filter(fit).slice(-this.undoLimit);
  }

  loadSnapshot(snap: OilSnapshot) {
    if (snap.width !== this.width || snap.height !== this.height) {
      this.resize(snap.width, snap.height);
    }
    this.rgba.set(snap.rgba);
    this.wet.set(snap.wet);
    if (snap.thick) this.thick.set(snap.thick);
    else this.thick.fill(0);
    if (snap.mask) this.mask.set(snap.mask);
    else this.mask.fill(0);
    this.rebuildTileWet();
    this.scanMask();
    this.painted = true;
    this.markAllDirty();
    this.composite();
    this.emit();
    return true;
  }

  private emit() {
    this.onChange?.();
  }

  private normPressure(p: number) {
    if (this.inputKind === "pen") {
      if (!Number.isFinite(p)) return 0.45;
      return clamp(p, 0.05, 1);
    }
    if (!Number.isFinite(p) || p <= 0.02) return 0.7;
    return clamp(p, 0.1, 1);
  }

  private stampRadius(pressure: number) {
    const { size } = brushScale(this.params.brush);
    const tool = this.params.tool;
    const tscale =
      tool === "knife" || tool === "scrape" ? 1.22 : tool === "impasto" ? 1.12 : tool === "soften" || tool === "blend" || tool === "swirl" ? 1.22 : 1;
    const dyn = 0.14 + 0.86 * pressure;
    const lean = 1 - 0.3 * clamp(this.lastSpeed / Math.max(28, this.params.size * 0.9), 0, 1);
    return Math.max(1.6, this.params.size * size * tscale * dyn * lean);
  }

  /** Pull-string stabilizer: lag behind the pointer, then stamp along the smoothed path. */
  private advanceStroke(flush: boolean) {
    const x = this.targetX;
    const y = this.targetY;
    const p = this.targetP;
    const dx = x - this.smoothX;
    const dy = y - this.smoothY;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.4 && !flush) return;

    const radius = this.stampRadius(p);
    const lag =
      this.params.tool === "stencil"
        ? clamp(radius * 0.05, 0, 5)
        : flush
          ? 0
          : clamp(radius * (0.15 + this.params.steady * 1.35), 0, 64);
    if (dist <= lag && !flush) return;

    const travel = flush ? dist : dist - lag;
    if (travel < 0.35) return;

    const ux = dx / dist;
    const uy = dy / dist;
    const nx = this.smoothX + ux * travel;
    const ny = this.smoothY + uy * travel;
    this.headingX = ux;
    this.headingY = uy;

    const tool = this.params.tool;
    const spacing = Math.max(
      0.8,
      radius * (tool === "stencil" ? 0.18 : tool === "knife" || tool === "scrape" ? 0.2 : 0.32),
    );
    const path = Math.hypot(nx - this.lastX, ny - this.lastY);
    const steps = Math.max(1, Math.ceil(path / spacing));
    this.lastSpeed = path / steps;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = this.lastX + (nx - this.lastX) * t;
      const py = this.lastY + (ny - this.lastY) * t;
      const pp = this.lastP + (p - this.lastP) * t;
      this.strokeDist += spacing;
      if (this.params.drift > 0.001 && (tool === "oil" || tool === "glaze" || tool === "impasto")) {
        this.shiftBrush(this.params.drift * spacing * 0.0018);
      }
      this.stamp(px, py, pp);
    }
    this.smoothX = nx;
    this.smoothY = ny;
    this.lastX = nx;
    this.lastY = ny;
    this.lastP = p;
  }

  private primeBrush(x: number, y: number) {
    const [cr, cg, cb] = this.params.color;
    this.brushR = SRGB_TO_LINEAR[cr]!;
    this.brushG = SRGB_TO_LINEAR[cg]!;
    this.brushB = SRGB_TO_LINEAR[cb]!;
    const tool = this.params.tool;
    if (tool === "smudge" || tool === "soften" || tool === "scrape" || tool === "blend") {
      this.pickupNeighborhood(x, y, this.params.size * 0.4, tool === "blend" ? 0.72 : 0.85);
    } else if (tool === "knife" || tool === "swirl") {
      this.pickupNeighborhood(x, y, this.params.size * 0.5, 0.62);
    }
  }

  private shiftBrush(turns: number) {
    const [r, g, b] = rotateHueLin(this.brushR, this.brushG, this.brushB, turns);
    this.brushR = r;
    this.brushG = g;
    this.brushB = b;
  }

  private pickupNeighborhood(cx: number, cy: number, radius: number, mix: number) {
    const w = this.width;
    const h = this.height;
    const x0 = clamp((cx - radius) | 0, 0, w - 1);
    const y0 = clamp((cy - radius) | 0, 0, h - 1);
    const x1 = clamp((cx + radius) | 0, 0, w - 1);
    const y1 = clamp((cy + radius) | 0, 0, h - 1);
    let r = 0,
      g = 0,
      b = 0,
      a = 0;
    const r2 = radius * radius;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        if (dx * dx + dy * dy > r2) continue;
        const i = (y * w + x) * 4;
        const cov = this.rgba[i + 3]! / 255;
        if (cov < 0.02) continue;
        const p = y * w + x;
        const wgt = cov * (0.22 + (this.wet[p]! / 255) * 0.78) * (0.28 + (this.thick[p]! / 255) * 1.05);
        r += SRGB_TO_LINEAR[this.rgba[i]!]! * wgt;
        g += SRGB_TO_LINEAR[this.rgba[i + 1]!]! * wgt;
        b += SRGB_TO_LINEAR[this.rgba[i + 2]!]! * wgt;
        a += wgt;
      }
    }
    if (a < 0.001) return;
    this.brushR += (r / a - this.brushR) * mix;
    this.brushG += (g / a - this.brushG) * mix;
    this.brushB += (b / a - this.brushB) * mix;
  }

  /** Premultiplied linear sample. Writes sR/sG/sB/sA/sWet/sTh. */
  private readBilinear(fx: number, fy: number) {
    const w = this.width;
    const h = this.height;
    const rgba = this.rgba;
    const x0 = clamp(Math.floor(fx), 0, w - 1);
    const y0 = clamp(Math.floor(fy), 0, h - 1);
    const x1 = clamp(x0 + 1, 0, w - 1);
    const y1 = clamp(y0 + 1, 0, h - 1);
    const tx = clamp(fx - Math.floor(fx), 0, 1);
    const ty = clamp(fy - Math.floor(fy), 0, 1);
    const i00 = (y0 * w + x0) * 4;
    const i10 = (y0 * w + x1) * 4;
    const i01 = (y1 * w + x0) * 4;
    const i11 = (y1 * w + x1) * 4;
    const a00 = rgba[i00 + 3]! / 255;
    const a10 = rgba[i10 + 3]! / 255;
    const a01 = rgba[i01 + 3]! / 255;
    const a11 = rgba[i11 + 3]! / 255;
    const m00 = (1 - tx) * (1 - ty);
    const m10 = tx * (1 - ty);
    const m01 = (1 - tx) * ty;
    const m11 = tx * ty;
    this.sR =
      SRGB_TO_LINEAR[rgba[i00]!]! * a00 * m00 +
      SRGB_TO_LINEAR[rgba[i10]!]! * a10 * m10 +
      SRGB_TO_LINEAR[rgba[i01]!]! * a01 * m01 +
      SRGB_TO_LINEAR[rgba[i11]!]! * a11 * m11;
    this.sG =
      SRGB_TO_LINEAR[rgba[i00 + 1]!]! * a00 * m00 +
      SRGB_TO_LINEAR[rgba[i10 + 1]!]! * a10 * m10 +
      SRGB_TO_LINEAR[rgba[i01 + 1]!]! * a01 * m01 +
      SRGB_TO_LINEAR[rgba[i11 + 1]!]! * a11 * m11;
    this.sB =
      SRGB_TO_LINEAR[rgba[i00 + 2]!]! * a00 * m00 +
      SRGB_TO_LINEAR[rgba[i10 + 2]!]! * a10 * m10 +
      SRGB_TO_LINEAR[rgba[i01 + 2]!]! * a01 * m01 +
      SRGB_TO_LINEAR[rgba[i11 + 2]!]! * a11 * m11;
    this.sA = a00 * m00 + a10 * m10 + a01 * m01 + a11 * m11;
    this.sWet =
      (this.wet[y0 * w + x0]! / 255) * m00 +
      (this.wet[y0 * w + x1]! / 255) * m10 +
      (this.wet[y1 * w + x0]! / 255) * m01 +
      (this.wet[y1 * w + x1]! / 255) * m11;
    this.sTh =
      (this.thick[y0 * w + x0]! / 255) * m00 +
      (this.thick[y0 * w + x1]! / 255) * m10 +
      (this.thick[y1 * w + x0]! / 255) * m01 +
      (this.thick[y1 * w + x1]! / 255) * m11;
  }

  private pickupBlade(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    tanX: number,
    tanY: number,
    perX: number,
    perY: number,
    mix: number,
  ) {
    const w = this.width;
    const h = this.height;
    const bound = Math.ceil(Math.max(rx, ry) + 1);
    const x0 = clamp((cx - bound) | 0, 0, w - 1);
    const y0 = clamp((cy - bound) | 0, 0, h - 1);
    const x1 = clamp((cx + bound) | 0, 0, w - 1);
    const y1 = clamp((cy + bound) | 0, 0, h - 1);
    let r = 0,
      g = 0,
      b = 0,
      a = 0;
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - cx;
        const u = px * tanX + py * tanY;
        const v = px * perX + py * perY;
        const eu = u / Math.max(rx, 0.5);
        const ev = v / Math.max(ry, 0.5);
        if (eu * eu + ev * ev * 0.72 > 1) continue;
        const p = y * w + x;
        const i = p * 4;
        const cov = this.rgba[i + 3]! / 255;
        if (cov < 0.02) continue;
        const wgt = cov * (0.2 + (this.wet[p]! / 255) * 0.8) * (0.25 + (this.thick[p]! / 255) * 1.2);
        r += SRGB_TO_LINEAR[this.rgba[i]!]! * wgt;
        g += SRGB_TO_LINEAR[this.rgba[i + 1]!]! * wgt;
        b += SRGB_TO_LINEAR[this.rgba[i + 2]!]! * wgt;
        a += wgt;
      }
    }
    if (a < 0.001) return;
    this.brushR += (r / a - this.brushR) * mix;
    this.brushG += (g / a - this.brushG) * mix;
    this.brushB += (b / a - this.brushB) * mix;
  }

  private gated(p: number): boolean {
    const mode = this.params.maskMode;
    if (mode === "off" || this.params.tool === "stencil" || !this.hasMask) return true;
    const m = this.mask[p]!;
    if (mode === "inside") return m > 12;
    return m <= 12;
  }

  private stamp(cx: number, cy: number, pressure: number) {
    const w = this.width;
    const h = this.height;
    const tool = this.params.tool;
    const shape = this.params.brush;
    const radius = this.stampRadius(pressure);
    const flow = this.params.flow;
    const smear = this.params.smear;
    const wetness = this.params.wetness;
    const body = this.params.body;

    let tanX = this.headingX;
    let tanY = this.headingY;
    const tlen = Math.hypot(cx - this.lastX, cy - this.lastY);
    if (tlen > 0.4) {
      tanX = (cx - this.lastX) / tlen;
      tanY = (cy - this.lastY) / tlen;
      this.headingX = tanX;
      this.headingY = tanY;
    }
    const perX = -tanY;
    const perY = tanX;

    const { ax, ay } = brushScale(shape);
    const knifeAx = tool === "knife" || tool === "scrape" ? 2.75 : ax;
    const knifeAy = tool === "knife" || tool === "scrape" ? 0.36 : ay;
    const rx = Math.max(1.8, radius * knifeAx);
    const ry = Math.max(1.4, radius * knifeAy);
    const bound = Math.ceil(Math.max(rx, ry) + 1);
    const x0 = clamp((cx - bound) | 0, 0, w - 1);
    const y0 = clamp((cy - bound) | 0, 0, h - 1);
    const x1 = clamp((cx + bound) | 0, 0, w - 1);
    const y1 = clamp((cy + bound) | 0, 0, h - 1);

    this.pickupN++;
    if (tool === "knife") {
      this.pickupBlade(cx, cy, rx, ry, tanX, tanY, perX, perY, 0.28 + smear * 0.28);
    } else if (tool === "blend" || tool === "swirl") {
      this.pickupNeighborhood(cx, cy, radius * 0.95, 0.38 + smear * 0.28);
    } else if (this.pickupN % 2 === 1) {
      if (tool === "smudge" || tool === "soften" || tool === "scrape") {
        this.pickupNeighborhood(cx - tanX * radius * 0.55, cy - tanY * radius * 0.55, radius * 0.7, 0.35 + smear * 0.5);
      } else if ((tool === "oil" || tool === "impasto") && smear > 0.02) {
        this.pickupNeighborhood(cx, cy, radius * 0.35, smear * 0.1);
      }
    }

    const rgba = this.rgba;
    const wet = this.wet;
    const thick = this.thick;
    const linen = this.linen;
    const mask = this.mask;
    const erase = this.params.eraseMask;
    const wetDeposit = Math.round(wetness * pressure * 255);
    const br = this.brushR;
    const bg = this.brushG;
    const bb = this.brushB;
    const stampShape = tool === "knife" || tool === "scrape" ? "flat" : shape;
    const maskWas = this.hasMask;

    let opacity = flow * (0.72 + 0.28 * pressure);
    if (tool === "smudge") opacity = 0.55 + smear * 0.35;
    if (tool === "glaze") opacity = flow * 0.32 * (0.55 + 0.45 * pressure);
    if (tool === "impasto") opacity = flow * (0.88 + 0.12 * pressure);
    if (tool === "dry") opacity = flow * 0.62;
    if (tool === "soften" || tool === "lift" || tool === "stencil" || tool === "scrape" || tool === "blend" || tool === "swirl") opacity = 0;

    let thickAmt = body * pressure * flow;
    if (tool === "impasto") thickAmt *= 2.05;
    else if (tool === "glaze") thickAmt *= 0.05;
    else if (tool === "dry") thickAmt *= 0.22;
    else if (tool === "oil") thickAmt *= 0.9;
    else if (tool === "smudge") thickAmt = body * 0.12;
    else thickAmt = 0;

    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - cx;
        const u = px * tanX + py * tanY;
        const v = px * perX + py * perY;
        const k = stampWeight(u, v, rx, ry, stampShape, x, y);
        if (k < 0.004) continue;
        const p = y * w + x;

        if (tool === "stencil") {
          const dist = Math.hypot(px, py);
          const rad = Math.max(1.8, radius);
          if (dist > rad) continue;
          const feather = Math.min(2.1 / rad, 0.4);
          const t = dist / rad;
          const cover = t <= 1 - feather ? 1 : Math.max(0, (1 - t) / feather);
          if (cover < 0.02) continue;
          const mv = Math.round(cover * (0.88 + 0.12 * pressure) * 255);
          if (erase) mask[p] = Math.max(0, mask[p]! - mv);
          else mask[p] = Math.max(mask[p]!, mv);
          if (mask[p]! > 8) this.hasMask = true;
          continue;
        }

        if (!this.gated(p)) continue;

        const i = p * 4;
        const destA = rgba[i + 3]! / 255;
        const destT = thick[p]! / 255;
        const destW = wet[p]! / 255;
        const dr = SRGB_TO_LINEAR[rgba[i]!]!;
        const dg = SRGB_TO_LINEAR[rgba[i + 1]!]!;
        const db = SRGB_TO_LINEAR[rgba[i + 2]!]!;

        if (tool === "dry") {
          const tooth = linen[p]!;
          const skip = hash2(x * 0.31, y * 0.27) > 0.22 + tooth * 0.35 + destT * 0.22;
          if (skip) continue;
        }

        if (tool === "lift") {
          const lift = k * flow * pressure;
          rgba[i + 3] = Math.round(rgba[i + 3]! * (1 - lift * 0.85));
          wet[p] = Math.round(wet[p]! * (1 - lift));
          thick[p] = Math.round(thick[p]! * (1 - lift * 0.9));
          this.noteWet(x, y, wet[p]!);
          continue;
        }

        if (tool === "soften") {
          const mix = k * (0.22 + smear * 0.45) * (0.35 + destW * 0.65);
          const srcX = clamp((x - tanX * 1.2) | 0, 0, w - 1);
          const srcY = clamp((y - tanY * 1.2) | 0, 0, h - 1);
          const si = (srcY * w + srcX) * 4;
          const sa = rgba[si + 3]! / 255;
          if (sa > 0.02) {
            rgba[i] = linToByte(dr + (SRGB_TO_LINEAR[rgba[si]!]! - dr) * mix);
            rgba[i + 1] = linToByte(dg + (SRGB_TO_LINEAR[rgba[si + 1]!]! - dg) * mix);
            rgba[i + 2] = linToByte(db + (SRGB_TO_LINEAR[rgba[si + 2]!]! - db) * mix);
            thick[p] = clamp((thick[p]! + (thick[srcY * w + srcX]! - thick[p]!) * mix * 0.4) | 0, 0, 255);
          }
          wet[p] = Math.max(wet[p]!, Math.round(wetDeposit * k * 0.45));
          this.noteWet(x, y, wet[p]!);
          continue;
        }

        if (tool === "scrape") {
          const cut = k * flow * pressure;
          rgba[i + 3] = Math.round(rgba[i + 3]! * (1 - cut * 0.7));
          const pile = u < 0 ? k * body * 70 : 0;
          thick[p] = clamp((thick[p]! * (1 - cut * 0.82) + pile) | 0, 0, 255);
          wet[p] = Math.round(wet[p]! * (1 - cut * 0.5));
          this.noteWet(x, y, wet[p]!);
          continue;
        }

        if (tool === "blend") {
          const step = Math.max(0.7, radius * 0.28);
          this.readBilinear(x - tanX * step, y - tanY * step);
          const aR = this.sR;
          const aG = this.sG;
          const aB = this.sB;
          const aA = this.sA;
          this.readBilinear(x + perX * step * 0.55, y + perY * step * 0.55);
          const mix = k * (0.34 + smear * 0.5) * (0.42 + destW * 0.58);
          const keep = 1 - mix;
          const srcR = (aR + this.sR + br * 0.35) / 2.35;
          const srcG = (aG + this.sG + bg * 0.35) / 2.35;
          const srcB = (aB + this.sB + bb * 0.35) / 2.35;
          const srcA = Math.max(destA, (aA + this.sA) * 0.5);
          if (srcA > 0.01) {
            const outR = dr * destA * keep + srcR * mix;
            const outG = dg * destA * keep + srcG * mix;
            const outB = db * destA * keep + srcB * mix;
            const outA = clamp(destA * keep + srcA * mix, 0, 1);
            if (outA > 0.004) {
              rgba[i] = linToByte(outR / outA);
              rgba[i + 1] = linToByte(outG / outA);
              rgba[i + 2] = linToByte(outB / outA);
              rgba[i + 3] = Math.round(outA * 255);
            }
          }
          thick[p] = clamp((thick[p]! * (1 - mix * 0.18) + this.sTh * 255 * mix * 0.18) | 0, 0, 255);
          wet[p] = Math.max(wet[p]!, Math.round(wetDeposit * k * 0.88));
          this.noteWet(x, y, wet[p]!);
          continue;
        }

        if (tool === "swirl") {
          const dist = Math.hypot(px, py);
          const rad = Math.max(2.2, radius);
          if (dist > rad) continue;
          const fall = 1 - dist / rad;
          const ang = (0.22 + smear * 0.62) * k * (0.5 + pressure * 0.5) * fall * fall;
          const c = Math.cos(ang);
          const s = Math.sin(ang);
          this.readBilinear(cx + px * c - py * s, cy + px * s + py * c);
          const mix = k * (0.38 + smear * 0.42) * (0.45 + destW * 0.55);
          const keep = 1 - mix;
          const outR = dr * destA * keep + this.sR * mix + br * mix * 0.08;
          const outG = dg * destA * keep + this.sG * mix + bg * mix * 0.08;
          const outB = db * destA * keep + this.sB * mix + bb * mix * 0.08;
          const outA = clamp(destA * keep + this.sA * mix, 0, 1);
          if (outA > 0.004) {
            rgba[i] = linToByte(outR / outA);
            rgba[i + 1] = linToByte(outG / outA);
            rgba[i + 2] = linToByte(outB / outA);
            rgba[i + 3] = Math.round(outA * 255);
          }
          thick[p] = clamp((thick[p]! * (1 - mix * 0.1) + this.sTh * 255 * mix * 0.1) | 0, 0, 255);
          wet[p] = Math.max(wet[p]!, Math.round(wetDeposit * k * 0.92));
          this.noteWet(x, y, wet[p]!);
          continue;
        }

        if (tool === "knife") {
          const step = Math.max(1.05, radius * 0.38);
          this.readBilinear(x - tanX * step, y - tanY * step);
          const drag = k * (0.32 + smear * 0.4) * (0.3 + Math.min(1, this.sA) * 0.7);
          const load = k * flow * pressure * 0.04;
          const fold = k * destW * smear * 0.12;
          const keep = 1 - Math.min(0.72, drag);
          let outR = dr * destA * keep + this.sR * drag + br * load;
          let outG = dg * destA * keep + this.sG * drag + bg * load;
          let outB = db * destA * keep + this.sB * drag + bb * load;
          let outA = destA * keep + this.sA * drag + load;
          if (fold > 0.002 && destA > 0.02) {
            outR += (br * destA - dr * destA) * fold * 0.35;
            outG += (bg * destA - dg * destA) * fold * 0.35;
            outB += (bb * destA - db * destA) * fold * 0.35;
          }
          outA = clamp(outA, 0, 1);
          if (outA > 0.004) {
            rgba[i] = linToByte(outR / outA);
            rgba[i + 1] = linToByte(outG / outA);
            rgba[i + 2] = linToByte(outB / outA);
            rgba[i + 3] = Math.round(outA * 255);
          } else {
            rgba[i + 3] = 0;
          }
          const flatten = k * 0.28;
          let nt = thick[p]! * (1 - flatten) + this.sTh * 255 * flatten * 0.6;
          if (u > 0) nt += k * (0.25 + body) * 70 * Math.min(1, u / Math.max(rx, 1));
          thick[p] = clamp(nt | 0, 0, 255);
          const mixedWet = wet[p]! * (1 - drag * 0.28) + this.sWet * 255 * drag * 0.28;
          wet[p] = clamp(Math.max(mixedWet, wetDeposit * k * 0.8) | 0, 0, 255);
          this.noteWet(x, y, wet[p]!);
          continue;
        }

        // Wet-on-wet mixes; wet-on-dry covers. Thickness resists pickup.
        const destDry = destT * (1 - destW);
        const srcA = clamp(opacity * k * (1 - destDry * 0.38), 0, 1);
        if (srcA < 0.003) continue;

        let sr = br;
        let sg = bg;
        let sb = bb;
        if (tool !== "glaze" && destA > 0.04 && destW > 0.08 && smear > 0.01) {
          const m = Math.min(0.55, destW * destA * smear * 0.7 * (1 - destDry));
          sr = br * (1 - m) + dr * m;
          sg = bg * (1 - m) + dg * m;
          sb = bb * (1 - m) + db * m;
        }

        let nr: number;
        let ng: number;
        let nb: number;
        let outA: number;
        if (tool === "glaze" && destA > 0.02) {
          const g = srcA;
          nr = dr * (1 - g) + dr * sr * g;
          ng = dg * (1 - g) + dg * sg * g;
          nb = db * (1 - g) + db * sb * g;
          outA = Math.min(1, destA + srcA * 0.28);
        } else {
          outA = srcA + destA * (1 - srcA);
          const keep = destA * (1 - srcA);
          nr = (sr * srcA + dr * keep) / Math.max(outA, 1e-5);
          ng = (sg * srcA + dg * keep) / Math.max(outA, 1e-5);
          nb = (sb * srcA + db * keep) / Math.max(outA, 1e-5);
        }

        rgba[i] = linToByte(nr);
        rgba[i + 1] = linToByte(ng);
        rgba[i + 2] = linToByte(nb);
        rgba[i + 3] = Math.round(outA * 255);

        if (thickAmt > 0) {
          const groove = hairGroove(v, ry, shape);
          const bead = 0.7 + 0.4 * Math.min(1, Math.abs(v) / Math.max(ry, 0.001));
          const tAdd = thickAmt * k * groove * bead * 255;
          const remain = 1 - destT * 0.38;
          thick[p] = clamp((thick[p]! + tAdd * remain) | 0, 0, 255);
        }

        const nw = Math.max(wet[p]!, Math.round(wetDeposit * k));
        wet[p] = nw;
        this.noteWet(x, y, nw);
      }
    }

    this.expandDirty(x0, y0, x1 + 1, y1 + 1);
    if (tool !== "stencil") this.hasWet = true;
    else if (!maskWas && this.hasMask) this.markAllDirty();
  }

  private commitMarquee() {
    const box = this.marqueeBox;
    if (!box) return;
    const w = this.width;
    const h = this.height;
    const form = box.form;
    const cx = (box.x0 + box.x1) * 0.5;
    const cy = (box.y0 + box.y1) * 0.5;
    const rx = Math.max(4, Math.abs(box.x1 - box.x0) * 0.5);
    const ry = Math.max(4, Math.abs(box.y1 - box.y0) * 0.5);
    const x0 = clamp((cx - rx - 2) | 0, 0, w - 1);
    const y0 = clamp((cy - ry - 2) | 0, 0, h - 1);
    const x1 = clamp((cx + rx + 2) | 0, 0, w - 1);
    const y1 = clamp((cy + ry + 2) | 0, 0, h - 1);
    const erase = this.params.eraseMask;
    const mask = this.mask;
    const feather = 2.2 / Math.min(rx, ry);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        let d: number;
        if (form === "rect") {
          d = Math.max(Math.abs(dx), Math.abs(dy));
        } else {
          d = Math.hypot(dx, dy);
        }
        if (d > 1) continue;
        const edge = d > 1 - feather ? (1 - d) / feather : 1;
        const v = Math.round(edge * 255);
        const p = y * w + x;
        if (erase) mask[p] = Math.max(0, mask[p]! - v);
        else mask[p] = Math.max(mask[p]!, v);
        if (mask[p]! > 8) this.hasMask = true;
      }
    }
    this.expandDirty(x0, y0, x1 + 1, y1 + 1);
    this.markAllDirty();
    this.composite();
  }

  private diffuse(dt: number) {
    const w = this.width;
    const h = this.height;
    const rgba = this.rgba;
    const wet = this.wet;
    const thick = this.thick;
    const tilesX = this.tilesX;
    const rate = 1.15 * dt;
    const dry = 0.22 * dt;
    this.checker ^= 1;
    let anyWet = false;
    const phase = this.checker;

    for (let ty = 0; ty < this.tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tmax = this.tileWet[ty * tilesX + tx]!;
        if (tmax < 6) continue;
        const x0 = tx * TILE;
        const y0 = ty * TILE;
        const x1 = Math.min(w, x0 + TILE);
        const y1 = Math.min(h, y0 + TILE);
        let tileMax = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (((x + y) & 1) !== phase) continue;
            const p = y * w + x;
            const wv = wet[p]!;
            if (wv < 4) continue;
            const i = p * 4;
            const a0 = rgba[i + 3]!;
            if (a0 < 4) {
              wet[p] = 0;
              continue;
            }
            let wr = 0,
              wg = 0,
              wb = 0,
              wa = 0,
              wt = 0,
              wn = 0;
            const add = (nx: number, ny: number) => {
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
              const np = ny * w + nx;
              const nw = wet[np]!;
              const ni = np * 4;
              const na = rgba[ni + 3]!;
              if (na < 4 || nw < 3) return;
              const ww = (nw / 255) * (na / 255);
              wr += SRGB_TO_LINEAR[rgba[ni]!]! * ww;
              wg += SRGB_TO_LINEAR[rgba[ni + 1]!]! * ww;
              wb += SRGB_TO_LINEAR[rgba[ni + 2]!]! * ww;
              wa += ww;
              wt += thick[np]!;
              wn += 1;
            };
            add(x - 1, y);
            add(x + 1, y);
            add(x, y - 1);
            add(x, y + 1);
            if (wa > 1e-5) {
              const t = clamp(rate * (wv / 255) * (1 - (thick[p]! / 255) * 0.55), 0, 0.28);
              const sr = SRGB_TO_LINEAR[rgba[i]!]!;
              const sg = SRGB_TO_LINEAR[rgba[i + 1]!]!;
              const sb = SRGB_TO_LINEAR[rgba[i + 2]!]!;
              rgba[i] = linToByte(sr + (wr / wa - sr) * t);
              rgba[i + 1] = linToByte(sg + (wg / wa - sg) * t);
              rgba[i + 2] = linToByte(sb + (wb / wa - sb) * t);
              if (wn > 0) {
                const avgT = wt / wn;
                thick[p] = clamp((thick[p]! + (avgT - thick[p]!) * t * 0.18) | 0, 0, 255);
              }
            }
            const nd = wv * (1 - dry) - 0.45;
            const next = nd < 2 ? 0 : nd | 0;
            wet[p] = next;
            if (next > tileMax) tileMax = next;
            if (next > 0) anyWet = true;
          }
        }
        this.tileWet[ty * tilesX + tx] = tileMax;
        if (tileMax > 0) this.expandDirty(x0, y0, x1, y1);
      }
    }
    this.hasWet = anyWet;
  }

  private composite(lite = false) {
    const w = this.width;
    const h = this.height;
    const rgba = this.rgba;
    const wet = this.wet;
    const thick = this.thick;
    const mask = this.mask;
    const linen = this.linen;
    const ground = this.groundRgb;
    const out = this.display.data;
    let x0 = 0;
    let y0 = 0;
    let x1 = w;
    let y1 = h;
    if (!this.dirty.all) {
      x0 = Math.max(0, this.dirty.x0 - 1);
      y0 = Math.max(0, this.dirty.y0 - 1);
      x1 = Math.min(w, this.dirty.x1 + 1);
      y1 = Math.min(h, this.dirty.y1 + 1);
      if (x1 <= x0 || y1 <= y0) return;
    }

    if (lite) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = y * w + x;
          const i = p * 4;
          const g = p * 3;
          const a = rgba[i + 3]!;
          if (a < 3) {
            out[i] = ground[g]!;
            out[i + 1] = ground[g + 1]!;
            out[i + 2] = ground[g + 2]!;
          } else if (a > 250) {
            out[i] = rgba[i]!;
            out[i + 1] = rgba[i + 1]!;
            out[i + 2] = rgba[i + 2]!;
          } else {
            const ia = 255 - a;
            out[i] = ((rgba[i]! * a + ground[g]! * ia) / 255) | 0;
            out[i + 1] = ((rgba[i + 1]! * a + ground[g + 1]! * ia) / 255) | 0;
            out[i + 2] = ((rgba[i + 2]! * a + ground[g + 2]! * ia) / 255) | 0;
          }
          out[i + 3] = 255;
        }
      }
      this.blitRect = {
        x: x0,
        y: y0,
        w: Math.max(0, x1 - x0),
        h: Math.max(0, y1 - y0),
        all: this.dirty.all || (x0 <= 0 && y0 <= 0 && x1 >= w && y1 >= h),
      };
      this.dirty.all = false;
      this.dirty.x0 = w;
      this.dirty.y0 = h;
      this.dirty.x1 = 0;
      this.dirty.y1 = 0;
      return;
    }

    const magic = this.params.magic && !this.reducedMotion;
    const stencilTool = this.params.tool === "stencil";
    const showMask = this.hasMask && (stencilTool || this.params.maskMode !== "off");
    const t = this.time;
    const lx = 0.58 + (magic ? Math.cos(t * 0.09) * 0.05 : 0);
    const ly = -0.62 + (magic ? Math.sin(t * 0.07) * 0.04 : 0);
    const lz = 0.52;
    const surface = groundOf(this.surface);
    const linenR = SRGB_TO_LINEAR[surface.rgb[0]]!;
    const linenG = SRGB_TO_LINEAR[surface.rgb[1]]!;
    const linenB = SRGB_TO_LINEAR[surface.rgb[2]]!;

    for (let y = y0; y < y1; y++) {
      const vignY = (y / h - 0.5) * 2;
      for (let x = x0; x < x1; x++) {
        const p = y * w + x;
        const i = p * 4;
        const a = rgba[i + 3]! / 255;
        const weave = linen[p]!;
        const lr = linenR * weave;
        const lg = linenG * weave;
        const lb = linenB * weave;
        let r: number;
        let g: number;
        let b: number;
        if (a < 0.002) {
          r = lr;
          g = lg;
          b = lb;
        } else {
          const pr = SRGB_TO_LINEAR[rgba[i]!]!;
          const pg = SRGB_TO_LINEAR[rgba[i + 1]!]!;
          const pb = SRGB_TO_LINEAR[rgba[i + 2]!]!;
          const cover = 1 - (1 - a) * (1 - a);
          r = pr * cover + lr * (1 - cover);
          g = pg * cover + lg * (1 - cover);
          b = pb * cover + lb * (1 - cover);

          const ylin = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const sat = 1.14;
          r = ylin + (r - ylin) * sat;
          g = ylin + (g - ylin) * sat;
          b = ylin + (b - ylin) * sat;

          const ht = thick[p]! / 255;
          const wv = wet[p]! / 255;
          if (!lite && ht > 0.03) {
            const left = x > 0 ? thick[p - 1]! : thick[p]!;
            const right = x + 1 < w ? thick[p + 1]! : thick[p]!;
            const up = y > 0 ? thick[p - w]! : thick[p]!;
            const down = y + 1 < h ? thick[p + w]! : thick[p]!;
            let nx = (left - right) * 0.014;
            let ny = (up - down) * 0.014;
            let nz = 0.55;
            const inv = 1 / Math.max(0.001, Math.hypot(nx, ny, nz));
            nx *= inv;
            ny *= inv;
            nz *= inv;
            const ndl = Math.max(0, nx * lx + ny * ly + nz * lz);
            const form = (ndl - 0.42) * ht * 0.7;
            r += form * pr;
            g += form * pg;
            b += form * pb;
            const neigh = (left + right + up + down) * 0.25 / 255;
            const valley = Math.max(0, neigh - ht);
            const ao = 1 - valley * 0.55;
            r *= ao;
            g *= ao;
            b *= ao;
            if (wv > 0.06) {
              const spec = ndl * ndl * ndl * ndl * ndl * wv * ht * 0.2;
              r += spec * (0.35 + pr * 0.65);
              g += spec * (0.32 + pg * 0.65);
              b += spec * (0.26 + pb * 0.6);
            }
          }
        }

        if (showMask) {
          const mv = mask[p]!;
          const m = mv / 255;
          let edge = 0;
          if (x > 0) edge = Math.max(edge, Math.abs(mv - mask[p - 1]!));
          if (x + 1 < w) edge = Math.max(edge, Math.abs(mv - mask[p + 1]!));
          if (y > 0) edge = Math.max(edge, Math.abs(mv - mask[p - w]!));
          if (y + 1 < h) edge = Math.max(edge, Math.abs(mv - mask[p + w]!));
          const e = edge / 255;
          if (stencilTool) {
            const dim = 1 - (1 - m) * 0.38;
            r *= dim;
            g *= dim;
            b *= dim;
            if (e > 0.1) {
              const rim = Math.min(1, e * 2.2) * 0.55;
              r += rim * 0.55;
              g += rim * 0.82;
              b += rim * 0.95;
            }
          } else if (e > 0.14) {
            const rim = Math.min(1, e * 1.6) * 0.28;
            r += rim * 0.45;
            g += rim * 0.7;
            b += rim * 0.85;
          }
        } else if (stencilTool) {
          r *= 0.86;
          g *= 0.85;
          b *= 0.82;
        }

        const vignX = (x / w - 0.5) * 2;
        const vig = 1 - (vignX * vignX + vignY * vignY) * surface.vig;
        if (surface.shine > 0 && a < 0.002) {
          const shine = Math.max(0, 0.82 - (x / w) * 0.85 - (y / h) * 0.5) * surface.shine;
          r += shine * 0.55;
          g += shine * 0.68;
          b += shine * 1.05;
        }
        out[i] = linToByte(clamp(r * vig, 0, 1.2));
        out[i + 1] = linToByte(clamp(g * vig, 0, 1.2));
        out[i + 2] = linToByte(clamp(b * vig, 0, 1.2));
        out[i + 3] = 255;
      }
    }
    this.blitRect = {
      x: x0,
      y: y0,
      w: Math.max(0, x1 - x0),
      h: Math.max(0, y1 - y0),
      all: this.dirty.all || x0 <= 0 && y0 <= 0 && x1 >= w && y1 >= h,
    };
    this.dirty.all = false;
    this.dirty.x0 = w;
    this.dirty.y0 = h;
    this.dirty.x1 = 0;
    this.dirty.y1 = 0;
  }

  private buildLinen() {
    const w = this.width;
    const h = this.height;
    const linen = this.linen;
    const grain = groundOf(this.surface).grain;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grain === "frost") {
          const n = valueNoise(x * 0.038, y * 0.038);
          const n2 = valueNoise(x * 0.13, y * 0.13);
          linen[y * w + x] = 0.9 + n * 0.055 + n2 * 0.03;
        } else if (grain === "wood") {
          const n = valueNoise(x * 0.045, y * 0.16);
          const n2 = valueNoise(x * 0.12, y * 0.07);
          const g = Math.sin(y * 0.07 + Math.sin(x * 0.011) * 3.1 + n * 4.2);
          const ring = Math.sin(x * 0.018 + y * 0.004 + n2 * 5);
          linen[y * w + x] = 0.78 + g * 0.09 + ring * 0.05 + n * 0.08;
        } else if (grain === "paper") {
          const n = valueNoise(x * 0.22, y * 0.22);
          linen[y * w + x] = 0.97 + n * 0.03;
        } else if (grain === "flat") {
          const n = valueNoise(x * 0.05, y * 0.05);
          linen[y * w + x] = 0.94 + n * 0.05;
        } else {
          const warp = 0.5 + 0.5 * Math.sin(x * 0.85 + Math.sin(y * 0.07) * 0.4);
          const weft = 0.5 + 0.5 * Math.sin(y * 0.92 + Math.sin(x * 0.06) * 0.35);
          const n = valueNoise(x * 0.11, y * 0.11);
          linen[y * w + x] = 0.93 + warp * 0.035 + weft * 0.03 + n * 0.04;
        }
      }
    }
    const gnd = groundOf(this.surface);
    const gr = SRGB_TO_LINEAR[gnd.rgb[0]]!;
    const gg = SRGB_TO_LINEAR[gnd.rgb[1]]!;
    const gb = SRGB_TO_LINEAR[gnd.rgb[2]]!;
    const rgb = this.groundRgb;
    for (let p = 0; p < linen.length; p++) {
      const weave = linen[p]!;
      const i = p * 3;
      rgb[i] = linToByte(gr * weave);
      rgb[i + 1] = linToByte(gg * weave);
      rgb[i + 2] = linToByte(gb * weave);
    }
  }

  private clonePaint(): OilSnapshot {
    const n = this.width * this.height;
    return {
      width: this.width,
      height: this.height,
      rgba: new Uint8ClampedArray(this.rgba),
      wet: this.hasWet ? new Uint8Array(this.wet) : new Uint8Array(n),
      thick: new Uint8Array(this.thick),
      mask: this.hasMask ? new Uint8Array(this.mask) : new Uint8Array(n),
    };
  }

  private applySnapshot(s: OilSnapshot) {
    this.rgba.set(s.rgba);
    this.wet.set(s.wet);
    this.thick.set(s.thick);
    this.mask.set(s.mask);
    this.rebuildTileWet();
    this.scanMask();
    let painted = false;
    for (let i = 3; i < this.rgba.length; i += 16) {
      if (this.rgba[i]! > 10) {
        painted = true;
        break;
      }
    }
    this.painted = painted;
  }

  private scanMask() {
    const m = this.mask;
    for (let i = 0; i < m.length; i++) {
      if (m[i]! > 8) {
        this.hasMask = true;
        return;
      }
    }
    this.hasMask = false;
  }

  private rebuildTileWet() {
    this.tileWet.fill(0);
    this.hasWet = false;
    const w = this.width;
    const h = this.height;
    const tilesX = this.tilesX;
    for (let y = 0; y < h; y++) {
      const ty = (y / TILE) | 0;
      for (let x = 0; x < w; x++) {
        const v = this.wet[y * w + x]!;
        if (v < 2) continue;
        this.hasWet = true;
        const tx = (x / TILE) | 0;
        const i = ty * tilesX + tx;
        if (v > this.tileWet[i]!) this.tileWet[i] = v;
      }
    }
  }

  private noteWet(x: number, y: number, v: number) {
    const i = ((y / TILE) | 0) * this.tilesX + ((x / TILE) | 0);
    if (v > this.tileWet[i]!) this.tileWet[i] = v;
  }

  private markAllDirty() {
    this.dirty.all = true;
    this.dirty.x0 = 0;
    this.dirty.y0 = 0;
    this.dirty.x1 = this.width;
    this.dirty.y1 = this.height;
  }

  private expandDirty(x0: number, y0: number, x1: number, y1: number) {
    if (this.dirty.all) return;
    if (x0 < this.dirty.x0) this.dirty.x0 = x0;
    if (y0 < this.dirty.y0) this.dirty.y0 = y0;
    if (x1 > this.dirty.x1) this.dirty.x1 = x1;
    if (y1 > this.dirty.y1) this.dirty.y1 = y1;
  }
}
