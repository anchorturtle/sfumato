import { useRef } from "react";
import { Plus } from "lucide-react";
import { hsvToRgb, rgbToHsv } from "@/lib/oil/color";
import { rgbToHex } from "@/lib/oil/pigments";
import { Slider } from "@/components/ui/slider";

type Props = {
  color: [number, number, number];
  onChange: (rgb: [number, number, number]) => void;
  onKeep?: () => void;
  kept?: boolean;
  compact?: boolean;
};

export function ColorPicker({ color, onChange, onKeep, kept, compact }: Props) {
  const [h, s, v] = rgbToHsv(color[0], color[1], color[2]);
  const hex = rgbToHex(color[0], color[1], color[2]);
  const full = hsvToRgb(h, 1, 1);
  const satEnd = rgbToHex(full[0], full[1], full[2]);
  const bright = hsvToRgb(h, s, 1);
  const valEnd = rgbToHex(bright[0], bright[1], bright[2]);

  const setHsv = (nh: number, ns: number, nv: number) => {
    onChange(hsvToRgb(nh, ns, nv));
  };

  return (
    <div className={compact ? "picker-shell is-compact" : "picker-shell"}>
      <div className="picker-row">
        <HueWheel hue={h} hex={hex} onHue={(nh) => setHsv(nh, s, v)} />
        <div className="picker-side">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="tape-counter">Pigment</p>
              <p className="text-sm font-extrabold leading-tight italic tracking-tight">{hex}</p>
            </div>
            {onKeep && (
              <button
                type="button"
                className="analog-btn analog-chip analog-mini-wide"
                onClick={onKeep}
                disabled={kept}
                aria-label="Save color to mine"
              >
                <Plus className="size-4" />
                Keep
              </button>
            )}
          </div>
          <label className="block">
            <span className="mb-0.5 flex items-center justify-between">
              <span className="tape-counter">Sat</span>
              <span className="tape-counter opacity-70">{Math.round(s * 100)}</span>
            </span>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[s]}
              onValueChange={(n) => n[0] != null && setHsv(h, n[0], v)}
              aria-label="Saturation"
              style={{ ["--sat-end" as string]: satEnd }}
              className="sat-slider"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 flex items-center justify-between">
              <span className="tape-counter">Value</span>
              <span className="tape-counter opacity-70">{Math.round(v * 100)}</span>
            </span>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[v]}
              onValueChange={(n) => n[0] != null && setHsv(h, s, n[0])}
              aria-label="Value"
              style={{ ["--val-end" as string]: valEnd }}
              className="val-slider"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function HueWheel({ hue, hex, onHue }: { hue: number; hex: string; onHue: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useRef(false);

  const fromPoint = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const dx = clientX - (box.left + box.width / 2);
    const dy = clientY - (box.top + box.height / 2);
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (ang < 0) ang += 360;
    onHue(ang % 360);
  };

  return (
    <div
      ref={ref}
      className="hue-wheel"
      role="slider"
      aria-label="Hue wheel"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        live.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* iOS */
        }
        fromPoint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!live.current) return;
        fromPoint(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        live.current = false;
      }}
      onPointerCancel={() => {
        live.current = false;
      }}
    >
      <span className="hue-wheel-knob" style={{ transform: `rotate(${hue}deg)` }} aria-hidden />
      <span className="hue-wheel-core" style={{ background: hex }} aria-hidden />
    </div>
  );
}
