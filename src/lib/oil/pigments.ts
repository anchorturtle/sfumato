export type Pigment = {
  id: string;
  name: string;
  hex: string;
};

/** Full studio tube rack — classic oils plus the JestR four. */
export const PIGMENTS: Pigment[] = [
  { id: "tw", name: "Titanium White", hex: "#f4f1e8" },
  { id: "zw", name: "Zinc White", hex: "#e8e4d8" },
  { id: "ny", name: "Naples Yellow", hex: "#e3c565" },
  { id: "cyl", name: "Cadmium Yellow Lt", hex: "#f2d12e" },
  { id: "cy", name: "Cadmium Yellow", hex: "#e8b31a" },
  { id: "yo", name: "Yellow Ochre", hex: "#c7923e" },
  { id: "iy", name: "Indian Yellow", hex: "#e09a1a" },
  { id: "co", name: "Cadmium Orange", hex: "#e36c1a" },
  { id: "cr", name: "Cadmium Red", hex: "#c43a2a" },
  { id: "vm", name: "Vermilion", hex: "#d64533" },
  { id: "al", name: "Alizarin", hex: "#8f1d38" },
  { id: "qm", name: "Quinacridone", hex: "#c2185b" },
  { id: "rm", name: "Rose Madder", hex: "#c45c6a" },
  { id: "ma", name: "Magenta", hex: "#e8003d" },
  { id: "dv", name: "Dioxazine", hex: "#4a1f6b" },
  { id: "cv", name: "Cobalt Violet", hex: "#7b2fff" },
  { id: "ul", name: "Ultramarine", hex: "#2c4a96" },
  { id: "cb", name: "Cobalt Blue", hex: "#2d5bff" },
  { id: "ce", name: "Cerulean", hex: "#3a7ca5" },
  { id: "bb", name: "Baby Blue", hex: "#7ec8e3" },
  { id: "pb", name: "Phthalo Blue", hex: "#0b3d91" },
  { id: "pr", name: "Prussian Blue", hex: "#1a2f5a" },
  { id: "vi", name: "Viridian", hex: "#1f7a5c" },
  { id: "pg", name: "Phthalo Green", hex: "#00c896" },
  { id: "sg", name: "Sap Green", hex: "#4a6b32" },
  { id: "tg", name: "Terre Verte", hex: "#5d6e4e" },
  { id: "rs", name: "Raw Sienna", hex: "#c0843c" },
  { id: "bs", name: "Burnt Sienna", hex: "#a24b2a" },
  { id: "ru", name: "Raw Umber", hex: "#6b542e" },
  { id: "bu", name: "Burnt Umber", hex: "#5c3317" },
  { id: "ib", name: "Ivory Black", hex: "#1c1a17" },
  { id: "lb", name: "Lamp Black", hex: "#0d0c0b" },
];

export function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  const v = Number.parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
