import { useEffect, useState, type FormEvent } from "react";
import { Download, FolderOpen, Images, Trash2, X } from "lucide-react";
import { deleteSave, getSave, listSaves, markOffered, putSave, type LocalSave } from "@/lib/saves";
import {
  blobToDataUrl,
  dataUrlToBlob,
  downloadBlob,
  saveToLocalFolder,
  safeFileStem,
  TRAVELLER_TERM_CLOSE,
  TRAVELLER_TERM_LEAD,
  TRAVELLER_TERM_POINTS,
  type TravellerCard,
} from "@/lib/travellers";
import {
  getTravellerFile,
  listInbox,
  listShownTravellers,
  publishTraveller,
  setTravellerStatus,
} from "@/lib/travellers-api";
import { cn } from "@/lib/utils";

type Tab = "gallery" | "saves" | "offer" | "review";

type Props = {
  open: boolean;
  onClose: () => void;
  canvasBlob: () => Promise<Blob | null>;
  savesEpoch?: number;
};

export function TravellersDesk({ open, onClose, canvasBlob, savesEpoch = 0 }: Props) {
  const [tab, setTab] = useState<Tab>("gallery");
  const [shown, setShown] = useState<TravellerCard[]>([]);
  const [inbox, setInbox] = useState<TravellerCard[]>([]);
  const [saves, setSaves] = useState<LocalSave[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [key, setKey] = useState(() => sessionStorage.getItem("sfumato-archive-key") ?? "");
  const [unlocked, setUnlocked] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshSaves = async () => {
    try {
      setSaves(await listSaves());
    } catch {
      setSaves([]);
    }
  };

  const loadGallery = async () => {
    try {
      setShown(await listShownTravellers());
    } catch {
      setShown([]);
    }
  };

  const loadInbox = async (phrase: string) => {
    const rows = await listInbox({ data: { key: phrase } });
    setInbox(rows);
    setUnlocked(true);
    sessionStorage.setItem("sfumato-archive-key", phrase);
  };

  useEffect(() => {
    if (!open) return;
    void loadGallery();
    void refreshSaves();
    if (key) void loadInbox(key).catch(() => setUnlocked(false));
  }, [open, savesEpoch]);

  if (!open) return null;

  return (
    <div className="travellers-layer">
      <button type="button" className="travellers-scrim" aria-label="Close travellers" onClick={onClose} />
      <div className="orbit-win travellers-win" role="dialog" aria-labelledby="travellers-title">
        <div className="win-bar">
          <div className="win-bar-left">
            <Images className="win-grip" aria-hidden />
            <span className="win-title" id="travellers-title">
              Travellers
            </span>
            <span className="tape-counter opacity-70">On this device</span>
          </div>
          <button type="button" className="analog-btn analog-round analog-mini" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <div className="win-body flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div className="orbit-tabs">
            {(["gallery", "saves", "offer", "review"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={cn("orbit-tab", tab === t && "is-on")}
                onClick={() => setTab(t)}
              >
                {t === "gallery" ? "Gallery" : t === "saves" ? "Saves" : t === "offer" ? "Offer" : "Review"}
              </button>
            ))}
          </div>
          {status ? <p className="tape-counter">{status}</p> : null}
          {tab === "gallery" ? (
            <Gallery shown={shown} onOpen={loadGallery} />
          ) : tab === "saves" ? (
            <SavesDesk
              saves={saves}
              busy={busy}
              onBusy={setBusy}
              onStatus={setStatus}
              onRefresh={refreshSaves}
              canvasBlob={canvasBlob}
              onOffer={(id) => {
                setPicked(id);
                setTab("offer");
              }}
            />
          ) : tab === "offer" ? (
            <OfferForm
              saves={saves}
              picked={picked}
              onPicked={setPicked}
              busy={busy}
              onBusy={setBusy}
              onStatus={setStatus}
              onRefresh={refreshSaves}
            />
          ) : (
            <ReviewDesk
              keyValue={key}
              onKey={setKey}
              unlocked={unlocked}
              inbox={inbox}
              busy={busy}
              onBusy={setBusy}
              onStatus={setStatus}
              onUnlock={async (phrase) => {
                setBusy(true);
                try {
                  await loadInbox(phrase);
                  setStatus("Inbox open");
                } catch {
                  setUnlocked(false);
                  setStatus("Wrong archive key");
                } finally {
                  setBusy(false);
                }
              }}
              onRefresh={() => loadInbox(key)}
              onPublished={loadGallery}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Gallery({ shown, onOpen }: { shown: TravellerCard[]; onOpen: () => void }) {
  const [full, setFull] = useState<string | null>(null);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {shown.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm leading-6 text-muted italic">
          No travellers on the wall yet. Save a painting on this device, then offer it.
        </p>
      ) : (
        <div className="traveller-grid">
          {shown.map((card) => (
            <button
              key={card.id}
              type="button"
              className="traveller-tile"
              onClick={async () => {
                try {
                  const file = await getTravellerFile({ data: { id: card.id } });
                  setFull(file.image);
                } catch {
                  onOpen();
                }
              }}
            >
              <img src={card.thumb} alt="" className="traveller-thumb" />
              <span className="traveller-meta">
                <span className="truncate font-extrabold italic">{card.title}</span>
                <span className="tape-counter truncate">{card.handle}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {full ? (
        <button type="button" className="traveller-lightbox" onClick={() => setFull(null)}>
          <img src={full} alt="Traveller work" />
        </button>
      ) : null}
    </div>
  );
}

function SavesDesk({
  saves,
  busy,
  onBusy,
  onStatus,
  onRefresh,
  canvasBlob,
  onOffer,
}: {
  saves: LocalSave[];
  busy: boolean;
  onBusy: (v: boolean) => void;
  onStatus: (s: string | null) => void;
  onRefresh: () => Promise<unknown>;
  canvasBlob: () => Promise<Blob | null>;
  onOffer: (id: string) => void;
}) {
  const saveCanvas = async () => {
    onBusy(true);
    try {
      const blob = await canvasBlob();
      if (!blob) {
        onStatus("Paint something first");
        return;
      }
      await putSave(blob, "Sfumato");
      await onRefresh();
      onStatus("Saved on this device");
    } catch {
      onStatus("Could not save");
    } finally {
      onBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <p className="text-sm leading-6 text-fg">
        Paintings live in a folder on this device only. jestR never sees them until you offer one.
      </p>
      <button type="button" className="analog-btn analog-chip" disabled={busy} onClick={() => void saveCanvas()}>
        Save this canvas
      </button>
      {saves.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted italic">Empty. Hit Save in the dock, or save this canvas.</p>
      ) : (
        <div className="traveller-grid">
          {saves.map((s) => (
            <article key={s.id} className="traveller-tile">
              <img src={s.thumb} alt="" className="traveller-thumb" />
              <span className="traveller-meta">
                <span className="truncate font-extrabold italic">{s.title}</span>
                <span className="tape-counter truncate">
                  {s.offeredAt ? "Offered" : new Date(s.createdAt).toLocaleDateString()}
                </span>
              </span>
              <div className="flex flex-wrap gap-1 p-2 pt-0">
                <button type="button" className="analog-btn analog-chip flex-1" onClick={() => onOffer(s.id)}>
                  Offer
                </button>
                <button
                  type="button"
                  className="analog-btn analog-chip"
                  aria-label="Download"
                  onClick={() => downloadBlob(s.blob, `${safeFileStem("sfumato", s.title, s.id)}.png`)}
                >
                  <Download className="size-4" />
                </button>
                <button
                  type="button"
                  className="analog-btn analog-chip"
                  aria-label="Delete save"
                  onClick={() => void deleteSave(s.id).then(onRefresh)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function OfferForm({
  saves,
  picked,
  onPicked,
  busy,
  onBusy,
  onStatus,
  onRefresh,
}: {
  saves: LocalSave[];
  picked: string | null;
  onPicked: (id: string | null) => void;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onStatus: (s: string | null) => void;
  onRefresh: () => Promise<unknown>;
}) {
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const chosen = saves.find((s) => s.id === picked) ?? null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consent) {
      onStatus("Consent is required");
      return;
    }
    const save = picked ? await getSave(picked) : null;
    if (!save) {
      onStatus("Save a painting in Sfumato first");
      return;
    }
    onBusy(true);
    onStatus("Preparing offer…");
    try {
      const stem = safeFileStem(handle.trim() || "traveller", save.title, save.id);
      const meta = new Blob(
        [
          JSON.stringify(
            {
              origin: "sfumato",
              handle: handle.trim(),
              title: save.title,
              note: note.trim(),
              consent: true,
              consentAt: new Date().toISOString(),
              savedAt: new Date(save.createdAt).toISOString(),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const png = new File([save.blob], `${stem}.png`, { type: "image/png" });
      const json = new File([meta], `${stem}.json`, { type: "application/json" });
      const nav = navigator as Navigator & {
        share?: (data: ShareData & { files?: File[] }) => Promise<void>;
        canShare?: (data: { files?: File[] }) => boolean;
      };
      if (nav.share && nav.canShare?.({ files: [png, json] })) {
        await nav.share({
          title: `${save.title} — Sfumato offer`,
          text: "Sfumato traveller offer. Stays off the server until jestR hangs it.",
          files: [png, json],
        });
      } else {
        downloadBlob(png, png.name);
        downloadBlob(json, json.name);
      }
      await markOffered(save.id);
      await onRefresh();
      setConsent(false);
      onStatus("Offer left this device. Nothing was stored on jestR’s server.");
    } catch (err) {
      if ((err as Error).name === "AbortError") onStatus(null);
      else onStatus("Could not share. Try download from Saves.");
    } finally {
      onBusy(false);
    }
  };

  return (
    <form className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" onSubmit={(e) => void submit(e)}>
      <p className="text-sm leading-6 text-fg">
        Only paintings saved in Sfumato on this device can be offered. Camera roll and random files are blocked.
      </p>
      {saves.length === 0 ? (
        <p className="rounded-xl bg-raised px-3 py-4 text-sm leading-6 text-fg">
          No local saves yet. Paint, hit Save, then come back. The file stays on this iPad or phone.
        </p>
      ) : (
        <div className="traveller-grid">
          {saves.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cn("traveller-tile text-left", picked === s.id && "is-picked")}
              onClick={() => onPicked(s.id)}
            >
              <img src={s.thumb} alt="" className="traveller-thumb" />
              <span className="traveller-meta">
                <span className="truncate font-extrabold italic">{s.title}</span>
                <span className="tape-counter truncate">{picked === s.id ? "Selected" : "Tap to offer"}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <label className="block">
        <span className="tape-counter">Handle</span>
        <input
          required
          maxLength={48}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          className="offer-input"
          placeholder="Public name on the work"
        />
      </label>
      <label className="block">
        <span className="tape-counter">Note</span>
        <textarea
          maxLength={400}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="offer-input min-h-16"
          placeholder="Optional, about the piece"
        />
      </label>
      <section className="terms-box allow-select" aria-label="Terms">
        <h2 className="terms-kicker">Terms</h2>
        <p className="terms-lead">{TRAVELLER_TERM_LEAD}</p>
        <ol className="terms-list">
          {TRAVELLER_TERM_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ol>
        <p className="terms-lead">{TRAVELLER_TERM_CLOSE}</p>
      </section>
      <label className="flex items-start gap-3 text-sm leading-6 text-fg">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--jestr-purple)]"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        <span>
          I have read the terms. I consent to jestR posting this, keeping it, archiving it, and using it freely in
          collaboration on this free site.
        </span>
      </label>
      <button type="submit" className="analog-btn analog-chip w-full" disabled={busy || !consent || !chosen}>
        Share offer from this device
      </button>
    </form>
  );
}

function ReviewDesk({
  keyValue,
  onKey,
  unlocked,
  inbox,
  busy,
  onBusy,
  onStatus,
  onUnlock,
  onRefresh,
  onPublished,
}: {
  keyValue: string;
  onKey: (s: string) => void;
  unlocked: boolean;
  inbox: TravellerCard[];
  busy: boolean;
  onBusy: (v: boolean) => void;
  onStatus: (s: string | null) => void;
  onUnlock: (phrase: string) => Promise<void>;
  onRefresh: () => Promise<unknown>;
  onPublished: () => Promise<unknown>;
}) {
  if (!unlocked) {
    return (
      <form
        className="flex flex-col gap-3 py-6"
        onSubmit={(e) => {
          e.preventDefault();
          void onUnlock(keyValue);
        }}
      >
        <p className="text-sm leading-6 text-fg">
          Archive key opens review. Visitor paintings are not stored here. Import a shared Sfumato offer to hang it.
        </p>
        <input
          className="offer-input"
          type="password"
          autoComplete="off"
          value={keyValue}
          onChange={(e) => onKey(e.target.value)}
          placeholder="Archive key"
        />
        <button type="submit" className="analog-btn analog-chip" disabled={busy || !keyValue}>
          Open inbox
        </button>
      </form>
    );
  }

  const shown = inbox.filter((c) => c.status === "shown");
  const held = inbox.filter((c) => c.status === "held");

  const importOffer = async (file: File) => {
    if (file.type && !file.type.startsWith("image/")) {
      onStatus("Need the Sfumato PNG");
      return;
    }
    onBusy(true);
    try {
      const image = await blobToDataUrl(file);
      const thumb = image;
      await publishTraveller({
        data: {
          key: keyValue,
          handle: "traveller",
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Sfumato",
          note: "",
          consent: true,
          mime: "image/png",
          image,
          thumb,
        },
      });
      await onRefresh();
      await onPublished();
      onStatus("Hung in the gallery");
    } catch {
      onStatus("Could not publish");
    } finally {
      onBusy(false);
    }
  };

  const filePack = async (card: TravellerCard) => {
    const file = await getTravellerFile({ data: { id: card.id, key: keyValue } });
    const stem = safeFileStem(card.handle, card.title, card.id);
    const ext = file.mime.includes("jpeg") ? "jpg" : file.mime.includes("webp") ? "webp" : "png";
    return [
      { name: `${stem}.${ext}`, blob: dataUrlToBlob(file.image) },
      {
        name: `${stem}.json`,
        blob: new Blob(
          [JSON.stringify({ id: card.id, handle: card.handle, title: card.title, note: card.note, consent: true }, null, 2)],
          { type: "application/json" },
        ),
      },
    ];
  };

  const saveFolder = async (cards: TravellerCard[]) => {
    onBusy(true);
    try {
      const files = (await Promise.all(cards.map(filePack))).flat();
      const how = await saveToLocalFolder(files);
      onStatus(how === "folder" ? "Saved to folder" : "Archive zip downloaded");
    } catch (err) {
      if ((err as Error).name === "AbortError") onStatus(null);
      else onStatus("Could not save");
    } finally {
      onBusy(false);
    }
  };

  const setStatus = async (id: string, status: "shown" | "held" | "pending") => {
    onBusy(true);
    try {
      await setTravellerStatus({ data: { key: keyValue, id, status } });
      await onRefresh();
    } catch {
      onStatus("Could not update");
    } finally {
      onBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <label className="analog-btn analog-chip">
        Import Sfumato PNG
        <input
          type="file"
          accept="image/png"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importOffer(file);
            e.currentTarget.value = "";
          }}
        />
      </label>
      <p className="text-sm leading-6 text-fg">
        Visitors keep files on their device. Import what they share, then it hangs in the public gallery.
      </p>
      <button type="button" className="analog-btn analog-chip" disabled={busy || inbox.length === 0} onClick={() => void saveFolder(inbox)}>
        <FolderOpen className="size-4" />
        Save gallery to folder
      </button>
      {shown.length + held.length === 0 ? <p className="py-6 text-center text-sm text-muted italic">Nothing hung yet.</p> : null}
      {[...shown, ...held].map((card) => (
        <article key={card.id} className="review-row">
          <img src={card.thumb} alt="" className="review-thumb" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold italic leading-tight">{card.title}</p>
            <p className="tape-counter truncate">{card.handle}</p>
          </div>
          <button type="button" className="analog-btn analog-chip" onClick={() => void setStatus(card.id, card.status === "held" ? "shown" : "held")}>
            {card.status === "held" ? "Show" : "Hold"}
          </button>
        </article>
      ))}
    </div>
  );
}
