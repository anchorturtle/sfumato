import { useCallback, useEffect, useReducer, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  Blend,
  BoxSelect,
  Brush,
  ChevronsDown,
  ChevronsUp,
  Circle,
  Compass,
  Copy,
  Download,
  Droplets,
  Ellipsis,
  Eraser,
  Feather,
  FlipHorizontal2,
  GripVertical,
  Home,
  Layers,
  Maximize2,
  Minus,
  PaintBucket,
  Pipette,
  Plus,
  RectangleHorizontal,
  Redo2,
  Save,
  Scissors,
  Share2,
  Spline,
  Trash2,
  Undo2,
  Wand2,
  Wind,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MixBoard } from "@/components/studio/MixBoard";
import { OrbitDeck } from "@/components/studio/OrbitDeck";
import { PaletteRail } from "@/components/studio/Palettes";
import { TravellersDesk } from "@/components/studio/Travellers";
import { BRUSHES, type BrushShape } from "@/lib/oil/brushes";
import { OilEngine, type MaskMode, type OilTool, type StencilForm } from "@/lib/oil/engine";
import { addColorToPalette, addCustomPalette, addMineColor, loadCustomPalettes, loadMine, removeCustomPalette, saveCustomPalettes, saveMine, type ArtistPalette } from "@/lib/oil/palettes";
import { hexToRgb, PIGMENTS, rgbToHex, type Pigment } from "@/lib/oil/pigments";
import {
  clearPainting,
  DEFAULT_SETTINGS,
  loadHistory,
  loadPainting,
  loadSettings,
  saveHistory,
  savePainting,
  saveSettings,
} from "@/lib/oil/persist";
import { putSave } from "@/lib/saves";
import { paintSize } from "@/lib/oil/paint-size";
import { type ColorDragDetail, startColorDrag } from "@/lib/color-drag";
import { cn } from "@/lib/utils";

const { w: PAINT_W, h: PAINT_H } = paintSize();
const SIZE_MIN = 2;
const SIZE_MAX = 520;
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

type ToolDef = { id: OilTool; label: string; icon: typeof Brush; hint: string };

const TOOLS: ToolDef[] = [
  { id: "oil", label: "Oil", icon: Brush, hint: "Wet color with body" },
  { id: "glaze", label: "Glaze", icon: Droplets, hint: "Thin transparent veil" },
  { id: "impasto", label: "Impasto", icon: Layers, hint: "Heavy ridges" },
  { id: "dry", label: "Dry", icon: Wind, hint: "Broken scumble" },
  { id: "smudge", label: "Smudge", icon: Blend, hint: "Push and mix" },
  { id: "blend", label: "Blend", icon: Wand2, hint: "Wet mix into a new color" },
  { id: "soften", label: "Soften", icon: Feather, hint: "Blend without a shove" },
  { id: "knife", label: "Knife", icon: Minus, hint: "Spread, pile a bead" },
  { id: "swirl", label: "Swirl", icon: Wind, hint: "Marble wet paint" },
  { id: "scrape", label: "Scrape", icon: Scissors, hint: "Cut back to linen" },
  { id: "lift", label: "Lift", icon: Eraser, hint: "Lift pigment" },
  { id: "fill", label: "Fill", icon: PaintBucket, hint: "Flood a region, or wash a blank canvas" },
  { id: "sample", label: "Sample", icon: Pipette, hint: "Pick from canvas" },
  { id: "stencil", label: "Stencil", icon: BoxSelect, hint: "Draw a mask" },
];

const DRAW_TOOLS: OilTool[] = ["oil", "glaze", "impasto", "dry", "smudge", "blend", "soften", "knife", "swirl", "scrape", "lift"];
const FOCUS_TOOLS: OilTool[] = ["oil", "glaze", "impasto", "smudge", "blend", "knife", "lift", "sample"];

const MASK_MODES: { id: MaskMode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "inside", label: "In" },
  { id: "outside", label: "Out" },
];

const STENCIL_FORMS: { id: StencilForm; label: string; icon: typeof Circle }[] = [
  { id: "free", label: "Free", icon: Spline },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "oval", label: "Oval", icon: Circle },
  { id: "rect", label: "Rect", icon: RectangleHorizontal },
];

export function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<OilEngine | null>(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveGen = useRef(0);

  const [boot] = useState(loadSettings);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<OilTool>(boot.tool);
  const lastDrawTool = useRef<OilTool>(DRAW_TOOLS.includes(boot.tool) ? boot.tool : "oil");
  const [pigmentId, setPigmentId] = useState(boot.pigmentId);
  const [color, setColor] = useState<[number, number, number]>(boot.color);
  const [size, setSize] = useState(boot.size);
  const [flow, setFlow] = useState(boot.flow);
  const [smear, setSmear] = useState(boot.smear);
  const [wetness, setWetness] = useState(boot.wetness);
  const [drift, setDrift] = useState(boot.drift);
  const [body, setBody] = useState(boot.body);
  const [steady, setSteady] = useState(boot.steady);
  const [magic, setMagic] = useState(boot.magic);
  const [brush, setBrush] = useState<BrushShape>(boot.brush);
  const [maskMode, setMaskMode] = useState<MaskMode>(boot.maskMode);
  const [stencil, setStencil] = useState<StencilForm>(boot.stencil);
  const [painted, setPainted] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [customPalettes, setCustomPalettes] = useState<ArtistPalette[]>([]);
  const [deckTab, setDeckTab] = useState<"mix" | "tools" | "palettes" | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [hudOn, setHudOn] = useState(false);
  const [focusPalettes, setFocusPalettes] = useState(false);
  const hudTimer = useRef(0);
  const nativeFs = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const [travellersOpen, setTravellersOpen] = useState(false);
  const [savesEpoch, setSavesEpoch] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState({ fitW: 400, fitH: 300, vpW: 400, vpH: 300 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0, fitW: 400, fitH: 300, vpW: 400, vpH: 300 });
  const pointersRef = useRef(new Map<number, { x: number; y: number; type: string }>());
  const pinchRef = useRef<{ dist: number; zoom: number; worldX: number; worldY: number } | null>(null);
  const pinchLock = useRef(false);
  const panningRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const spaceHeld = useRef(false);
  const samplingHeld = useRef(false);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const syncFromEngine = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    setPainted(e.hasPainted);
    setCanUndo(e.canUndo);
    setCanRedo(e.canRedo);
    setHasMask(e.maskActive);
    const [r, g, b] = e.params.color;
    setColor((prev) => (prev[0] === r && prev[1] === g && prev[2] === b ? prev : [r, g, b]));
    bump();
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const gen = ++saveGen.current;
    saveTimer.current = setTimeout(() => {
      if (gen !== saveGen.current) return;
      const e = engineRef.current;
      if (!e) return;
      void (async () => {
        try {
          if (e.hasPainted) await savePainting(e.toSnapshot());
          await saveHistory(e.exportHistory());
        } catch {
          /* quota / private */
        }
      })();
    }, 1400);
  }, []);

  const applyParams = useCallback(() => {
    engineRef.current?.setParams({
      tool,
      color,
      size,
      flow,
      smear,
      wetness,
      drift,
      body,
      steady,
      magic,
      brush,
      maskMode,
      stencil,
    });
  }, [tool, color, size, flow, smear, wetness, drift, body, steady, magic, brush, maskMode, stencil]);

  const skipSettingsSave = useRef(true);

  useEffect(() => {
    applyParams();
    const engine = engineRef.current;
    const ctx = ctxRef.current;
    if (engine && ctx) engine.present(ctx);
    (window as unknown as { __sfumato?: { kick: () => void } }).__sfumato?.kick();
  }, [applyParams]);

  useEffect(() => {
    if (skipSettingsSave.current) {
      skipSettingsSave.current = false;
      return;
    }
    saveSettings({
      version: 5,
      tool,
      pigmentId,
      color,
      size,
      flow,
      smear,
      wetness,
      drift,
      body,
      steady,
      magic,
      brush,
      maskMode,
      stencil,
      ground: DEFAULT_SETTINGS.ground,
      presetId: DEFAULT_SETTINGS.presetId,
    });
  }, [tool, pigmentId, color, size, flow, smear, wetness, drift, body, steady, magic, brush, maskMode, stencil]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new OilEngine(PAINT_W, PAINT_H, "linen", PAINT_W < 2000 ? 8 : 16);
    engine.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    engineRef.current = engine;
    canvas.width = PAINT_W;
    canvas.height = PAINT_H;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctxRef.current = ctx;

    const saved = loadSettings();
    setTool(saved.tool);
    setPigmentId(saved.pigmentId);
    setColor(saved.color);
    setSize(saved.size);
    setFlow(saved.flow);
    setSmear(saved.smear);
    setWetness(saved.wetness);
    setDrift(saved.drift);
    setBody(saved.body);
    setSteady(saved.steady);
    setMagic(saved.magic);
    setBrush(saved.brush);
    setMaskMode(saved.maskMode);
    setStencil(saved.stencil);
    engine.setParams({
      tool: saved.tool,
      color: saved.color,
      size: saved.size,
      flow: saved.flow,
      smear: saved.smear,
      wetness: saved.wetness,
      drift: saved.drift,
      body: saved.body,
      steady: saved.steady,
      magic: saved.magic,
      brush: saved.brush,
      maskMode: saved.maskMode,
      stencil: saved.stencil,
    });

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

    engine.onChange = () => {
      if (engine.marquee) bump();
      else if (!engine.isStroking) {
        syncFromEngine();
        scheduleSave();
      }
      kick();
    };

    const onVis = () => {
      if (document.hidden) {
        if (engine.hasPainted) void savePainting(engine.toSnapshot()).catch(() => undefined);
        void saveHistory(engine.exportHistory()).catch(() => undefined);
      } else {
        kick();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const endPointer = () => {
      if (!engine.isStroking) return;
      engine.pointerUp();
      engine.present(ctx);
      kick();
      syncFromEngine();
    };
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
    window.addEventListener("blur", endPointer);

    (window as unknown as { __sfumato?: { kick: () => void; engine: OilEngine } }).__sfumato = {
      kick,
      engine,
    };

    engine.drawTo(ctx);
    kick();
    void loadPainting().then(async (snap) => {
      if (stopped) return;
      if (engine.hasPainted) {
        engine.present(ctx);
        setReady(true);
        syncFromEngine();
        kick();
        return;
      }
      if (snap) {
        engine.loadSnapshot(snap);
        if (engine.width !== PAINT_W || engine.height !== PAINT_H) {
          engine.resize(PAINT_W, PAINT_H);
          canvas.width = PAINT_W;
          canvas.height = PAINT_H;
        }
      }
      const hist = await loadHistory();
      if (!stopped && hist) engine.loadHistory(hist);
      engine.drawTo(ctx);
      setReady(true);
      syncFromEngine();
      kick();
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerup", endPointer);
      window.removeEventListener("pointercancel", endPointer);
      window.removeEventListener("blur", endPointer);
      engine.onChange = null;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [scheduleSave, syncFromEngine]);

  const kickLoop = useCallback(() => {
    (window as unknown as { __sfumato?: { kick: () => void } }).__sfumato?.kick();
  }, []);

  const presentNow = useCallback(() => {
    const engine = engineRef.current;
    const ctx = ctxRef.current;
    if (!engine || !ctx) return;
    engine.present(ctx, engine.isStroking);
    if (!engine.isStroking) kickLoop();
  }, [kickLoop]);

  const undoNow = useCallback(() => {
    engineRef.current?.undoStroke();
    presentNow();
    syncFromEngine();
  }, [presentNow, syncFromEngine]);

  const redoNow = useCallback(() => {
    engineRef.current?.redoStroke();
    presentNow();
    syncFromEngine();
  }, [presentNow, syncFromEngine]);

  useEffect(() => {
    setMine(loadMine());
    setCustomPalettes(loadCustomPalettes());
  }, []);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus((s) => (s === msg ? null : s)), 1800);
  }, []);

  const pickHex = useCallback((hex: string, id: string) => {
    setPigmentId(id);
    setColor(hexToRgb(hex));
    setTool((t) => (t === "sample" ? lastDrawTool.current : t));
  }, []);

  useEffect(() => {
    if (DRAW_TOOLS.includes(tool)) lastDrawTool.current = tool;
  }, [tool]);

  const pickPigment = useCallback(
    (p: Pigment) => {
      pickHex(p.hex, p.id);
    },
    [pickHex],
  );

  const addToMine = useCallback(() => {
    setMine((prev) => {
      const hex = rgbToHex(color[0], color[1], color[2]);
      const next = addMineColor(prev, hex);
      if (next === prev) return prev;
      saveMine(next);
      return next;
    });
    flash("Color saved");
  }, [color, flash]);

  const deleteFromMine = useCallback(() => {
    const hex = rgbToHex(color[0], color[1], color[2]).toLowerCase();
    setMine((prev) => {
      const next = prev.filter((c) => c.toLowerCase() !== hex);
      if (next.length === prev.length) return prev;
      saveMine(next);
      return next;
    });
    flash("Color removed");
  }, [color, flash]);

  const savePalette = useCallback((colors: string[]) => {
    const hex = rgbToHex(color[0], color[1], color[2]);
    const list = colors.length > 0 ? colors : [hex];
    setCustomPalettes((prev) => {
      const next = addCustomPalette(prev, list);
      if (next === prev) {
        flash("Palette already saved");
        return prev;
      }
      saveCustomPalettes(next);
      flash("Palette saved");
      return next;
    });
  }, [color, flash]);

  const addToPalette = useCallback((id: string) => {
    const hex = rgbToHex(color[0], color[1], color[2]);
    setCustomPalettes((prev) => {
      const next = addColorToPalette(prev, id, hex);
      if (next === prev) {
        flash("Already in set");
        return prev;
      }
      saveCustomPalettes(next);
      flash("Added to set");
      return next;
    });
  }, [color, flash]);

  const deletePalette = useCallback((id: string) => {
    setCustomPalettes((prev) => {
      const next = removeCustomPalette(prev, id);
      saveCustomPalettes(next);
      return next;
    });
    flash("Palette removed");
  }, [flash]);

  const saveNow = useCallback(async () => {
    const e = engineRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!e) return;
    try {
      await savePainting(e.toSnapshot());
      await saveHistory(e.exportHistory());
      if (canvas && ctx) {
        e.present(ctx);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob) {
          await putSave(blob, "Sfumato");
          setSavesEpoch((n) => n + 1);
          const name = `sfumato-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
          const file = new File([blob], name, { type: "image/png" });
          const ios =
            /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
          if (ios && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: "Sfumato" });
              flash("Saved · Photos");
              return;
            } catch (err) {
              if ((err as Error).name === "AbortError") {
                flash("Saved to gallery");
                return;
              }
            }
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = name;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 2500);
        }
      }
      flash("Saved to gallery");
    } catch {
      flash("Could not save");
    }
  }, [flash]);

  const keepMix = useCallback(
    (rgb: [number, number, number]) => {
      setColor(rgb);
      setPigmentId("mix");
      setMine((prev) => {
        const next = addMineColor(prev, rgbToHex(rgb[0], rgb[1], rgb[2]));
        saveMine(next);
        return next;
      });
      flash("Mix saved");
    },
    [flash],
  );

  const useMix = useCallback((rgb: [number, number, number]) => {
    setColor(rgb);
    setPigmentId("mix");
  }, []);

  const setCustomColor = useCallback((rgb: [number, number, number]) => {
    setColor(rgb);
    setPigmentId("custom");
  }, []);

  const clampPan = useCallback((z: number, panX: number, panY: number, vpW: number, vpH: number, fitW: number, fitH: number) => {
    const w = fitW * z;
    const h = fitH * z;
    let x = panX;
    let y = panY;
    if (w <= vpW) x = (vpW - w) / 2;
    else x = Math.min(0, Math.max(vpW - w, x));
    if (h <= vpH) y = (vpH - h) / 2;
    else y = Math.min(0, Math.max(vpH - h, y));
    return { x, y };
  }, []);

  const commitView = useCallback(
    (z: number, panX: number, panY: number) => {
      const v = viewRef.current;
      const c = clampPan(z, panX, panY, v.vpW, v.vpH, v.fitW, v.fitH);
      viewRef.current = { ...v, zoom: z, panX: c.x, panY: c.y };
      setZoom(z);
      setPan(c);
    },
    [clampPan],
  );

  const fitView = useCallback(() => {
    const v = viewRef.current;
    const c = clampPan(1, 0, 0, v.vpW, v.vpH, v.fitW, v.fitH);
    viewRef.current = { ...v, zoom: 1, panX: c.x, panY: c.y };
    setZoom(1);
    setPan(c);
  }, [clampPan]);

  const zoomToward = useCallback(
    (clientX: number, clientY: number, nextZoom: number) => {
      const vp = viewportRef.current;
      const v = viewRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      const lx = clientX - rect.left;
      const ly = clientY - rect.top;
      const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
      const worldX = (lx - v.panX) / v.zoom;
      const worldY = (ly - v.panY) / v.zoom;
      commitView(z1, lx - worldX * z1, ly - worldY * z1);
    },
    [commitView],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const vp = viewportRef.current;
      const v = viewRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      zoomToward(rect.left + rect.width / 2, rect.top + rect.height / 2, v.zoom * factor);
    },
    [zoomToward],
  );

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const layout = (forceFit = false) => {
      const vpW = Math.max(1, vp.clientWidth);
      const vpH = Math.max(1, vp.clientHeight);
      const pad = focusMode ? 16 : 12;
      const aw = Math.max(1, vpW - pad * 2);
      const ah = Math.max(1, vpH - pad * 2);
      const fitW = Math.min(aw, ah * (PAINT_W / PAINT_H));
      const fitH = fitW * (PAINT_H / PAINT_W);
      const prev = viewRef.current;
      const fitted = forceFit || Math.abs(prev.zoom - 1) < 0.05;
      const z = fitted ? 1 : prev.zoom;
      const c = clampPan(z, fitted ? 0 : prev.panX, fitted ? 0 : prev.panY, vpW, vpH, fitW, fitH);
      viewRef.current = { zoom: z, panX: c.x, panY: c.y, fitW, fitH, vpW, vpH };
      setViewBox({ fitW, fitH, vpW, vpH });
      setZoom(z);
      setPan(c);
    };
    layout(true);
    const ro = new ResizeObserver(() => layout(false));
    ro.observe(vp);
    const onVV = () => layout(false);
    window.visualViewport?.addEventListener("resize", onVV);
    window.addEventListener("orientationchange", onVV);
    return () => {
      ro.disconnect();
      window.visualViewport?.removeEventListener("resize", onVV);
      window.removeEventListener("orientationchange", onVV);
    };
  }, [clampPan, focusMode]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0018);
      zoomToward(e.clientX, e.clientY, viewRef.current.zoom * factor);
    };
    const killGesture = (e: Event) => e.preventDefault();
    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("gesturestart", killGesture);
    vp.addEventListener("gesturechange", killGesture);
    return () => {
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("gesturestart", killGesture);
      vp.removeEventListener("gesturechange", killGesture);
    };
  }, [zoomToward]);

  const toEnginePoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * PAINT_W;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * PAINT_H;
    return { x, y };
  };

  const moveCursor = (e: PointerEvent<HTMLCanvasElement>, visible: boolean) => {
    const el = cursorRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.clientWidth;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.clientHeight;
    el.style.opacity = visible ? "1" : "0";
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (document.body.classList.contains("is-color-drag")) return;
    if (focusMode) setHudOn(false);
    if (e.button === 2) return;
    const engine = engineRef.current;
    if (!engine) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const count = pointersRef.current.size;

    if (e.button === 1 || spaceHeld.current) {
      e.preventDefault();
      panningRef.current = { x: e.clientX, y: e.clientY, panX: viewRef.current.panX, panY: viewRef.current.panY };
      return;
    }

    if (count >= 2 || pinchLock.current) {
      e.preventDefault();
      pinchLock.current = true;
      engine.cancelStroke(false);
      samplingHeld.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      const pts = [...pointersRef.current.values()];
      if (pts.length >= 2) {
        const a = pts[0]!;
        const b = pts[1]!;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const vp = viewportRef.current?.getBoundingClientRect();
        if (vp && dist > 8) {
          pinchRef.current = {
            dist,
            zoom: viewRef.current.zoom,
            worldX: (midX - vp.left - viewRef.current.panX) / viewRef.current.zoom,
            worldY: (midY - vp.top - viewRef.current.panY) / viewRef.current.zoom,
          };
        }
      }
      presentNow();
      return;
    }

    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    const { x, y } = toEnginePoint(e.clientX, e.clientY);
    if (tool === "sample" || e.altKey) {
      samplingHeld.current = true;
      const rgb = engine.sampleAt(x, y);
      if (rgb) {
        setColor(rgb);
        setPigmentId("mix");
      }
      presentNow();
      return;
    }
    engine.setParams({ eraseMask: e.shiftKey });
    engine.pointerDown(x, y, e.pressure, e.pointerType);
    kickLoop();
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const stored = pointersRef.current.get(e.pointerId);
    if (stored) {
      stored.x = e.clientX;
      stored.y = e.clientY;
    }
    const many = pointersRef.current.size >= 2 || !!pinchRef.current || pinchLock.current;
    moveCursor(e, tool !== "sample" && !many && !panningRef.current);

    if (panningRef.current && !many) {
      const p = panningRef.current;
      commitView(viewRef.current.zoom, p.panX + (e.clientX - p.x), p.panY + (e.clientY - p.y));
      return;
    }

    if (many) {
      engineRef.current?.cancelStroke(false);
      const pts = [...pointersRef.current.values()];
      if (pts.length >= 2) {
        const a = pts[0]!;
        const b = pts[1]!;
        const dist = Math.max(8, Math.hypot(a.x - b.x, a.y - b.y));
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const vp = viewportRef.current?.getBoundingClientRect();
        const pinch = pinchRef.current;
        if (vp && pinch) {
          const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinch.zoom * (dist / pinch.dist)));
          commitView(z, midX - vp.left - pinch.worldX * z, midY - vp.top - pinch.worldY * z);
        } else if (vp && dist > 8) {
          pinchRef.current = {
            dist,
            zoom: viewRef.current.zoom,
            worldX: (midX - vp.left - viewRef.current.panX) / viewRef.current.zoom,
            worldY: (midY - vp.top - viewRef.current.panY) / viewRef.current.zoom,
          };
        }
      }
      return;
    }

    const engine = engineRef.current;
    if (samplingHeld.current || ((tool === "sample" || e.altKey) && pointersRef.current.has(e.pointerId))) {
      if (!engine) return;
      const { x, y } = toEnginePoint(e.clientX, e.clientY);
      const rgb = engine.sampleAt(x, y);
      if (rgb) {
        setColor(rgb);
        setPigmentId("mix");
      }
      return;
    }
    if (!engine?.isStroking) return;
    engine.setParams({ eraseMask: e.shiftKey });
    const { x, y } = toEnginePoint(e.clientX, e.clientY);
    engine.pointerMove(x, y, e.pressure, e.pointerType);
    kickLoop();
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    const left = pointersRef.current.size;
    if (left < 2) pinchRef.current = null;
    if (panningRef.current && (e.button === 1 || !spaceHeld.current || e.pointerType !== "mouse")) {
      panningRef.current = null;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const wasSample = samplingHeld.current || tool === "sample";
    samplingHeld.current = false;
    if (pinchLock.current) {
      engineRef.current?.cancelStroke(false);
      if (left === 0) pinchLock.current = false;
      presentNow();
      return;
    }
    if (left === 0) pinchLock.current = false;
    engineRef.current?.pointerUp();
    presentNow();
    syncFromEngine();
    if (wasSample && left === 0 && !e.altKey) {
      setTool(lastDrawTool.current);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if ((e.key === "z" || e.key === "Z") && (meta || !e.repeat)) {
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        if (e.shiftKey) redoNow();
        else undoNow();
        return;
      }
      if (e.key === "[") setSize((s) => Math.max(SIZE_MIN, s - 8));
      else if (e.key === "]") setSize((s) => Math.min(SIZE_MAX, s + 8));
      else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomBy(1.18);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(1 / 1.18);
      } else if (e.key === "0" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        fitView();
      } else if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        spaceHeld.current = true;
      } else if (e.key === "m" || e.key === "M") {
        setMagic((v) => !v);
        kickLoop();
      } else if (/^[1-9]$/.test(e.key)) {
        const p = PIGMENTS[Number(e.key) - 1];
        if (p) pickPigment(p);
      } else if ((e.key === "f" || e.key === "F") && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setFocusMode((v) => !v);
      } else if (e.key === "Escape") {
        setFocusMode(false);
        fitView();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeld.current = false;
        panningRef.current = null;
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [fitView, kickLoop, pickPigment, redoNow, syncFromEngine, undoNow, zoomBy]);

  const exportPng = async () => {
    const blob = await paintingBlob();
    if (!blob) return;
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sfumato.png";
      a.click();
      URL.revokeObjectURL(url);
      flash("Saved as image");
    } catch {
      flash("Could not export");
    }
  };

  const paintingBlob = async () => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !engine || !ctx) return null;
    engine.present(ctx);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  const copyPhoto = async () => {
    const blob = await paintingBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      flash("Copied image");
    } catch {
      flash("Could not copy");
    }
  };

  const sharePhoto = async () => {
    const blob = await paintingBlob();
    if (!blob) return;
    const file = new File([blob], "sfumato.png", { type: "image/png" });
    try {
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Sfumato", text: "Painted in Sfumato" });
        flash("Shared");
        return;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
    await copyPhoto();
  };

  const dropColorAt = useCallback(
    (hex: string, clientX: number, clientY: number) => {
      const mix = document.querySelector("[data-mix-board]") as HTMLElement | null;
      if (mix && mix.offsetParent) {
        const mr = mix.getBoundingClientRect();
        if (mr.width > 8 && mr.height > 8 && clientX >= mr.left && clientX <= mr.right && clientY >= mr.top && clientY <= mr.bottom) {
          return;
        }
      }
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      if (!canvas || !engine) return;
      const rgb = hexToRgb(hex);
      pickHex(hex, "drop");
      engine.fillCanvas(rgb);
      presentNow();
      syncFromEngine();
      setDeckTab(null);
      flash("Filled");
    },
    [flash, pickHex, presentNow, syncFromEngine],
  );

  useEffect(() => {
    const onDrag = (ev: Event) => {
      const d = (ev as CustomEvent<ColorDragDetail>).detail;
      if (d?.phase === "drop" && d.hex) dropColorAt(d.hex, d.x, d.y);
    };
    window.addEventListener("sfumato-drag", onDrag);
    return () => window.removeEventListener("sfumato-drag", onDrag);
  }, [dropColorAt]);

  useEffect(() => {
    const editable = (t: EventTarget | null) =>
      t instanceof HTMLElement && !!t.closest("input, textarea, [contenteditable='true'], .allow-select");
    const block = (e: Event) => {
      if (editable(e.target)) return;
      e.preventDefault();
    };
    const clearSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      if (editable(node ?? null)) return;
      sel.removeAllRanges();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "g" || e.key === "F" || e.key === "G")) {
        e.preventDefault();
      }
    };
    document.addEventListener("selectstart", block, { capture: true });
    document.addEventListener("contextmenu", block, { capture: true });
    document.addEventListener("selectionchange", clearSel);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("selectstart", block, { capture: true });
      document.removeEventListener("contextmenu", block, { capture: true });
      document.removeEventListener("selectionchange", clearSel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const stopPageZoom = (e: Event) => e.preventDefault();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    let lastTap = 0;
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length > 0) return;
      const now = Date.now();
      if (now - lastTap < 380) e.preventDefault();
      lastTap = now;
    };
    document.addEventListener("gesturestart", stopPageZoom, { capture: true, passive: false });
    document.addEventListener("gesturechange", stopPageZoom, { capture: true, passive: false });
    document.addEventListener("gestureend", stopPageZoom, { capture: true, passive: false });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    document.addEventListener("dblclick", stopPageZoom, { capture: true });
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      document.removeEventListener("gesturestart", stopPageZoom, { capture: true });
      document.removeEventListener("gesturechange", stopPageZoom, { capture: true });
      document.removeEventListener("gestureend", stopPageZoom, { capture: true });
      document.removeEventListener("touchmove", onTouchMove, { capture: true });
      document.removeEventListener("touchend", onTouchEnd, { capture: true });
      document.removeEventListener("dblclick", stopPageZoom, { capture: true });
      window.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, []);

  const bumpHud = useCallback(() => {
    window.clearTimeout(hudTimer.current);
    setHudOn(true);
  }, []);

  const toggleFocus = async () => {
    const next = !focusMode;
    setFocusMode(next);
    setHudOn(false);
    setFocusPalettes(false);
    const el = (shellRef.current ?? document.documentElement) as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    try {
      if (next) {
        const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
        if (req) await req.call(el, { navigationUI: "hide" } as FullscreenOptions);
        nativeFs.current = !!(document.fullscreenElement || doc.webkitFullscreenElement);
      } else {
        nativeFs.current = false;
        if (document.fullscreenElement || doc.webkitFullscreenElement) {
          await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
        }
      }
    } catch {
      nativeFs.current = false;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => fitView());
    });
  };

  useEffect(() => {
    const fsEl = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      return document.fullscreenElement || doc.webkitFullscreenElement || null;
    };
    const onFs = () => {
      if (!fsEl() && nativeFs.current) {
        nativeFs.current = false;
        setFocusMode(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusMode) {
        e.preventDefault();
        void toggleFocus();
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs as EventListener);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs as EventListener);
      window.removeEventListener("keydown", onKey);
    };
  }, [focusMode, bumpHud]);

  const onClearCanvas = () => {
    saveGen.current += 1;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const e = engineRef.current;
    e?.clear();
    if (e) {
      void savePainting(e.toSnapshot()).catch(() => undefined);
      void saveHistory(e.exportHistory()).catch(() => undefined);
    } else {
      void clearPainting();
    }
    presentNow();
    syncFromEngine();
    flash("Blank canvas");
  };

  const brushCss = (() => {
    const canvas = canvasRef.current;
    if (!canvas) return 28;
    return Math.max(6, (size / PAINT_W) * canvas.clientWidth);
  })();

  const colorHex = rgbToHex(color[0], color[1], color[2]);
  const closeDeck = () => setDeckTab(null);
  const cursorRound = brush === "round" || brush === "mop" || brush === "bristle" || brush === "stipple";
  const currentTool = TOOLS.find((t) => t.id === tool);
  const marquee = engineRef.current?.marquee ?? null;

  return (
    <TooltipProvider>
      <div ref={shellRef} className={cn("studio-shell relative z-[1] flex h-dvh flex-col text-fg", focusMode && "is-focus")}>
        <div className="space-bg" aria-hidden />
        <Starfield />
        <div className="grain-overlay" aria-hidden />
        <div className="scanlines" aria-hidden />
        <div className="vignette" aria-hidden />
        <header className="studio-dock">
          <a className="dock-logo-wrap studio-enter" href="https://www.anchorturtle.com/" aria-label="Orbit home">
            <span className="dock-logo-mark" aria-hidden>
              <span className="dock-logo-blob" />
            </span>
            <span className="dock-logo-text">
              <span className="dock-logo-main">Sfumato</span>
              <span className="dock-logo-sub">Orbit</span>
            </span>
          </a>
          <nav className="dock-nav" aria-label="Orbit">
            <a className="analog-btn analog-round" href="https://www.anchorturtle.com/" aria-label="Orbit home">
              <Home className="size-5" />
            </a>
            <button
              type="button"
              className={cn("analog-btn analog-round", travellersOpen && "is-on")}
              aria-label="Travellers"
              aria-pressed={travellersOpen}
              onClick={() => setTravellersOpen(true)}
            >
              <Compass className="size-5" />
            </button>
          </nav>
          <OrbitDeck />
          <div className="dock-end">
          <div className="dock-divider hidden sm:block" />
          <div className="dock-actions studio-enter studio-enter-delay-1 flex items-center gap-1">
            <IconTip label="Undo">
              <button
                type="button"
                className="analog-btn analog-round"
                disabled={!canUndo}
                aria-label="Undo"
                onClick={undoNow}
              >
                <Undo2 className="size-5" />
              </button>
            </IconTip>
            <IconTip label="Redo">
              <button
                type="button"
                className="analog-btn analog-round"
                disabled={!canRedo}
                aria-label="Redo"
                onClick={redoNow}
              >
                <Redo2 className="size-5" />
              </button>
            </IconTip>
            <IconTip label={magic ? "Live mix on" : "Live mix off"}>
              <button
                type="button"
                className={cn("analog-btn analog-round", magic && "is-on")}
                aria-pressed={magic}
                aria-label="Toggle live mix"
                onClick={() => {
                  setMagic((v) => !v);
                  kickLoop();
                }}
              >
                <Wand2 className="size-5" />
              </button>
            </IconTip>
            <IconTip label="Save canvas">
              <button type="button" className="analog-btn analog-round" aria-label="Save canvas" onClick={() => void saveNow()}>
                <Save className="size-5" />
              </button>
            </IconTip>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="analog-btn analog-round" aria-label="Share or copy painting">
                  <Share2 className="size-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-2">
                <button type="button" className="analog-btn analog-chip w-full justify-start" onClick={() => void copyPhoto()}>
                  <Copy className="size-4" />
                  Copy
                </button>
                <button type="button" className="analog-btn analog-chip mt-1 w-full justify-start" onClick={() => void sharePhoto()}>
                  <Share2 className="size-4" />
                  Share
                </button>
                <button type="button" className="analog-btn analog-chip mt-1 w-full justify-start" onClick={() => void exportPng()}>
                  <Download className="size-4" />
                  Download
                </button>
              </PopoverContent>
            </Popover>
          </div>
          <button
            type="button"
            className="analog-btn analog-chip enlarge-chip"
            aria-label="Enlarge canvas"
            onClick={() => void toggleFocus()}
          >
            <Maximize2 className="size-4" />
            <span className="enlarge-label">Enlarge</span>
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="dock-more analog-btn analog-round" aria-label="More tools">
                <Ellipsis className="size-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-2">
              <button type="button" className="analog-btn analog-chip w-full justify-start" onClick={() => setTravellersOpen(true)}>
                <Compass className="size-4" />
                Travellers
              </button>
              <button type="button" className="analog-btn analog-chip mt-1 w-full justify-start" disabled={!canUndo} onClick={undoNow}>
                <Undo2 className="size-4" />
                Undo
              </button>
              <button type="button" className="analog-btn analog-chip mt-1 w-full justify-start" disabled={!canRedo} onClick={redoNow}>
                <Redo2 className="size-4" />
                Redo
              </button>
              <button
                type="button"
                className={cn("analog-btn analog-chip mt-1 w-full justify-start", magic && "is-on")}
                onClick={() => {
                  setMagic((v) => !v);
                  kickLoop();
                }}
              >
                <Wand2 className="size-4" />
                Live mix
              </button>
              <button type="button" className="analog-btn analog-chip mt-1 w-full justify-start" onClick={() => void saveNow()}>
                <Save className="size-4" />
                Save
              </button>
              <button type="button" className="analog-btn analog-chip mt-1 w-full justify-start" onClick={() => void sharePhoto()}>
                <Share2 className="size-4" />
                Share
              </button>
              <button type="button" className="analog-btn analog-chip mt-1 w-full justify-start" onClick={onClearCanvas}>
                <Trash2 className="size-4" />
                Blank
              </button>
            </PopoverContent>
          </Popover>
          </div>
        </header>

        {focusMode && !hudOn && (
          <button type="button" className="focus-peek" aria-label="Show tools" onClick={bumpHud}>
            <ChevronsDown className="size-4" />
            Tools
          </button>
        )}
        {focusMode && focusPalettes && (
          <aside
            className="focus-pals"
            aria-label="Palettes"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <WinBar title="Palettes" onClose={() => setFocusPalettes(false)} />
            <div className="win-body p-2">
              <PaletteRail
                compact
                color={color}
                mine={mine}
                custom={customPalettes}
                onPick={(hex, id) => {
                  pickHex(hex, id);
                }}
                onColor={setCustomColor}
                onAddMine={addToMine}
                onDeleteMine={deleteFromMine}
                onDeletePalette={deletePalette}
                onSavePalette={savePalette}
                onAddToPalette={addToPalette}
              />
            </div>
          </aside>
        )}
        {focusMode && (
          <nav
            className={cn("focus-hud", !hudOn && "is-away")}
            aria-label="Enlarge tools"
            onPointerDown={(e) => {
              e.stopPropagation();
              bumpHud();
            }}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="focus-hud-tools">
              {FOCUS_TOOLS.map((id) => {
                const t = TOOLS.find((x) => x.id === id)!;
                const Icon = t.icon;
                return (
                  <button
                    key={id}
                    type="button"
                    className={cn("focus-btn", tool === id && "is-on")}
                    aria-label={t.label}
                    aria-pressed={tool === id}
                    onClick={() => setTool(id)}
                  >
                    <Icon className="size-5" />
                  </button>
                );
              })}
              <button
                type="button"
                className={cn("focus-swatch", focusPalettes && "is-on")}
                style={{ background: colorHex }}
                title={colorHex}
                aria-label="Open palettes"
                aria-pressed={focusPalettes}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  startColorDrag(colorHex, e.pointerId, e.clientX, e.clientY, () => setFocusPalettes((open) => !open));
                }}
              />
            </div>
            <div className="focus-hud-actions">
              <button type="button" className="focus-btn" disabled={!canUndo} aria-label="Undo" onClick={undoNow}>
                <Undo2 className="size-5" />
              </button>
              <button type="button" className="focus-btn" disabled={!canRedo} aria-label="Redo" onClick={redoNow}>
                <Redo2 className="size-5" />
              </button>
              <button type="button" className="focus-btn" aria-label="Save canvas" onClick={() => void saveNow()}>
                <Save className="size-5" />
              </button>
              <div className="focus-size-row">
                <span className="focus-size">{Math.round(size)}</span>
                <button
                  type="button"
                  className="focus-btn focus-size-btn"
                  aria-label="Smaller brush"
                  onClick={() => setSize((s) => Math.max(SIZE_MIN, s - 8))}
                >
                  <Minus className="size-6" />
                </button>
                <button
                  type="button"
                  className="focus-btn focus-size-btn"
                  aria-label="Bigger brush"
                  onClick={() => setSize((s) => Math.min(SIZE_MAX, s + 8))}
                >
                  <Plus className="size-6" />
                </button>
              </div>
              <button type="button" className="focus-btn focus-nav-label" aria-label="Hide tools" onClick={() => setHudOn(false)}>
                <span>Hide</span>
                <ChevronsUp className="size-4" />
              </button>
              <button type="button" className="focus-exit focus-nav-label" aria-label="Exit enlarge" onClick={() => void toggleFocus()}>
                <span>Exit</span>
                <X className="size-4" />
              </button>
            </div>
          </nav>
        )}

        <div className="studio-body">
          {deckTab && (
            <button type="button" className="sheet-scrim" aria-label="Hide panel" onClick={closeDeck} />
          )}
          <aside className={cn("mix-rail", deckTab !== "mix" && "desk-hide")}>
            <div className="orbit-win h-full">
              <WinBar title="Mix" onClose={closeDeck} />
              <div className="win-body">
                <div className="glass-board flex min-h-0 flex-1 flex-col p-2">
                  <MixBoard color={color} sampling={tool === "sample"} onUse={useMix} onKeep={keepMix} />
                </div>
              </div>
            </div>
          </aside>

          <main className="canvas-col relative min-h-0 overflow-hidden">
          <div className="orbit-win canvas-win">
            <WinBar
              title="Canvas"
              meta={`${currentTool?.label ?? "Oil"}  ${Math.round(zoom * 100)}%`}
              extra={
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="analog-btn analog-round analog-mini"
                    aria-label="Zoom out"
                    onClick={() => zoomBy(1 / 1.22)}
                  >
                    <ZoomOut className="size-4" />
                  </button>
                  <button type="button" className="analog-btn analog-chip analog-mini-wide" aria-label="Fit canvas" onClick={fitView}>
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    className="analog-btn analog-round analog-mini"
                    aria-label="Zoom in"
                    onClick={() => zoomBy(1.22)}
                  >
                    <ZoomIn className="size-4" />
                  </button>
                </div>
              }
            />
            <div className="win-body">
          <div
            ref={viewportRef}
            className="canvas-viewport relative h-full min-h-0 w-full overflow-hidden"
          >
            <div
              className="canvas-world relative"
              style={{
                width: viewBox.fitW,
                height: viewBox.fitH,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-lg bg-frame p-1.5 shadow-[var(--shadow-border)] md:rounded-xl md:p-1.5">
                <div className="relative flex h-full w-full overflow-hidden rounded-sm">
                  <canvas
                    ref={canvasRef}
                    data-paint-canvas
                    className="block h-full w-full touch-none select-none"
                    style={{ cursor: tool === "sample" || tool === "fill" ? "crosshair" : spaceHeld.current || zoom > 1.02 ? "grab" : "none", touchAction: "none" }}
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
                      if (/^#[0-9a-fA-F]{6}$/.test(hex)) dropColorAt(hex, e.clientX, e.clientY);
                    }}
                  />
                  {marquee && canvasRef.current && <MarqueeOverlay marquee={marquee} canvas={canvasRef.current} />}
                  <div
                    ref={cursorRef}
                    aria-hidden
                    className="brush-cursor"
                    style={{
                      width: brushCss * (brush === "flat" || brush === "rigger" || brush === "bright" ? 1.55 : 1),
                      height:
                        brushCss *
                        (brush === "flat" || brush === "rigger" ? 0.42 : brush === "filbert" || brush === "bright" ? 0.78 : 1),
                      borderRadius: cursorRound ? "999px" : brush === "filbert" ? "50%" : "4px",
                      background: tool === "stencil" ? "rgb(236 231 220 / 0.28)" : `${colorHex}2e`,
                      boxShadow: `inset 0 0 0 1px ${tool === "stencil" ? "rgb(236 231 220 / 0.7)" : `${colorHex}55`}`,
                    }}
                  />
                  {!painted && ready && (
                    <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-sm font-semibold text-accent-fg/80 italic md:bottom-8 md:text-base">
                      Pinch to zoom. Drag a color onto the linen to fill.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
          </div>
          {status && (
            <p className="status-toast pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs">
              {status}
            </p>
          )}
        </main>

        <div className={cn("tools-rail", deckTab !== "tools" && "desk-hide")}>
          <div className="orbit-win h-full">
            <WinBar title="Tools" meta={colorHex} onClose={closeDeck} />
            <div className="win-body p-2">
            <div className="tools-extras">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="analog-btn analog-chip">
                    Hair
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" side="top" className="w-80">
                  <HairPanel brush={brush} onBrush={setBrush} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className={cn("analog-btn analog-chip", (tool === "stencil" || (hasMask && maskMode !== "off")) && "is-on")}>
                    Stencil
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" side="top" className="w-72">
                  <StencilPanel
                    tool={tool}
                    onTool={setTool}
                    maskMode={maskMode}
                    onMaskMode={setMaskMode}
                    stencil={stencil}
                    onStencil={setStencil}
                    hasMask={hasMask}
                    onFill={() => {
                      engineRef.current?.fillMask();
                      kickLoop();
                      syncFromEngine();
                    }}
                    onClear={() => {
                      engineRef.current?.clearMask();
                      kickLoop();
                      syncFromEngine();
                    }}
                    onInvert={() => {
                      engineRef.current?.invertMask();
                      kickLoop();
                      syncFromEngine();
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <ToolGrid tool={tool} onTool={setTool} />
            <div className="mt-2 grid grid-cols-2 gap-x-3">
              <SliderField label="Size" value={size} min={SIZE_MIN} max={SIZE_MAX} step={1} onChange={setSize} />
              <SliderField label="Body" value={body} min={0} max={1} step={0.01} onChange={setBody} />
            </div>
            <MixPanel
              flow={flow}
              smear={smear}
              wetness={wetness}
              drift={drift}
              steady={steady}
              onFlow={setFlow}
              onSmear={setSmear}
              onWetness={setWetness}
              onDrift={setDrift}
              onSteady={setSteady}
            />
            </div>
          </div>
        </div>

        <aside className={cn("palette-rail", deckTab !== "palettes" && "desk-hide")}>
          <div className="orbit-win h-full">
            <WinBar title="Palettes" meta={customPalettes.length ? `${customPalettes.length} set` : undefined} onClose={closeDeck} />
            <div className="win-body p-2">
            <PaletteRail
              color={color}
              mine={mine}
              custom={customPalettes}
              onPick={pickHex}
              onColor={setCustomColor}
              onAddMine={addToMine}
              onDeleteMine={deleteFromMine}
              onDeletePalette={deletePalette}
              onSavePalette={savePalette}
              onAddToPalette={addToPalette}
            />
            </div>
          </div>
        </aside>

        <nav className="dock-tabs mobile-dock touch-only px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1">
          <DeckTabs value={deckTab} onChange={setDeckTab} />
        </nav>
      </div>
      <TravellersDesk
        open={travellersOpen}
        onClose={() => setTravellersOpen(false)}
        canvasBlob={paintingBlob}
        savesEpoch={savesEpoch}
      />
      </div>
    </TooltipProvider>
  );
}

type DeckId = "mix" | "tools" | "palettes";

const DECK_TABS: { id: DeckId | null; short: string; full: string }[] = [
  { id: null, short: "Paint", full: "Canvas" },
  { id: "mix", short: "Mix", full: "Mixer" },
  { id: "tools", short: "Tools", full: "Tools" },
  { id: "palettes", short: "Pals", full: "Palettes" },
];

function DeckTabs({ value, onChange }: { value: DeckId | null; onChange: (id: DeckId | null) => void }) {
  const ptr = useRef<{ id: number; x: number; scrub: boolean } | null>(null);
  const skipClick = useRef(false);

  const readDeck = (raw: string | undefined): DeckId | null | undefined => {
    if (raw === "canvas") return null;
    if (raw === "mix" || raw === "tools" || raw === "palettes") return raw;
    return undefined;
  };

  const tabAt = (clientX: number, bar: HTMLElement) => {
    const buttons = bar.querySelectorAll<HTMLButtonElement>("[data-deck]");
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return readDeck(b.dataset.deck);
    }
    return undefined;
  };

  return (
    <div
      className="tracklist-tabs"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        skipClick.current = false;
        ptr.current = { id: e.pointerId, x: e.clientX, scrub: false };
      }}
      onPointerMove={(e) => {
        const p = ptr.current;
        if (!p || p.id !== e.pointerId) return;
        if (!p.scrub && Math.abs(e.clientX - p.x) > 14) {
          p.scrub = true;
          skipClick.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* iOS */
          }
        }
        if (!p.scrub) return;
        const next = tabAt(e.clientX, e.currentTarget);
        if (next !== undefined && next !== value) onChange(next);
      }}
      onPointerUp={() => {
        ptr.current = null;
      }}
      onPointerCancel={() => {
        ptr.current = null;
      }}
    >
      {DECK_TABS.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.full}
            type="button"
            data-deck={t.id ?? "canvas"}
            className={cn("tab", on && "active")}
            aria-pressed={on}
            aria-label={t.full}
            onClick={() => {
              if (skipClick.current) {
                skipClick.current = false;
                return;
              }
              onChange(value === t.id ? null : t.id);
            }}
          >
            <span className="tab-short">{t.short}</span>
            <span className="tab-full">{t.full}</span>
          </button>
        );
      })}
    </div>
  );
}

function WinBar({ title, meta, extra, onClose }: { title: string; meta?: string; extra?: ReactNode; onClose?: () => void }) {
  return (
    <div className="win-bar">
      <div className="win-bar-left">
        <GripVertical className="win-grip" aria-hidden />
        <span className="win-title">{title}</span>
        {meta ? <span className="tape-counter opacity-70">{meta}</span> : null}
      </div>
      <div className="win-bar-right">
        {extra}
        {onClose ? (
          <button type="button" className="sheet-close analog-btn analog-round analog-mini" aria-label="Hide panel" onClick={onClose}>
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) {
        const x = (i * 97) % w;
        const y = (i * 53 + i * i * 13) % h;
        const r = 0.4 + (i % 5) * 0.22;
        ctx.fillStyle = i % 7 === 0 ? "rgba(126,200,227,0.7)" : i % 5 === 0 ? "rgba(123,47,255,0.5)" : "rgba(255,255,255,0.65)";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, []);
  return <canvas ref={ref} className="stars-canvas" aria-hidden />;
}

function IconTip({ label, children }: { label: string; children: ReactNode }) {
  const [hover, setHover] = useState(false);
  useEffect(() => {
    setHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);
  if (!hover) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolGrid({
  tool,
  onTool,
}: {
  tool: OilTool;
  onTool: (t: OilTool) => void;
}) {
  return (
    <div className="tool-grid">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <IconTip key={t.id} label={t.hint}>
            <button
              type="button"
              className={cn("analog-btn analog-round", active && "is-on")}
              aria-label={t.label}
              aria-pressed={active}
              onClick={() => onTool(t.id)}
            >
              <Icon className="size-5" />
            </button>
          </IconTip>
        );
      })}
    </div>
  );
}

function HairPanel({ brush, onBrush }: { brush: BrushShape; onBrush: (b: BrushShape) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {BRUSHES.map((b) => (
        <IconTip key={b.id} label={b.hint}>
          <button
            type="button"
            className={cn("analog-btn analog-chip", brush === b.id && "is-on")}
            aria-pressed={brush === b.id}
            onClick={() => onBrush(b.id)}
          >
            {b.label}
          </button>
        </IconTip>
      ))}
    </div>
  );
}

function StencilPanel({
  tool,
  onTool,
  maskMode,
  onMaskMode,
  stencil,
  onStencil,
  hasMask,
  onFill,
  onClear,
  onInvert,
}: {
  tool: OilTool;
  onTool: (t: OilTool) => void;
  maskMode: MaskMode;
  onMaskMode: (m: MaskMode) => void;
  stencil: StencilForm;
  onStencil: (s: StencilForm) => void;
  hasMask: boolean;
  onFill: () => void;
  onClear: () => void;
  onInvert: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-5 text-muted">Draw a mask. Shift erases. Off drops the overlay now. In/Out clip paint.</p>
      <div className="grid grid-cols-4 gap-1">
        {STENCIL_FORMS.map((s) => {
          const Icon = s.icon;
          const on = stencil === s.id && tool === "stencil";
          return (
            <IconTip key={s.id} label={s.label}>
              <button
                type="button"
                className={cn("analog-btn analog-round", on && "is-on")}
                aria-label={s.label}
                aria-pressed={on}
                onClick={() => {
                  onStencil(s.id);
                  onTool("stencil");
                  if (maskMode === "off") onMaskMode("inside");
                }}
              >
                <Icon className="size-5" />
              </button>
            </IconTip>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MASK_MODES.map((m) => (
          <button
            type="button"
            key={m.id}
            className={cn(
              "analog-btn analog-chip",
              (m.id === "off" ? maskMode === "off" && tool !== "stencil" : maskMode === m.id) && "is-on",
            )}
            aria-pressed={m.id === "off" ? maskMode === "off" && tool !== "stencil" : maskMode === m.id}
            onClick={() => {
              onMaskMode(m.id);
              if (m.id === "off" && tool === "stencil") onTool("oil");
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        <button type="button" className="analog-btn analog-chip" disabled={!hasMask} onClick={onFill}>
          <PaintBucket className="size-4" />
          Fill
        </button>
        <button type="button" className="analog-btn analog-chip" disabled={!hasMask} onClick={onInvert}>
          <FlipHorizontal2 className="size-4" />
          Flip
        </button>
        <button type="button" className="analog-btn analog-chip" disabled={!hasMask} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}

function MixPanel({
  flow,
  smear,
  wetness,
  drift,
  steady,
  onFlow,
  onSmear,
  onWetness,
  onDrift,
  onSteady,
}: {
  flow: number;
  smear: number;
  wetness: number;
  drift: number;
  steady: number;
  onFlow: (n: number) => void;
  onSmear: (n: number) => void;
  onWetness: (n: number) => void;
  onDrift: (n: number) => void;
  onSteady: (n: number) => void;
}) {
  return (
    <div className="mix-feel mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
      <SliderField label="Mix" value={smear} min={0} max={1} step={0.01} onChange={onSmear} />
      <SliderField label="Flow" value={flow} min={0.12} max={1} step={0.01} onChange={onFlow} />
      <SliderField label="Wet" value={wetness} min={0} max={1} step={0.01} onChange={onWetness} />
      <SliderField label="Steady" value={steady} min={0} max={1} step={0.01} onChange={onSteady} />
      <SliderField label="Drift" value={drift} min={0} max={1} step={0.01} onChange={onDrift} />
    </div>
  );
}

function MarqueeOverlay({
  marquee,
  canvas,
}: {
  marquee: { x0: number; y0: number; x1: number; y1: number; form: StencilForm };
  canvas: HTMLCanvasElement;
}) {
  const sx = canvas.clientWidth / PAINT_W;
  const sy = canvas.clientHeight / PAINT_H;
  const left = Math.min(marquee.x0, marquee.x1) * sx;
  const top = Math.min(marquee.y0, marquee.y1) * sy;
  const width = Math.max(4, Math.abs(marquee.x1 - marquee.x0) * sx);
  const height = Math.max(4, Math.abs(marquee.y1 - marquee.y0) * sy);
  return (
    <div
      aria-hidden
      className="marquee-frame pointer-events-none absolute"
      style={{
        left,
        top,
        width,
        height,
        borderRadius: marquee.form === "rect" ? "2px" : "50%",
      }}
    />
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 flex items-center justify-between">
        <span className="tape-counter">{label}</span>
        <span className="tape-counter opacity-70">{step < 1 ? value.toFixed(2) : Math.round(value)}</span>
      </span>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => v[0] != null && onChange(v[0])} />
    </label>
  );
}
