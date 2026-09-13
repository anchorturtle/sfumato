const DB_NAME = "sfumato-album";
const STORE = "saves";
const ORIGIN = "sfumato" as const;

export type LocalSave = {
  id: string;
  title: string;
  createdAt: number;
  mime: "image/png";
  blob: Blob;
  thumb: string;
  origin: typeof ORIGIN;
  offeredAt?: number;
};

function openAlbum(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function isSfumatoSave(v: unknown): v is LocalSave {
  if (!v || typeof v !== "object") return false;
  const s = v as LocalSave;
  return s.origin === ORIGIN && s.mime === "image/png" && s.blob instanceof Blob && typeof s.id === "string";
}

async function makeThumb(blob: Blob, max = 360) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("thumb"));
      img.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return url;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.76);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function putSave(blob: Blob, title = "Sfumato") {
  if (blob.type && blob.type !== "image/png") throw new Error("Only Sfumato PNG saves");
  const db = await openAlbum();
  try {
    const rec: LocalSave = {
      id: crypto.randomUUID(),
      title: title.trim().slice(0, 80) || "Sfumato",
      createdAt: Date.now(),
      mime: "image/png",
      blob,
      thumb: await makeThumb(blob),
      origin: ORIGIN,
    };
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    await txDone(tx);
    return rec;
  } finally {
    db.close();
  }
}

export async function listSaves(): Promise<LocalSave[]> {
  const db = await openAlbum();
  try {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as unknown[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return rows.filter(isSfumatoSave).sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

export async function getSave(id: string): Promise<LocalSave | null> {
  const db = await openAlbum();
  try {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    const row = await new Promise<unknown>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return isSfumatoSave(row) ? row : null;
  } finally {
    db.close();
  }
}

export async function deleteSave(id: string) {
  const db = await openAlbum();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function markOffered(id: string) {
  const rec = await getSave(id);
  if (!rec) return;
  rec.offeredAt = Date.now();
  const db = await openAlbum();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    await txDone(tx);
  } finally {
    db.close();
  }
}
