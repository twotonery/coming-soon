"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from "react";
import { DISPLAY_CENTRED, GUTTER } from "./shared";

// Only the featured quote is in the Figma file; the other faces reuse it until there is real copy.
const QUOTE = {
  quote: "We came in with a long list of features and no clear story. Twotonery helped us step back, figure out what actually mattered to our users, and build around that. The result is a product that feels focused and intentional. Our team still references the thinking from those early workshops.",
  name: "John doe",
  role: "Founder of lorem ipsum",
};

type Card = {
  src: string;
  x: number; y: number; w: number; h: number; // resting polaroid; x is the left edge's offset from the page centre
  ox?: number;                                 // open left edge, when it isn't simply re-centred on the polaroid
  video?: boolean;                             // shows "Watch interview" while resting too
  drift: [dx: number, dy: number, seconds: number, delay: number];
  depth: number;                               // px the card leans away from the cursor
};

// Resting collage (Figma default state). The featured card comes last so it sits on top.
const CARDS: Card[] = [
  { src: "/figma/face-1.jpg", x: -413, y: 318, w: 156, h: 181, drift: [6, 7, 13, -2], depth: 9 },
  { src: "/figma/face-2.jpg", x: -671, y: 459, w: 291, h: 239, drift: [8, 5, 15, -7], depth: 14 },
  { src: "/figma/face-3.jpg", x: 418, y: 558, w: 242, h: 201, drift: [7, 6, 14, -4], depth: 12 },
  { src: "/figma/face-4.jpg", x: 112, y: 500, w: 242, h: 201, drift: [5, 8, 12, -9], depth: 10 },
  { src: "/figma/face-5.jpg", x: -354, y: 652, w: 242, h: 201, drift: [8, 6, 16, -1], depth: 12 },
  { src: "/figma/face-6.jpg", x: 394, y: 299, w: 184, h: 160, drift: [6, 6, 11, -5], depth: 9 },
  { src: "/figma/face-main.jpg", x: -184, y: 358, w: 313, h: 242, ox: -177, video: true, drift: [5, 5, 14, -3], depth: 6 },
];

// The hovered card (Figma hover state): a 354 x 455 mat with a 342 x 237 photo and the quote below.
const OPEN = { w: 354, h: 455, photo: 237 };
const SECTION_H = 900;
const EASE = "cubic-bezier(.22,1,.36,1)";

const MAT = "bg-polaroid shadow-[1px_1px_2px_rgba(0,0,0,0.16)]";

function Photo({ src, sizes }: { src: string; sizes: string }) {
  return (
    <>
      <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
      <div className="absolute inset-0 bg-black/12" />
    </>
  );
}

function WatchButton({ visible = true }: { visible?: boolean }) {
  return (
    <button
      type="button"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`absolute bottom-2 left-2 flex items-center gap-1.5 rounded-[2px] bg-white/16 px-1.5 py-1 text-[12px] leading-4 text-white backdrop-blur-[6px] transition-[opacity,background-color] duration-300 hover:bg-white/28 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <Image src="/figma/play.svg" alt="" width={16} height={16} />
      Watch interview
    </button>
  );
}

function Quote({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 p-3 text-ink ${className}`}>
      <blockquote className="text-[14px] leading-5">&quot;{QUOTE.quote}&quot;</blockquote>
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-[16px] leading-6 font-medium">{QUOTE.name}</span>
        <span className="text-[12px] leading-4 text-ink/50">{QUOTE.role}</span>
      </figcaption>
    </div>
  );
}

export function Testimonials() {
  const [open, setOpen] = useState<number | null>(null);
  // the last card opened stays on top while it folds back down
  const [raised, setRaised] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const show = (i: number) => { setOpen(i); setRaised(i); };
  const hide = (i: number) => setOpen((o) => (o === i ? null : o));

  // The collage leans gently away from the cursor (--mx/--my run -1..1).
  function lean(e: PointerEvent<HTMLElement>) {
    const el = sectionRef.current;
    if (!el || e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * -2 + 1).toFixed(3));
    el.style.setProperty("--my", (((e.clientY - r.top) / r.height) * -2 + 1).toFixed(3));
  }
  function settle() {
    sectionRef.current?.style.setProperty("--mx", "0");
    sectionRef.current?.style.setProperty("--my", "0");
  }

  return (
    <section
      ref={sectionRef}
      onPointerMove={lean}
      onPointerLeave={settle}
      className={`paper flex flex-col items-center gap-14 overflow-clip py-20 lg:h-[900px] lg:py-[120px] ${GUTTER}`}
    >
      <div className="flex w-[550px] max-w-full flex-col items-center gap-6 text-center">
        <p className="text-[16px] leading-6">What they say</p>
        <h2 className={DISPLAY_CENTRED}>Trusted by teams building what&apos;s next.</h2>
      </div>

      {CARDS.map((c, i) => {
        const isOpen = open === i;
        const [dx, dy, seconds, delay] = c.drift;
        const openLeft = c.ox ?? c.x + c.w / 2 - OPEN.w / 2;
        const frame: CSSProperties = {
          left: isOpen ? `clamp(16px, calc(50% + ${openLeft}px), calc(100% - ${OPEN.w + 16}px))` : `calc(50% + ${c.x}px)`,
          top: isOpen ? Math.min(c.y - 25, SECTION_H - OPEN.h - 32) : c.y,
          width: isOpen ? OPEN.w : c.w,
          height: isOpen ? OPEN.h : c.h,
          zIndex: isOpen ? 30 : raised === i ? 20 : undefined,
          transform: isOpen ? "none" : `translate3d(calc(var(--mx, 0) * ${c.depth}px), calc(var(--my, 0) * ${c.depth}px), 0)`,
          transition: `left .55s ${EASE}, top .55s ${EASE}, width .55s ${EASE}, height .55s ${EASE}, transform 1.2s ${EASE}`,
        };
        const float = {
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
          animationDuration: `${seconds}s`,
          animationDelay: `${delay}s`,
          animationPlayState: isOpen ? "paused" : "running",
        } as CSSProperties;

        return (
          <div key={c.src} className="absolute hidden lg:block" style={frame}>
            <div className="drift size-full" style={float}>
              <figure
                tabIndex={0}
                onMouseEnter={() => show(i)}
                onMouseLeave={() => hide(i)}
                onFocus={() => show(i)}
                onBlur={(e: FocusEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(i); }}
                className={`flex size-full cursor-default flex-col gap-2 overflow-hidden p-1.5 outline-none transition-shadow duration-500 focus-visible:ring-2 focus-visible:ring-teal ${MAT} ${isOpen ? "shadow-[0_12px_32px_rgba(14,31,33,0.12),1px_1px_2px_rgba(0,0,0,0.16)]" : ""}`}
              >
                <div
                  className="relative shrink-0"
                  style={{ height: isOpen ? OPEN.photo : c.h - 26, transition: `height .55s ${EASE}` }}
                >
                  <Photo src={c.src} sizes={`${OPEN.w}px`} />
                  <WatchButton visible={isOpen || !!c.video} />
                </div>
                {/* fixed width so the copy doesn't reflow while the mat grows */}
                <Quote
                  className={`w-[342px] shrink-0 transition-opacity ${isOpen ? "opacity-100 delay-200 duration-300" : "opacity-0 duration-150"}`}
                />
              </figure>
            </div>
          </div>
        );
      })}

      {/* small screens: no hover, so the featured card sits open on its own */}
      <figure className={`relative flex w-[354px] max-w-full flex-col gap-2 p-1.5 lg:hidden ${MAT}`}>
        <div className="relative aspect-[342/237]">
          <Photo src="/figma/face-main.jpg" sizes="342px" />
          <WatchButton />
        </div>
        <Quote />
      </figure>
    </section>
  );
}
