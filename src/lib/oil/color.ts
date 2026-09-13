/** sRGB 8-bit ↔ linear LUTs for smooth oil mixing. */

export const SRGB_TO_LINEAR = new Float32Array(256);
export const LINEAR_TO_SRGB = new Uint8Array(4096);

(function buildLuts() {
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  for (let i = 0; i < 4096; i++) {
    const c = i / 4095;
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    LINEAR_TO_SRGB[i] = Math.max(0, Math.min(255, Math.round(s * 255)));
  }
})();

export function linToByte(v: number): number {
  const i = v <= 0 ? 0 : v >= 1 ? 4095 : (v * 4095 + 0.5) | 0;
  return LINEAR_TO_SRGB[i]!;
}

export function rotateHueLin(r: number, g: number, b: number, turns: number): [number, number, number] {
  if (turns === 0) return [r, g, b];
  const a = turns * Math.PI * 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const i = 0.596 * r - 0.274 * g - 0.322 * b;
  const q = 0.211 * r - 0.523 * g + 0.312 * b;
  const i2 = i * cos - q * sin;
  const q2 = i * sin + q * cos;
  return [
    Math.max(0, y + 0.956 * i2 + 0.621 * q2),
    Math.max(0, y - 0.272 * i2 - 0.647 * q2),
    Math.max(0, y - 1.107 * i2 + 1.704 * q2),
  ];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max < 1e-6 ? 0 : d / max;
  return [h, s, max];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Volume-weighted mix in linear light — how oil actually combines. */
export function mixRgb(parts: { rgb: [number, number, number]; weight: number }[]): [number, number, number] | null {
  let r = 0,
    g = 0,
    b = 0,
    w = 0;
  for (const p of parts) {
    if (p.weight <= 0) continue;
    r += SRGB_TO_LINEAR[p.rgb[0]]! * p.weight;
    g += SRGB_TO_LINEAR[p.rgb[1]]! * p.weight;
    b += SRGB_TO_LINEAR[p.rgb[2]]! * p.weight;
    w += p.weight;
  }
  if (w < 1e-6) return null;
  return [linToByte(r / w), linToByte(g / w), linToByte(b / w)];
}
