import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Slider({ className, onPointerDownCapture, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex h-8 w-full touch-pan-y items-center select-none", className)}
      onPointerDownCapture={(e) => {
        onPointerDownCapture?.(e);
        if (e.pointerType !== "touch") return;
        const root = e.currentTarget;
        const x0 = e.clientX;
        const y0 = e.clientY;
        const id = e.pointerId;
        let axis: "h" | "v" | null = null;
        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== id) return;
          const dx = Math.abs(ev.clientX - x0);
          const dy = Math.abs(ev.clientY - y0);
          if (!axis && (dx > 7 || dy > 7)) axis = dy > dx ? "v" : "h";
          if (axis === "v") {
            try {
              root.releasePointerCapture(id);
            } catch {
              /* */
            }
          }
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove, true);
          window.removeEventListener("pointerup", onUp, true);
          window.removeEventListener("pointercancel", onUp, true);
        };
        window.addEventListener("pointermove", onMove, true);
        window.addEventListener("pointerup", onUp, true);
        window.addEventListener("pointercancel", onUp, true);
      }}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1 w-full grow overflow-hidden rounded-full bg-raised"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-fg/55" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        className="block size-5 rounded-full bg-accent shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      />
    </SliderPrimitive.Root>
  );
}
