import { PIGMENTS } from "@/lib/oil/pigments";

export type ArtistPalette = {
  id: string;
  name: string;
  colors: string[];
};

/** Limited palettes drawn from each artist's typical tube set. */
export const ARTIST_PALETTES: ArtistPalette[] = [
  {
    id: "zorn",
    name: "Zorn",
    colors: ["#f3efe4", "#d4a04a", "#b33c2c", "#2b2a27"],
  },
  {
    id: "vangogh",
    name: "Van Gogh",
    colors: ["#f4ead0", "#e8c547", "#2f5c8f", "#1f6b4a", "#c43c2a", "#1c1a16"],
  },
  {
    id: "monet",
    name: "Monet",
    colors: ["#f6f3ea", "#d9c56b", "#3a7ca5", "#2e8b73", "#c45c6a", "#7aa3c7"],
  },
  {
    id: "rembrandt",
    name: "Rembrandt",
    colors: ["#efe6d0", "#c7923e", "#a24b2a", "#5c3317", "#8f1d24", "#1a1612"],
  },
  {
    id: "vermeer",
    name: "Vermeer",
    colors: ["#f2ecdc", "#e3c565", "#2c4a96", "#a24b2a", "#6b542e", "#c43a2a"],
  },
  {
    id: "turner",
    name: "Turner",
    colors: ["#f7f0dc", "#e8b31a", "#c7923e", "#c43a2a", "#3a5a7a", "#6b542e"],
  },
  {
    id: "sargent",
    name: "Sargent",
    colors: ["#f4eee4", "#c7923e", "#a24b2a", "#2c4a96", "#1f7a5c", "#1c1a17"],
  },
  {
    id: "cezanne",
    name: "Cézanne",
    colors: ["#f0ead8", "#c7923e", "#2c4a96", "#1f7a5c", "#c43a2a", "#3a5a7a"],
  },
  {
    id: "matisse",
    name: "Matisse",
    colors: ["#f4eee4", "#e8b31a", "#c43a2a", "#2c4a96", "#1f7a5c", "#1c1a17"],
  },
  {
    id: "klimt",
    name: "Klimt",
    colors: ["#f4e4b8", "#c9a227", "#c43a2a", "#1f7a5c", "#5c3317", "#1c1a17"],
  },
  {
    id: "hopper",
    name: "Hopper",
    colors: ["#f2ebe0", "#c7923e", "#c43a2a", "#3a7ca5", "#8a8a84", "#1c1a17"],
  },
  {
    id: "okeeffe",
    name: "O'Keeffe",
    colors: ["#f7f3ea", "#e3c565", "#8f1d38", "#1f7a5c", "#2c4a96", "#1c1a17"],
  },
  {
    id: "hokusai",
    name: "Hokusai",
    colors: ["#f4eee4", "#1f4e79", "#3a7ca5", "#c43a2a", "#c7923e", "#1c1a17"],
  },
  {
    id: "caravaggio",
    name: "Caravaggio",
    colors: ["#efe6d0", "#c7923e", "#a24b2a", "#5c3317", "#c43a2a", "#141210"],
  },
  {
    id: "goya",
    name: "Goya",
    colors: ["#ece4d4", "#c7923e", "#8f1d24", "#5c3317", "#6b542e", "#161412"],
  },
  {
    id: "cassatt",
    name: "Cassatt",
    colors: ["#f7f1ea", "#e8c4b8", "#d48a7a", "#3a7ca5", "#e3c565", "#1f7a5c"],
  },
  {
    id: "seurat",
    name: "Seurat",
    colors: ["#f4eee4", "#e8b31a", "#c45c2a", "#c43a2a", "#6b3a8f", "#2c4a96", "#1f7a5c"],
  },
  {
    id: "rothko",
    name: "Rothko",
    colors: ["#f0d9b5", "#c45c2a", "#8f1d24", "#5c1a16", "#c7923e", "#1a1210"],
  },
  {
    id: "basquiat",
    name: "Basquiat",
    colors: ["#f4eee4", "#e8b31a", "#c43a2a", "#2c4a96", "#e8c4a8", "#141414"],
  },
  {
    id: "kahlo",
    name: "Kahlo",
    colors: ["#f4eee4", "#c43a2a", "#1f7a5c", "#e8b31a", "#2c4a96", "#5c3317"],
  },
  {
    id: "picasso",
    name: "Picasso",
    colors: ["#ece6d8", "#2c4a7a", "#c4b48a", "#8a1c24", "#4a6b8a", "#1c1a16"],
  },
  {
    id: "degas",
    name: "Degas",
    colors: ["#f4eadc", "#e8b4c4", "#c45c6a", "#7aa3c7", "#e3c565", "#5c4a3a"],
  },
  {
    id: "whistler",
    name: "Whistler",
    colors: ["#e8e4dc", "#8a9aaa", "#5c6b78", "#c4b49a", "#3a4450", "#1a1c20"],
  },
  {
    id: "titian",
    name: "Titian",
    colors: ["#f0e4cc", "#c45c2a", "#8f1d24", "#c7923e", "#1f5c4a", "#2a1810"],
  },
  {
    id: "botticelli",
    name: "Botticelli",
    colors: ["#f7f1e4", "#e8c4a8", "#c45c6a", "#3a7ca5", "#d9c56b", "#1f6b4a"],
  },
  {
    id: "raphael",
    name: "Raphael",
    colors: ["#f4ead8", "#c43a2a", "#2c4a96", "#e3c565", "#1f7a5c", "#5c3317"],
  },
  {
    id: "manet",
    name: "Manet",
    colors: ["#f2ebe0", "#1c1a17", "#c43a2a", "#3a7ca5", "#c7923e", "#8a8a84"],
  },
  {
    id: "munch",
    name: "Munch",
    colors: ["#f0d9c4", "#c43a2a", "#3a5a7a", "#e8b31a", "#6b3a8f", "#1c1410"],
  },
  {
    id: "dali",
    name: "Dalí",
    colors: ["#f4ead0", "#e8b31a", "#c45c2a", "#3a7ca5", "#1f6b4a", "#141210"],
  },
  {
    id: "bacon",
    name: "Bacon",
    colors: ["#e8dcc8", "#8f1d24", "#c45c2a", "#5c3317", "#3a2a24", "#120e0c"],
  },
  {
    id: "schiele",
    name: "Schiele",
    colors: ["#f0e4d4", "#c45c2a", "#8f1d38", "#c7923e", "#5c4a3a", "#1a1410"],
  },
  {
    id: "morandi",
    name: "Morandi",
    colors: ["#ece6dc", "#c4b8a8", "#8a8478", "#b8a090", "#6b645c", "#3a3834"],
  },
  {
    id: "bonnard",
    name: "Bonnard",
    colors: ["#f7f0dc", "#e8b31a", "#c45c6a", "#3a7ca5", "#1f7a5c", "#6b3a8f"],
  },
  {
    id: "kandinsky",
    name: "Kandinsky",
    colors: ["#f4eee4", "#c43a2a", "#2c4a96", "#e8b31a", "#1f7a5c", "#6b3a8f"],
  },
  {
    id: "mondrian",
    name: "Mondrian",
    colors: ["#f4f1e8", "#c43a2a", "#2c4a96", "#e8b31a", "#1c1a17"],
  },
  {
    id: "warhol",
    name: "Warhol",
    colors: ["#f4eee4", "#e8003d", "#e8b31a", "#2d5bff", "#00c896", "#1c1a17"],
  },
  {
    id: "hockney",
    name: "Hockney",
    colors: ["#f7f3ea", "#2d5bff", "#7ec8e3", "#e8b31a", "#c43a2a", "#1f7a5c"],
  },
  {
    id: "klein",
    name: "Klein",
    colors: ["#f4eee4", "#002fa7", "#1c1a17", "#e8e4dc"],
  },
  {
    id: "hiroshige",
    name: "Hiroshige",
    colors: ["#f4eee4", "#1f4e79", "#c43a2a", "#e3c565", "#1f6b4a", "#1c1a17"],
  },
  {
    id: "bosch",
    name: "Bosch",
    colors: ["#efe6d0", "#1f6b4a", "#c43a2a", "#e8b31a", "#3a5a7a", "#2a1810"],
  },
  {
    id: "delacroix",
    name: "Delacroix",
    colors: ["#efe6d0", "#8f1d24", "#c7923e", "#2c4a96", "#1f5c4a", "#1a1210"],
  },
];

export const THEME_PALETTES: ArtistPalette[] = [
  {
    id: "nocturne",
    name: "Nocturne",
    colors: ["#0e1420", "#1c2a44", "#3a5a7a", "#c4b49a", "#8a9aaa", "#e8e4dc"],
  },
  {
    id: "ember",
    name: "Ember",
    colors: ["#1a0c08", "#5c1a16", "#c45c2a", "#e8b31a", "#8f1d24", "#f0d9b5"],
  },
  {
    id: "fog",
    name: "Fog",
    colors: ["#d8dee4", "#b4bcc4", "#8a949c", "#5c6670", "#f4f1ea", "#3a4248"],
  },
  {
    id: "sea",
    name: "Sea",
    colors: ["#e8f0ec", "#7aa3c7", "#1f5c6b", "#2e8b73", "#c7923e", "#0e1c22"],
  },
  {
    id: "dust",
    name: "Dust",
    colors: ["#f0e4cc", "#c7923e", "#a24b2a", "#8a7a5c", "#5c3317", "#2a1c12"],
  },
  {
    id: "ink",
    name: "Ink",
    colors: ["#f4eee4", "#1a1612", "#1f4e79", "#8f1d24", "#c7923e", "#4a4a48"],
  },
  {
    id: "ivory",
    name: "Ivory",
    colors: ["#fbf7ee", "#f0e4cc", "#e8c4b8", "#d4c4a8", "#c4b49a", "#6b645c"],
  },
  {
    id: "moss",
    name: "Moss",
    colors: ["#e8ead8", "#4a6b32", "#1f6b4a", "#6b542e", "#c7923e", "#1c1a16"],
  },
  {
    id: "wine",
    name: "Wine",
    colors: ["#f4ead8", "#6b1224", "#8f1d38", "#c7923e", "#5c3317", "#1a1010"],
  },
  {
    id: "copper",
    name: "Copper",
    colors: ["#f0e4d4", "#b87333", "#2e8b73", "#5c3317", "#c45c2a", "#1c1410"],
  },
  {
    id: "twilight",
    name: "Twilight",
    colors: ["#1a1028", "#3a2a5c", "#6b3a8f", "#c45c6a", "#e8c4a8", "#7aa3c7"],
  },
  {
    id: "bone",
    name: "Bone",
    colors: ["#f4eee4", "#e4d8c4", "#c4b8a4", "#8a8478", "#5c564c", "#2a2824"],
  },
  {
    id: "north",
    name: "North",
    colors: ["#eef2f4", "#b8c8d4", "#5c7a8a", "#2c4a5c", "#c4b49a", "#1a2428"],
  },
  {
    id: "desert",
    name: "Desert",
    colors: ["#f7ecd4", "#e3c565", "#c7923e", "#a24b2a", "#7aa3c7", "#5c3317"],
  },
  {
    id: "indigo",
    name: "Indigo",
    colors: ["#f0ecf4", "#2d1b69", "#7b2fff", "#2d5bff", "#7ec8e3", "#0b1020"],
  },
  {
    id: "coral",
    name: "Coral",
    colors: ["#f7f1ea", "#e07a5f", "#c43a2a", "#3a7ca5", "#e3c565", "#1f6b4a"],
  },
];

export const JESTR_PALETTE: ArtistPalette = {
  id: "jestr",
  name: "JestR",
  colors: ["#7EC8E3", "#E8003D", "#00C896", "#7B2FFF"],
};

export const TUBE_PALETTE: ArtistPalette = {
  id: "tubes",
  name: "Tubes",
  colors: PIGMENTS.map((p) => p.hex),
};

export const FUN_PALETTES: ArtistPalette[] = [
  {
    id: "neon",
    name: "Neon",
    colors: ["#ffffff", "#ff2bd6", "#39ff14", "#00f0ff", "#f5ff00", "#ff3b00", "#7b2fff", "#0a0a12"],
  },
  {
    id: "phosphor",
    name: "Phosphor",
    colors: ["#e8fff4", "#7ec8e3", "#00c896", "#7b2fff", "#2d5bff", "#e8003d", "#0b1020"],
  },
  {
    id: "vapor",
    name: "Vapor",
    colors: ["#ff71ce", "#01cdfe", "#05ffa1", "#b967ff", "#fffb96", "#201040"],
  },
  {
    id: "acid",
    name: "Acid",
    colors: ["#ccff00", "#ff00aa", "#00ffc8", "#ff5e00", "#7b2fff", "#1a0033"],
  },
  {
    id: "uv",
    name: "UV",
    colors: ["#d4bfff", "#c77dff", "#7b2fff", "#ff00ff", "#00e5ff", "#120024"],
  },
  {
    id: "holo",
    name: "Holo",
    colors: ["#ff9ecd", "#a0e9ff", "#d4ff9a", "#c9b6ff", "#fff4d6", "#1a1230"],
  },
  {
    id: "plasma",
    name: "Plasma",
    colors: ["#ff006e", "#8338ec", "#3a86ff", "#fb5607", "#ffbe0b", "#0d0221"],
  },
  {
    id: "cyber",
    name: "Cyber",
    colors: ["#00ff9f", "#00b8ff", "#ff2a6d", "#d1faff", "#fffb96", "#050814"],
  },
  {
    id: "galaxy",
    name: "Galaxy",
    colors: ["#0b1026", "#7b2fff", "#ff6ec7", "#00c2ff", "#f4ead0", "#2d1b69"],
  },
  {
    id: "candy",
    name: "Candy",
    colors: ["#ff4d6d", "#ff85a1", "#ffc2d1", "#c77dff", "#7b2fff", "#fff0f5"],
  },
  {
    id: "tropic",
    name: "Tropic",
    colors: ["#ff6b6b", "#ffe66d", "#4ecdc4", "#1a535c", "#ff9f1c", "#f7fff7"],
  },
  {
    id: "ice",
    name: "Ice",
    colors: ["#e0f7ff", "#90e0ef", "#00b4d8", "#0077b6", "#03045e", "#caf0f8"],
  },
  {
    id: "magma",
    name: "Magma",
    colors: ["#2b0000", "#9d0208", "#e85d04", "#faa307", "#ffba08", "#6a040f"],
  },
  {
    id: "solar",
    name: "Solar",
    colors: ["#fff6e0", "#ffb703", "#fb8500", "#d62828", "#023047", "#8ecae6"],
  },
];

export const ALL_PALETTES: ArtistPalette[] = [JESTR_PALETTE, TUBE_PALETTE, ...THEME_PALETTES, ...ARTIST_PALETTES];

const ACTIVE_KEY = "sfumato:palette-id:v1";

export function loadActivePaletteId(): string {
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    if (v && ALL_PALETTES.some((p) => p.id === v)) return v;
  } catch {
    /* private mode */
  }
  return TUBE_PALETTE.id;
}

export function saveActivePaletteId(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* quota / private mode */
  }
}


const MINE_KEY = "sfumato:mine:v1";
const MINE_LIMIT = 48;

function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function loadMine(): string[] {
  try {
    const raw = localStorage.getItem(MINE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHex).slice(0, MINE_LIMIT);
  } catch {
    return [];
  }
}

export function saveMine(colors: string[]) {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(colors.filter(isHex).slice(0, MINE_LIMIT)));
  } catch {
    /* quota / private mode */
  }
}

export function addMineColor(colors: string[], hex: string): string[] {
  const h = hex.toLowerCase();
  if (colors.some((c) => c.toLowerCase() === h)) return colors;
  if (colors.length >= MINE_LIMIT) return [...colors.slice(1), h];
  return [...colors, h];
}

const CUSTOM_KEY = "sfumato:palettes:v1";
const CUSTOM_LIMIT = 16;

export function loadCustomPalettes(): ArtistPalette[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ArtistPalette[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const rec = item as { id?: unknown; name?: unknown; colors?: unknown };
      if (typeof rec.id !== "string" || typeof rec.name !== "string" || !Array.isArray(rec.colors)) continue;
      const colors = rec.colors.filter(isHex).slice(0, MINE_LIMIT);
      if (colors.length === 0) continue;
      out.push({ id: rec.id, name: rec.name, colors });
      if (out.length >= CUSTOM_LIMIT) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function saveCustomPalettes(palettes: ArtistPalette[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(palettes.slice(0, CUSTOM_LIMIT)));
  } catch {
    /* quota / private mode */
  }
}

export function addCustomPalette(existing: ArtistPalette[], colors: string[]): ArtistPalette[] {
  const cols = colors.filter(isHex).map((c) => c.toLowerCase());
  const unique = cols.filter((c, i) => cols.indexOf(c) === i).slice(0, MINE_LIMIT);
  if (unique.length === 0) return existing;
  const same = existing.find((p) => p.colors.length === unique.length && p.colors.every((c, i) => c === unique[i]));
  if (same) return existing;
  let n = existing.length + 1;
  let name = `Set ${n}`;
  const taken = new Set(existing.map((p) => p.name));
  while (taken.has(name)) {
    n += 1;
    name = `Set ${n}`;
  }
  const next: ArtistPalette = { id: `set-${Date.now().toString(36)}`, name, colors: unique };
  const list = [...existing, next];
  return list.length > CUSTOM_LIMIT ? [...list.slice(list.length - CUSTOM_LIMIT)] : list;
}

export function removeCustomPalette(existing: ArtistPalette[], id: string): ArtistPalette[] {
  return existing.filter((p) => p.id !== id);
}

export function addColorToPalette(existing: ArtistPalette[], id: string, hex: string): ArtistPalette[] {
  const h = hex.toLowerCase();
  if (!isHex(h)) return existing;
  return existing.map((p) => {
    if (p.id !== id) return p;
    if (p.colors.some((c) => c.toLowerCase() === h)) return p;
    return { ...p, colors: [...p.colors, h].slice(0, MINE_LIMIT) };
  });
}
