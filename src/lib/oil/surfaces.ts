export type GroundId = "linen" | "paper" | "raw" | "slate" | "glass" | "night" | "wood";
export type Grain = "weave" | "frost" | "wood" | "flat" | "paper";

export type Ground = {
  id: GroundId;
  name: string;
  rgb: [number, number, number];
  grain: Grain;
  vig: number;
  shine: number;
};

export const GROUNDS: Ground[] = [
  { id: "linen", name: "Linen", rgb: [239, 230, 210], grain: "weave", vig: 0.055, shine: 0 },
  { id: "paper", name: "Paper", rgb: [248, 246, 240], grain: "paper", vig: 0.03, shine: 0 },
  { id: "raw", name: "Raw", rgb: [210, 168, 110], grain: "weave", vig: 0.06, shine: 0 },
  { id: "slate", name: "Slate", rgb: [58, 62, 78], grain: "flat", vig: 0.08, shine: 0.04 },
  { id: "glass", name: "Glass", rgb: [20, 18, 56], grain: "frost", vig: 0.1, shine: 0.14 },
  { id: "night", name: "Night", rgb: [10, 10, 16], grain: "flat", vig: 0.12, shine: 0.05 },
  { id: "wood", name: "Walnut", rgb: [92, 64, 40], grain: "wood", vig: 0.08, shine: 0 },
];

const GROUND_MAP = Object.fromEntries(GROUNDS.map((g) => [g.id, g])) as Record<GroundId, Ground>;

export function groundOf(id: GroundId): Ground {
  return GROUND_MAP[id] ?? GROUND_MAP.linen;
}

export function isGroundId(v: unknown): v is GroundId {
  return typeof v === "string" && v in GROUND_MAP;
}

export const CANVAS_PRESETS = [
  { id: "studio", name: "Studio", w: 2400, h: 1800 },
  { id: "square", name: "Square", w: 1440, h: 1440 },
  { id: "portrait", name: "Portrait", w: 1440, h: 1920 },
  { id: "wide", name: "Wide", w: 1920, h: 1080 },
  { id: "panel", name: "Panel", w: 2560, h: 1440 },
  { id: "sketch", name: "Sketch", w: 1280, h: 960 },
] as const;

export type PresetId = (typeof CANVAS_PRESETS)[number]["id"];

export function isPresetId(v: unknown): v is PresetId {
  return typeof v === "string" && CANVAS_PRESETS.some((p) => p.id === v);
}

export function presetOf(id: PresetId) {
  return CANVAS_PRESETS.find((p) => p.id === id) ?? CANVAS_PRESETS[0];
}

export function matchPreset(w: number, h: number): PresetId | null {
  const hit = CANVAS_PRESETS.find((p) => p.w === w && p.h === h);
  return hit?.id ?? null;
}
