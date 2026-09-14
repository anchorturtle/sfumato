import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Blend, Droplets, Minus, Pipette, Plus, Redo2, Undo2, Wind, X } from "lucide-react";
import { TubeSlider } from "@/components/studio/Palettes";
import { Slider } from "@/components/ui/slider";
import { OilEngine } from "@/lib/oil/engine";
import { rgbToHex, hexToRgb } from "@/lib/oil/pigments";
import { clearMixBoard, loadMixBoard, saveMixBoard } from "@/lib/oil/persist";
import { cn } from "@/lib/utils";

const MIX_BASE = 480;

function mixPixels(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.width < 24 || r.height < 24) return null;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const dpr = coarse ? 1 : Math.min(1.25, window.devicePixelRatio || 1);
  let w = Math.max(200, Math.round(r.width * dpr));
  let h = Math.max(140, Math.round(r.height * dpr));
  const cap = coarse ? 560 : 720;
  if (w > cap || h > cap) {
    const s = cap / Math.max(w, h);
    w = Math.max(200, Math.round(w * s));
    h = Math.max(140, Math.round(h * s));
  }
  w -= w % 2;
  h -= h % 2;
  return { w, h };
}

type MixMode = "drop" | "blend" | "knife" | "swirl" | "pick";

type Props = {
  color: [number, number, number];
  sampling?: boolean;
  onUse: (rgb: [number, number, number]) => void;
  onKeep: (rgb: [number, number, number]) => void;
};

export function MixBoard({ color, sampling = false, onUse, onKeep }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const engineRef = useRef<OilEngine | null>(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const pickingHeld = useRef(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<MixMode>("drop");
  const [size, setSize] = useState(56);
  const [ready, setReady] = useState(false);
  const [painted, setPainted] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const colorRef = useRef(color);
  colorRef.current = color;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const applyMode = useCallback(
    (engine: OilEngine, next: MixMode, rgb: [number, number, number], sz: number) => {
      if (next === "drop") {
        engine.setParams({
          tool: "oil",
          color: rgb,
          size: sz * (engine.width / MIX_BASE),
          flow: 0.96,
          smear: 0.42,
          wetness: 0.95,
          drift: 0,
          body: 0.88,
          steady: 0.32,
          magic: true,
          brush: "mop",
          maskMode: "off",
          stencil: "free",
        });
      } else if (next === "blend") {
        engine.setParams({
          tool: "blend",
          color: rgb,
          size: sz * 1.15 * (engine.width / MIX_BASE),
          flow: 0.18,
          smear: 0.88,
          wetness: 0.97,
          drift: 0,
          body: 0.18,
          steady: 0.22,
          magic: true,
          brush: "mop",
          maskMode: "off",
          stencil: "free",
        });
      } else if (next === "knife") {
        engine.setParams({
          tool: "knife",
          color: rgb,
          size: sz * (engine.width / MIX_BASE),
          flow: 0.1,
          smear: 0.58,
          wetness: 0.94,
          drift: 0,
          body: 0.36,
          steady: 0.18,
          magic: true,
          brush: "flat",
          maskMode: "off",
          stencil: "free",
        });
      } else if (next === "swirl") {
        engine.setParams({
          tool: "swirl",
          color: rgb,
          size: sz * 1.25 * (engine.width / MIX_BASE),
          flow: 0.12,
          smear: 0.72,
          wetness: 0.98,
          drift: 0,
          body: 0.12,
          steady: 0.12,
          magic: true,
          brush: "round",
          maskMode: "off",
          stencil: "free",
        });
      } else {
        engine.setParams({ tool: "sample", color: rgb, maskMode: "off" });
      }
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = canvas.parentElement ?? canvas;
    const first = mixPixels(stage) ?? { w: 640, h: 400 };
    const engine = new OilEngine(first.w, first.h, "glass", 48);
    engine.reducedMotion = true;
    engineRef.current = engine;
    canvas.width = first.w;
    canvas.height = first.h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctxRef.current = ctx;

    applyMode(engine, "drop", colorRef.current, 56);

    let stopped = false;
    const loop = (ts: number) => {
      if (stopped) return;
      const last = lastTsRef.current || ts;
      lastTsRef.current = ts;
      const dt = Math.min(0.1, (ts - last) / 1000);
      const stroking = engine.isStroking;
      const keep = engine.tick(dt, ts);
      engine.present(ctx, stroking);
      if (keep || stroking) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = 0;
        engine.present(ctx, false);
      }
    };

    const kick = () => {
      if (!rafRef.current) {
        lastTsRef.current = 0;
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const scheduleSave = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (!engine.hasPainted) return;
        void saveMixBoard(engine.toSnapshot()).catch(() => undefined);
      }, 900);
    };

    engine.onChange = () => {
      if (!engine.isStroking) {
        setPainted(engine.hasPainted);
        scheduleSave();
      }
      kick();
    };

    const fit = () => {
      if (stopped || engine.isStroking) return;
      const next = mixPixels(stage);
      if (!next) return;
      if (Math.abs(canvas.width - next.w) < 16 && Math.abs(canvas.height - next.h) < 16) return;
      canvas.width = next.w;
      canvas.height = next.h;
      engine.resize(next.w, next.h);
      applyMode(engine, modeRef.current, colorRef.current, sizeRef.current);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      engine.drawTo(ctx);
      kick();
    };

    const endPointer = () => {
      if (!engine.isStroking) return;
      engine.pointerUp();
      engine.present(ctx);
      kick();
      setPainted(engine.hasPainted);
    };
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);

    (window as unknown as { __sfumatoMix?: { kick: () => void; engine: OilEngine } }).__sfumatoMix = {
      kick,
      engine,
    };

    const ro = new ResizeObserver(() => fit());
    ro.observe(stage);

    engine.drawTo(ctx);
    kick();
    void loadMixBoard().then((snap) => {
      if (stopped) return;
      if (engine.hasPainted) {
        engine.present(ctx);
        setPainted(engine.hasPainted);
        setReady(true);
        kick();
        return;
      }
      if (snap) engine.loadSnapshot(snap);
      fit();
      engine.drawTo(ctx);
      setPainted(engine.hasPainted);
      setReady(true);
      kick();
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointerup", endPointer);
      window.removeEventListener("pointercancel", endPointer);
      ro.disconnect();
      engine.onChange = null;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [applyMode]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    applyMode(engine, mode, color, size);
  }, [applyMode, color, mode, size]);

  useEffect(() => {
    const onDrag = (ev: Event) => {
      const d = (ev as CustomEvent<{ hex: string; x: number; y: number; phase: string }>).detail;
      if (d.phase !== "drop") return;
      applyDrop(d.hex, d.x, d.y);
    };
    window.addEventListener("sfumato-drag", onDrag);
    return () => window.removeEventListener("sfumato-drag", onDrag);
  }, [size, onUse]);

  const applyDrop = (hex: string, clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    const rgb = hexToRgb(hex);
    engine.dropDollop(x, y, rgb, size);
    onUse(rgb);
    presentNow();
    setPainted(true);
    setCanUndo(engine.canUndo);
    setCanRedo(engine.canRedo);
  };

  const toPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    return { x, y, inside: true };
  };

  const kick = () => {
    (window as unknown as { __sfumatoMix?: { kick: () => void } }).__sfumatoMix?.kick();
  };

  const presentNow = () => {
    const engine = engineRef.current;
    const ctx = ctxRef.current;
    if (!engine || !ctx) return;
    engine.present(ctx);
    kick();
  };

  const moveCursor = (e: PointerEvent<HTMLCanvasElement>, visible: boolean) => {
    const el = cursorRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    el.style.opacity = visible && mode !== "pick" && !sampling ? "1" : "0";
    el.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px) translate(-50%, -50%)`;
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const engine = engineRef.current;
    if (!engine) return;
    const { x, y, inside } = toPoint(e);
    if (!inside) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    lastPt.current = { x, y };
    if (sampling || mode === "pick" || e.altKey) {
      pickingHeld.current = true;
      const rgb = engine.sampleAt(x, y);
      if (rgb) onUse(rgb);
      presentNow();
      return;
    }
    applyMode(engine, mode, color, size);
    engine.pointerDown(x, y, e.pressure);
    presentNow();
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    moveCursor(e, true);
    const engine = engineRef.current;
    const { x, y } = toPoint(e);
    lastPt.current = { x, y };
    if (pickingHeld.current) {
      if (!engine) return;
      const rgb = engine.sampleAt(x, y);
      if (rgb) onUse(rgb);
      return;
    }
    if (!engine?.isStroking) return;
    engine.pointerMove(x, y, e.pressure);
    presentNow();
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    pickingHeld.current = false;
    engine?.pointerUp();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    presentNow();
    setPainted(engine?.hasPainted ?? false);
    setCanUndo(engine?.canUndo ?? false);
    setCanRedo(engine?.canRedo ?? false);
    if ((mode === "knife" || mode === "blend" || mode === "swirl") && engine) {
      const pt = lastPt.current;
      const rgb = pt ? engine.sampleAt(pt.x, pt.y) : null;
      if (rgb) onUse(rgb);
    }
  };

  const keepLast = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const pt = lastPt.current;
    const sampled = pt ? engine.sampleAt(pt.x, pt.y) : null;
    onKeep(sampled ?? color);
  };

  const onClear = () => {
    engineRef.current?.clear();
    lastPt.current = null;
    void clearMixBoard();
    presentNow();
    setPainted(false);
    setCanUndo(engineRef.current?.canUndo ?? false);
    setCanRedo(false);
  };

  const undoMix = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.undoStroke();
    presentNow();
    setPainted(engine.hasPainted);
    setCanUndo(engine.canUndo);
    setCanRedo(engine.canRedo);
  };

  const redoMix = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.redoStroke();
    presentNow();
    setPainted(engine.hasPainted);
    setCanUndo(engine.canUndo);
    setCanRedo(engine.canRedo);
  };

  const hex = rgbToHex(color[0], color[1], color[2]);
  const brushCss = (() => {
    const canvas = canvasRef.current;
    if (!canvas) return 22;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / Math.max(1, canvas.width);
    return Math.max(8, size * scale);
  })();

  return (
    <div className="mix-board flex h-full min-h-0 min-w-0 flex-col gap-1.5">
      <div className="mix-toolbar flex shrink-0 items-center gap-1.5">
        <span className="size-10 shrink-0 rounded-full" style={{ ["--pigment" as string]: hex }}>
          <span className="pigment-well block size-full rounded-full" />
        </span>
        <div className="flex min-w-0 flex-1 gap-1.5">
        {(
          [
            { id: "drop", label: "Drop", icon: Droplets },
            { id: "blend", label: "Blend", icon: Blend },
            { id: "knife", label: "Knife", icon: Minus },
            { id: "swirl", label: "Swirl", icon: Wind },
            { id: "pick", label: "Pick", icon: Pipette },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={cn("analog-btn analog-chip mix-tool flex-1", (sampling ? t.id === "pick" : mode === t.id) && "is-on")}
              aria-pressed={sampling ? t.id === "pick" : mode === t.id}
              aria-label={t.label}
              onClick={() => setMode(t.id)}
            >
              <Icon className="size-7" />
            </button>
          );
        })}
        </div>
      </div>

      <div className="mix-stage relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          data-mix-board
          className="touch-none select-none"
          style={{ cursor: sampling || mode === "pick" ? "crosshair" : "none", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(e) => moveCursor(e, false)}
          onContextMenu={(e) => e.preventDefault()}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const hex = e.dataTransfer.getData("text/plain");
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) applyDrop(hex, e.clientX, e.clientY);
          }}
        />
        <div
          ref={cursorRef}
          aria-hidden
          className="brush-cursor"
          style={{
            width: brushCss * (mode === "knife" ? 1.6 : 1),
            height: brushCss * (mode === "knife" ? 0.42 : 1),
            borderRadius: mode === "knife" ? "4px" : "999px",
            background: `${hex}33`,
            boxShadow: `inset 0 0 0 1px ${hex}66`,
          }}
        />
        {ready && !painted && (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 text-center text-xs font-semibold text-fg/80 italic">
            Drop tubes. Blend to make a new color. Knife to fold. Swirl to marble.
          </p>
        )}
      </div>

      <TubeSlider
        hex={hex}
        onPick={(h) => {
          const rgb = hexToRgb(h);
          onUse(rgb);
          const engine = engineRef.current;
          if (!engine) return;
          const next = mode === "pick" ? "drop" : mode;
          if (next !== mode) setMode(next);
          applyMode(engine, next, rgb, size);
        }}
      />

      <div className="mix-foot flex shrink-0 items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Mix size {Math.round(size)}</span>
          <Slider
            min={8}
            max={240}
            step={1}
            value={[size]}
            onValueChange={(v) => v[0] != null && setSize(v[0])}
            className="space-slider h-8 w-full"
            aria-label="Mix size"
          />
        </label>
        <button type="button" className="analog-btn analog-round analog-mini mix-foot-btn" aria-label="Undo mix" disabled={!canUndo} onClick={undoMix}>
          <Undo2 className="size-5" />
        </button>
        <button type="button" className="analog-btn analog-round analog-mini mix-foot-btn" aria-label="Redo mix" disabled={!canRedo} onClick={redoMix}>
          <Redo2 className="size-5" />
        </button>
        <button type="button" className="analog-btn analog-round analog-mini mix-foot-btn" aria-label="Save mix to palette" onClick={keepLast}>
          <Plus className="size-5" />
        </button>
        <button type="button" className="analog-btn analog-round analog-mini mix-foot-btn" aria-label="Clear mix board" onClick={onClear}>
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
