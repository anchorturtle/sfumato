import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { ORBIT_AUDIO_ROOT, ORBIT_TRACKS } from "@/lib/orbit-tracks";
import { cn } from "@/lib/utils";

const KEY = "sfumato:orbit-deck";

function srcOf(file: string) {
  return new URL(file.split("/").map(encodeURIComponent).join("/"), ORBIT_AUDIO_ROOT).href;
}

function readDeck() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null") as { i?: number; t?: number } | null;
    const i = typeof parsed?.i === "number" ? Math.max(0, Math.min(ORBIT_TRACKS.length - 1, parsed.i)) : 0;
    const t = typeof parsed?.t === "number" && parsed.t > 0 ? parsed.t : 0;
    return { i, t };
  } catch {
    return { i: 0, t: 0 };
  }
}

function writeDeck(i: number, t: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ i, t: Math.floor(t) }));
  } catch {
    /* */
  }
}

export function OrbitDeck() {
  const boot = useRef(readDeck());
  const audioRef = useRef<HTMLAudioElement>(null);
  const wantPlay = useRef(false);
  const seek = useRef(boot.current.t);
  const [index, setIndex] = useState(boot.current.i);
  const [playing, setPlaying] = useState(false);

  const track = ORBIT_TRACKS[index]!;
  const src = srcOf(track.file);

  useEffect(() => {
    writeDeck(index, audioRef.current?.currentTime || seek.current);
  }, [index]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const tryPlay = () => {
      if (!wantPlay.current) return;
      const p = el.play();
      if (p) p.then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
    el.addEventListener("canplay", tryPlay);
    return () => el.removeEventListener("canplay", tryPlay);
  }, []);

  const go = (next: number) => {
    const i = (next + ORBIT_TRACKS.length) % ORBIT_TRACKS.length;
    seek.current = 0;
    setIndex(i);
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      wantPlay.current = true;
      const p = el.play();
      if (p) p.then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      wantPlay.current = false;
      el.pause();
      setPlaying(false);
      writeDeck(index, el.currentTime);
    }
  };

  return (
    <div className="orbit-deck" aria-label="Orbit player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        playsInline
        onEnded={() => {
          if (!wantPlay.current) return;
          go(index + 1);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          if (!wantPlay.current) setPlaying(false);
        }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (seek.current > 1 && seek.current < (el.duration || 0)) {
            el.currentTime = seek.current;
            seek.current = 0;
          }
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          if ((t | 0) % 5 === 0) writeDeck(index, t);
        }}
      />
      <button type="button" className="orbit-deck-btn" aria-label="Previous track" onClick={() => go(index - 1)}>
        <SkipBack className="size-4" />
      </button>
      <button type="button" className={cn("orbit-deck-btn orbit-deck-play", playing && "is-on")} aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <button type="button" className="orbit-deck-btn" aria-label="Next track" onClick={() => go(index + 1)}>
        <SkipForward className="size-4" />
      </button>
      <span className="orbit-deck-title" title={`${track.title} — ${track.artist}`}>
        {track.title}
      </span>
    </div>
  );
}
