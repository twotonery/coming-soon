"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { BOOKING_HREF } from "./shared";

// Letters of the wordmark, as insets of the 1352 × 377 stage (Figma 8:342–8:350).
const LETTERS = [
  { src: "/figma/wm-t1.svg", inset: "20.18% 91.32% 22.2% 0.04%" },
  { src: "/figma/wm-w.svg", inset: "34.37% 75.67% 22.84% 8.27%" },
  { src: "/figma/wm-o1.svg", inset: "33.76% 63.42% 22.08% 24.24%" },
  { src: "/figma/wm-t2.svg", inset: "20.18% 54.98% 22.2% 36.38%" },
  { src: "/figma/wm-o2.svg", inset: "33.76% 42.84% 22.08% 44.82%" },
  { src: "/figma/wm-n2.svg", inset: "33.72% 31.1% 22.84% 58.35%" },
  { src: "/figma/wm-e.svg", inset: "33.72% 17.9% 21.99% 69.98%" },
  { src: "/figma/wm-r.svg", inset: "33.72% 9.66% 22.84% 83.29%" },
  { src: "/figma/wm-y.svg", inset: "34.37% 0 4.78% 89.67%" },
];

// Stage pixels → container width, so the collage scales as one piece.
const u = (n: number) => `calc(${n} * var(--u))`;
const box = (left: number, top: number, width: number, height: number): CSSProperties => ({ left: u(left), top: u(top), width: u(width), height: u(height) });

// w × h is the stamp's box in stage pixels; home is its top-left in the Figma frame,
// used when a stamp is pressed from the keyboard.
type Stamp = { w: number; h: number; home: [number, number]; art: ReactNode; seal?: boolean };

// In the order they land, one per click; the "let's talk" seal closes the set.
const STAMPS: Stamp[] = [
  {
    w: 199.591, h: 153.259, home: [958, 213.5],
    art: (
      <span className="flex size-full items-center justify-center">
        <span className="relative rotate-[4.09deg]" style={{ width: u(190.079), height: u(140.048) }}>
          <span className="absolute top-1/2 left-1/2 -translate-1/2 rotate-90" style={{ width: u(140.048), height: u(190.079) }}>
            <Image src="/figma/stamp-frame-1.svg" alt="" fill />
          </span>
          <span className="absolute" style={box(9.54, 8.23, 170.828, 123.581)}>
            <Image src="/figma/stamp-image.jpg" alt="" fill sizes="180px" className="object-cover" />
          </span>
        </span>
      </span>
    ),
  },
  {
    w: 153.925, h: 148.044, home: [313, 29.5],
    art: (
      <span className="flex size-full items-center justify-center">
        <span className="relative -rotate-[6.79deg]" style={{ width: u(139.237), height: u(132.514) }}>
          <Image src="/figma/stamp-frame-2.svg" alt="" fill />
          <span className="absolute inset-[7.39%_6.37%_7.51%_6.37%]">
            <Image src="/figma/stamp-image.jpg" alt="" fill sizes="130px" className="object-cover" />
          </span>
        </span>
      </span>
    ),
  },
  {
    w: 195.58, h: 175.091, home: [59, 161.5],
    art: (
      <span className="flex size-full items-center justify-center">
        <span className="relative -rotate-[7.55deg]" style={{ width: u(176.993), height: u(153.167) }}>
          <Image src="/figma/stamp-frame-3.svg" alt="" fill />
          <span className="absolute inset-[15.92%_11.64%_7.46%_11.64%]">
            <Image src="/figma/stamp-polygon.png" alt="" fill sizes="140px" />
          </span>
        </span>
      </span>
    ),
  },
  {
    w: 187, h: 190, home: [595, 115.5],
    seal: true,
    art: (
      <span className="absolute inset-0 overflow-hidden">
        <Image src="/figma/seal-footer.png" alt="" width={1024} height={1024} sizes="190px" className="absolute top-[3.15%] left-0 h-[98.2%] w-full max-w-none" />
      </span>
    ),
  },
];

const LIFT = "transition-transform duration-500 ease-out hover:-translate-y-2 hover:rotate-3";
const W = 1352;
const H = 377;

type Point = { x: number; y: number };

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
// Keep a stamp's centre far enough in that the whole stamp stays on the stage.
const fit = (s: Stamp, p: Point): Point => ({ x: clamp(p.x, s.w / 2, W - s.w / 2), y: clamp(p.y, s.h / 2, H - s.h / 2) });
const home = (s: Stamp): Point => ({ x: s.home[0] + s.w / 2, y: s.home[1] + s.h / 2 });
const at = (s: Stamp, p: Point) => box(p.x - s.w / 2, p.y - s.h / 2, s.w, s.h);

// The wordmark starts bare. A shadow of the next stamp follows the cursor and
// each click presses that stamp where it is; the "let's talk" seal is the last.
export function Wordmark() {
  const [placed, setPlaced] = useState<Point[]>([]);
  const [hovering, setHovering] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const pointer = useRef<Point | null>(null);
  const next = placed.length < STAMPS.length ? STAMPS[placed.length] : null;

  const toStage = (e: { clientX: number; clientY: number }): Point => {
    const r = stage.current!.getBoundingClientRect();
    const scale = r.width / W;
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  // The shadow is moved through CSS variables, so following the cursor never re-renders.
  const aim = useCallback(() => {
    if (!stage.current || !next) return;
    const p = fit(next, pointer.current ?? home(next));
    stage.current.style.setProperty("--gx", String(p.x - next.w / 2));
    stage.current.style.setProperty("--gy", String(p.y - next.h / 2));
  }, [next]);
  useEffect(aim, [aim]);

  const press = (e: MouseEvent) => {
    if (!next) return;
    // detail 0: pressed from the keyboard, so use the Figma spot
    const p = e.detail === 0 ? home(next) : fit(next, toStage(e));
    setPlaced((ps) => (ps.length < STAMPS.length ? [...ps, p] : ps));
  };

  return (
    <div className="@container w-full" style={{ "--u": "calc(100cqw / 1352)" } as CSSProperties}>
      <div
        ref={stage}
        className={`group relative w-full ${next ? "cursor-pointer" : ""}`}
        style={{ height: u(H) }}
        onClick={press}
        onPointerMove={(e) => {
          if (e.pointerType === "touch") return;
          pointer.current = toStage(e);
          aim();
          setHovering(true);
        }}
        onPointerLeave={() => {
          pointer.current = null;
          aim();
          setHovering(false);
        }}
      >
        {LETTERS.map((l) => (
          <div key={l.src} aria-hidden className="absolute opacity-40" style={{ inset: l.inset }}>
            <Image src={l.src} alt="" fill />
          </div>
        ))}
        <span className="sr-only">twotonery</span>

        {next && (
          <>
            {/* keyboard route to the same click; the stage handles it as it bubbles */}
            <button type="button" aria-label={`Press stamp ${placed.length + 1} of ${STAMPS.length}`} className="absolute inset-0 cursor-pointer outline-none" />
            <div
              aria-hidden
              className={`pointer-events-none absolute brightness-0 transition-opacity duration-300 ${hovering ? "opacity-20" : "opacity-0 group-has-[:focus-visible]:opacity-20"}`}
              style={{ left: "calc(var(--gx) * var(--u))", top: "calc(var(--gy) * var(--u))", width: u(next.w), height: u(next.h) }}
            >
              {next.art}
            </div>
          </>
        )}

        {placed.map((p, i) => {
          const s = STAMPS[i];
          return s.seal ? (
            <a key={i} href={BOOKING_HREF} aria-label="Let's talk" className="absolute drop-shadow-[-10px_12px_11px_rgba(0,0,0,0.25)] transition-transform duration-500 ease-out hover:scale-105 hover:-rotate-6" style={at(s, p)}>
              <span className="stamp-in relative block size-full">{s.art}</span>
            </a>
          ) : (
            <div key={i} aria-hidden className={`absolute ${LIFT}`} style={at(s, p)}>
              <span className="stamp-in relative block size-full">{s.art}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
