export const TRAVELLER_TERM_LEAD =
  "Sfumato / Orbit is a free site by jestR. Only paintings saved in Sfumato on this device can be offered. By offering a work you confirm:";

export const TRAVELLER_TERM_POINTS = [
  "You made this in Sfumato, or you have the right to offer it.",
  "You consent to jestR posting this work online, leaving it there, and adding it to the archive of travellers.",
  "You grant jestR a perpetual, worldwide, royalty-free license to use, display, reproduce, crop, adapt, and share this work in any medium — including the Orbit / Sfumato gallery, social posts, prints, and future collaborative editions.",
  "No payment is due. This is a collaboration, not a sale, commission, or employment.",
  "jestR has free control to show, hold, edit presentation of, or decline any offer without notice.",
  "You will not offer illegal work, hate, or any sexual content involving minors.",
];

export const TRAVELLER_TERM_CLOSE =
  "Checking the box is your signature. The painting stays on this device until you share or download the offer. jestR does not keep a copy until he hangs it in the gallery.";

export const TRAVELLER_TERMS = [TRAVELLER_TERM_LEAD, ...TRAVELLER_TERM_POINTS.map((p, i) => `${i + 1}. ${p}`), TRAVELLER_TERM_CLOSE].join(
  "\n\n",
);

export type TravellerStatus = "pending" | "shown" | "held";

export type TravellerCard = {
  id: string;
  createdAt: string;
  handle: string;
  title: string;
  note: string;
  mime: string;
  thumb: string;
  status: TravellerStatus;
};

export function safeFileStem(handle: string, title: string, id: string) {
  const base = `${handle}-${title}-${id.slice(0, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return base || id.slice(0, 12);
}

export function dataUrlToBlob(dataUrl: string) {
  const [head, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/png";
  const bin = atob(body ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function makeThumb(dataUrl: string, max = 480) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("thumb"));
  });
  img.src = dataUrl;
  await loaded;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.78);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  b[0] = n & 255;
  b[1] = (n >>> 8) & 255;
  return b;
}

function u32(n: number) {
  const b = new Uint8Array(4);
  b[0] = n & 255;
  b[1] = (n >>> 8) & 255;
  b[2] = (n >>> 16) & 255;
  b[3] = (n >>> 24) & 255;
  return b;
}

export function zipStore(files: { name: string; data: Uint8Array }[]) {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    local.set([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    local.set(u32(crc), 14);
    local.set(u32(file.data.length), 18);
    local.set(u32(file.data.length), 22);
    local.set(u16(name.length), 26);
    local.set(name, 30);
    parts.push(local, file.data);
    const dir = new Uint8Array(46 + name.length);
    dir.set([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    dir.set(u32(crc), 16);
    dir.set(u32(file.data.length), 20);
    dir.set(u32(file.data.length), 24);
    dir.set(u16(name.length), 28);
    dir.set(u32(offset), 42);
    dir.set(name, 46);
    central.push(dir);
    offset += local.length + file.data.length;
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) {
    parts.push(c);
    centralSize += c.length;
  }
  const end = new Uint8Array(22);
  end.set([0x50, 0x4b, 0x05, 0x06]);
  end.set(u16(files.length), 8);
  end.set(u16(files.length), 10);
  end.set(u32(centralSize), 12);
  end.set(u32(centralStart), 16);
  parts.push(end);
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return new Blob([out], { type: "application/zip" });
}

export async function saveToLocalFolder(
  files: { name: string; blob: Blob }[],
): Promise<"folder" | "zip"> {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (opts: { mode: string }) => Promise<{
        getFileHandle: (
          name: string,
          opts: { create: boolean },
        ) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
      }>;
    }
  ).showDirectoryPicker;
  if (typeof picker === "function") {
    const dir = await picker({ mode: "readwrite" });
    for (const file of files) {
      const handle = await dir.getFileHandle(file.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file.blob);
      await writable.close();
    }
    return "folder";
  }
  const packed = await Promise.all(
    files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })),
  );
  downloadBlob(zipStore(packed), "travellers-archive.zip");
  return "zip";
}
