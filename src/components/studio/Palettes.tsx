import { Plus, Save, X } from "lucide-react";
import { ColorPicker } from "@/components/studio/ColorPicker";
import { ARTIST_PALETTES, JESTR_PALETTE, THEME_PALETTES, type ArtistPalette } from "@/lib/oil/palettes";
import { PIGMENTS, rgbToHex } from "@/lib/oil/pigments";
import { startColorDrag } from "@/lib/color-drag";
import { cn } from "@/lib/utils";

type PickFn = (hex: string, pigmentId: string) => void;

export type { ColorDragDetail } from "@/lib/color-drag";

export function PaletteRail({
  color,
  mine,
  custom,
  onPick,
  onColor,
  onAddMine,
  onDeleteMine,
  onDeletePalette,
  onSavePalette,
  onAddToPalette,
  compact,
}: {
  color: [number, number, number];
  mine: string[];
  custom: ArtistPalette[];
  onPick: PickFn;
  onColor: (rgb: [number, number, number]) => void;
  onAddMine: () => void;
  onDeleteMine: () => void;
  onDeletePalette: (id: string) => void;
  onSavePalette?: (colors: string[]) => void;
  onAddToPalette?: (id: string) => void;
  compact?: boolean;
}) {
  const hex = rgbToHex(color[0], color[1], color[2]).toLowerCase();
  const selectedInMine = mine.some((c) => c.toLowerCase() === hex);

  return (
    <div className={cn("palette-board", compact && "is-compact")}>
      <ColorPicker color={color} onChange={onColor} compact />
      <div className="palette-save-row">
        <button type="button" className="analog-btn analog-chip" onClick={onAddMine} disabled={selectedInMine}>
          <Plus className="size-4" />
          Keep
        </button>
        <button
          type="button"
          className="analog-btn analog-chip analog-mini-wide"
          onClick={() => onSavePalette?.(mine.length ? mine : [hex])}
        >
          <Save className="size-4" />
          Save
        </button>
        <button
          type="button"
          className="analog-btn analog-round analog-mini"
          aria-label="Remove color from mine"
          disabled={!selectedInMine}
          onClick={onDeleteMine}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mine-bar">
        <p className="tape-counter min-w-0 flex-1">Mine</p>
      </div>
      <div className="color-wheel">
        <div className="color-wheel-track">
          {mine.map((c, i) => (
            <Swatch
              key={`${c}-${i}`}
              hex={c}
              label={`Mine ${i + 1}`}
              on={c.toLowerCase() === hex}
              className="tube-dot"
              onPick={() => onPick(c, `mine:${c}`)}
            />
          ))}
          <button type="button" className="tube-dot is-empty is-add" aria-label="Add color to mine" onClick={onAddMine}>
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      <div className="palette-list">
        <PaletteStrip palette={JESTR_PALETTE} hex={hex} onPick={onPick} featured />
        {custom.map((p) => (
          <PaletteStrip
            key={p.id}
            palette={p}
            hex={hex}
            onPick={onPick}
            onAdd={onAddToPalette ? () => onAddToPalette(p.id) : undefined}
            onDelete={() => onDeletePalette(p.id)}
          />
        ))}
        <p className="tape-counter">Tubes</p>
        <TubeRack hex={hex} onPick={onPick} scroll />
        <p className="tape-counter">Themes</p>
        {THEME_PALETTES.map((p) => (
          <PaletteStrip key={p.id} palette={p} hex={hex} onPick={onPick} />
        ))}
        <p className="tape-counter">Artists</p>
        {ARTIST_PALETTES.map((p) => (
          <PaletteStrip key={p.id} palette={p} hex={hex} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

export function TubeRack({
  hex,
  onPick,
  compact,
  scroll,
}: {
  hex: string;
  onPick: PickFn;
  compact?: boolean;
  scroll?: boolean;
}) {
  const selected = hex.toLowerCase();
  return (
    <div className={cn("tube-rack color-wheel", compact && "is-compact", scroll && "is-scroll")} role="listbox" aria-label="Paint tubes">
      <div className="color-wheel-track">
      {PIGMENTS.map((p) => (
        <Swatch
          key={p.id}
          hex={p.hex}
          label={p.name}
          on={p.hex.toLowerCase() === selected}
          className="tube-dot"
          onPick={() => onPick(p.hex, p.id)}
        />
      ))}
      </div>
    </div>
  );
}

function PaletteStrip({
  palette,
  hex,
  onPick,
  onAdd,
  onDelete,
  featured,
}: {
  palette: ArtistPalette;
  hex: string;
  onPick: PickFn;
  onAdd?: () => void;
  onDelete?: () => void;
  featured?: boolean;
}) {
  return (
    <div className={cn("palette-strip", featured && "is-featured")}>
      <span className="palette-strip-name">{palette.name}</span>
      <div className="palette-strip-colors color-wheel">
        <div className="color-wheel-track">
        {palette.colors.map((c, i) => {
          const on = c.toLowerCase() === hex;
          return (
            <Swatch
              key={`${palette.id}-${i}-${c}`}
              hex={c}
              label={`${palette.name} ${i + 1}`}
              on={on}
              className="palette-chip"
              onPick={() => onPick(c, `${palette.id}:${i}`)}
            />
          );
        })}
        {onAdd && (
          <button type="button" className="palette-chip is-add" aria-label={`Add color to ${palette.name}`} onClick={onAdd}>
            <Plus className="size-3.5" />
          </button>
        )}
        </div>
      </div>
      {onDelete && (
        <button type="button" className="palette-strip-del" aria-label={`Delete ${palette.name}`} onClick={onDelete}>
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Swatch({
  hex,
  label,
  on,
  className,
  onPick,
}: {
  hex: string;
  label: string;
  on: boolean;
  className: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      className={cn(className, on && "is-on")}
      style={{ ["--pigment" as string]: hex }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (window.matchMedia("(max-width: 767px)").matches) return;
        startColorDrag(hex, e.pointerId, e.clientX, e.clientY, onPick);
      }}
      onClick={() => {
        if (window.matchMedia("(max-width: 767px)").matches) onPick();
      }}
    >
      <span className="pigment-well block size-full rounded-full" />
    </button>
  );
}
