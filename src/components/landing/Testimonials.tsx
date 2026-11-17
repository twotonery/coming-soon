"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type Ref } from "react";
import { DISPLAY_CENTRED, GUTTER } from "./shared";

type Testimonial = { quote: string; name: string; role: string };

// Only the featured quote is in the Figma file; the rest is placeholder copy until there is real copy.
const FEATURED: Testimonial = {
  quote: "We came in with a long list of features and no clear story. Twotonery helped us step back, figure out what actually mattered to our users, and build around that. The result is a product that feels focused and intentional. Our team still references the thinking from those early workshops.",
  name: "John doe",
  role: "Founder of lorem ipsum",
};
const PLACEHOLDER: Testimonial[] = [
  { quote: "They asked better questions about our patients than we did. The intake flow went from our biggest complaint to the part people mention when they recommend us.", name: "Jane doe", role: "Head of Product, lorem ipsum" },
  { quote: "Fast, calm, and honest about trade-offs. Exactly what a small team needs.", name: "Alex doe", role: "CTO of lorem ipsum" },
  { quote: "Twotonery felt like part of the team from week one. They brought structure to a messy roadmap without slowing us down, and the design system they left behind still holds up.", name: "Chris doe", role: "VP Engineering, lorem ipsum" },
  { quote: "Clear thinking, beautiful work, zero drama. We shipped the redesign two weeks early.", name: "Pat doe", role: "COO of lorem ipsum" },
  { quote: "The workshops alone were worth it. Everyone left with the same picture of the product.", name: "Robin doe", role: "Co-founder of lorem ipsum" },
  { quote: "They made a regulated product feel simple without cutting corners on compliance.", name: "Kim doe", role: "Head of Design, lorem ipsum" },
  { quote: "Our onboarding completion went up the month we launched. The team keeps asking when we can work with them again.", name: "Lee doe", role: "Product Lead, lorem ipsum" },
  { quote: "A design partner that understands healthcare is rare. This one also ships.", name: "Max doe", role: "CEO of lorem ipsum" },
];

// The shapes testimonials come in: a landscape interview still, a tall or square portrait, or the words alone.
type Format = "wide" | "portrait" | "square" | "text";
// Open (hovered) mat width and photo height per format; the wide size is the featured card's in Figma.
const OPEN: Record<Format, { w: number; photo: number }> = {
  wide: { w: 354, photo: 237 },
  portrait: { w: 260, photo: 310 },
  square: { w: 300, photo: 288 },
  text: { w: 354, photo: 0 },
};

type Card = {
  id: string;
  format: Format;
  src?: string;                                // photo cards only
  t: Testimonial;
  x: number; y: number; w: number; h: number;  // resting mat from Figma node 45:55; x is the left edge's offset from the page centre
  video?: boolean;                             // has an interview to watch; the button shows while the card is open
  wander: [ax: number, ay: number, seconds: number, phase: number]; // reach (px) and pace of its slow roam
};

// Resting collage (Figma 45:55), in its stacking order. The featured card's open state is node 44:25.
const CARDS: Card[] = [
  { id: "face-1", format: "portrait", src: "/figma/face-1.jpg", t: PLACEHOLDER[1], x: -423, y: 290, w: 156, h: 282, wander: [16, 14, 19, 0.4] },
  { id: "face-2", format: "wide", src: "/figma/face-2.jpg", t: PLACEHOLDER[2], x: -671, y: 521, w: 291, h: 239, wander: [20, 16, 23, 2.1] },
  { id: "face-3", format: "square", src: "/figma/face-3.jpg", t: PLACEHOLDER[7], x: 529, y: 320, w: 136, h: 150, wander: [14, 16, 17, 4.3] },
  { id: "face-4", format: "wide", src: "/figma/face-4.jpg", t: PLACEHOLDER[6], x: 162, y: 456, w: 242, h: 201, wander: [18, 14, 21, 1.2] },
  { id: "face-6", format: "portrait", src: "/figma/face-6.jpg", t: PLACEHOLDER[5], x: 461, y: 521, w: 156, h: 282, wander: [14, 18, 20, 5.2] },
  { id: "t-3", format: "text", t: PLACEHOLDER[4], x: 53, y: 331, w: 210, h: 150, wander: [16, 14, 19, 0.9] },
  { id: "main", format: "wide", src: "/figma/face-main.jpg", t: FEATURED, x: -287, y: 425, w: 354, h: 263, video: true, wander: [14, 12, 25, 2.8] },
  { id: "t-2", format: "text", t: PLACEHOLDER[3], x: 283, y: 695, w: 236, h: 150, wander: [18, 14, 22, 4.8] },
  { id: "t-1", format: "text", t: PLACEHOLDER[0], x: -380, y: 719, w: 230, h: 150, wander: [18, 12, 18, 3.6] },
];

// Small screens swipe through every card, open, in this order (featured first, photos and words alternating).
const SLIDES = ["main", "t-1", "face-1", "t-3", "face-2", "face-3", "t-2", "face-4", "face-6"].map((id) => CARDS.find((c) => c.id === id)!);
const SLIDE_W = 300;
const SLIDE_MS = 5000; // how long each slide rests, and how long a swipe holds the auto-slide back

const MAT_PAD = 6;     // p-1.5
const PHOTO_GAP = 8;   // gap-2 between photo and quote
const LIP = 14;        // the polaroid's thicker bottom edge while resting
const SECTION_H = 900;
const EASE = "cubic-bezier(.22,1,.36,1)";

// Where a card has roamed to at time t (s): two sines per axis at unrelated
// rates, so the path never visibly loops or comes to a stop.
function roam([ax, ay, seconds, phase]: Card["wander"], t: number) {
  const w = (Math.PI * 2) / seconds;
  return [
    ax * (0.65 * Math.sin(w * t + phase) + 0.35 * Math.sin(w * 1.73 * t + phase * 2.1)),
    ay * (0.65 * Math.cos(w * 0.81 * t + phase * 1.3) + 0.35 * Math.sin(w * 1.37 * t + phase * 0.7)),
  ];
}

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
      className={`pill pill-glass absolute bottom-2 left-2 gap-1.5 py-1 pr-2.5 pl-2 text-[12px] leading-4 text-white ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <Image src="/figma/play.svg" alt="" width={16} height={16} />
      Watch interview
    </button>
  );
}

function Quote({ t, large = false, className = "", style, ref }: { t: Testimonial; large?: boolean; className?: string; style?: CSSProperties; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className={`flex flex-col gap-3 p-3 text-ink ${className}`} style={style}>
      {large && <span aria-hidden className="-mb-3 font-display text-[40px] leading-8 text-teal/40">&ldquo;</span>}
      <blockquote className={large ? "font-display text-[18px] leading-6 tracking-[-0.02em]" : "text-[14px] leading-5"}>
        {large ? t.quote : <>&quot;{t.quote}&quot;</>}
      </blockquote>
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-[16px] leading-6 font-medium">{t.name}</span>
        <span className="text-[12px] leading-4 text-ink/50">{t.role}</span>
      </figcaption>
    </div>
  );
}

// A text-only card at rest: the opening of the quote and who said it.
function Excerpt({ t, className = "" }: { t: Testimonial; className?: string }) {
  return (
    <div aria-hidden className={`absolute inset-1.5 flex flex-col justify-between p-2 text-ink ${className}`}>
      <div>
        <span className="block h-5 font-display text-[32px] leading-8 text-teal/40">&ldquo;</span>
        <p className="line-clamp-3 font-display text-[15px] leading-5 tracking-[-0.02em]">{t.quote}</p>
      </div>
      <span className="text-[12px] leading-4 text-ink/50">{t.name}</span>
    </div>
  );
}

export function Testimonials() {
  const [open, setOpen] = useState<number | null>(null);
  // the last card opened stays on top while it folds back down
  const [raised, setRaised] = useState<number | null>(null);
  // height of the open card's quote, measured as it opens (copy lengths differ)
  const [quoteH, setQuoteH] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const quoteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const roamRefs = useRef<(HTMLDivElement | null)[]>([]);
  const openRef = useRef<number | null>(null);
  useEffect(() => { openRef.current = open; }, [open]);

  // Every card roams on its own path while the section is on screen; an open
  // card eases to rest and picks the roam back up as it folds down.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reach = CARDS.map(() => 1);
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      CARDS.forEach((c, i) => {
        reach[i] += ((openRef.current === i ? 0 : 1) - reach[i]) * (1 - Math.exp(-dt * 6));
        const [x, y] = roam(c.wander, now / 1000);
        const el = roamRefs.current[i];
        if (el) el.style.transform = `translate3d(${(x * reach[i]).toFixed(2)}px, ${(y * reach[i]).toFixed(2)}px, 0)`;
      });
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      last = 0;
      if (entry.isIntersecting) frame = requestAnimationFrame(tick);
    });
    io.observe(section);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  const show = (i: number) => {
    setQuoteH(quoteRefs.current[i]?.offsetHeight ?? 0);
    setOpen(i);
    setRaised(i);
  };
  const hide = (i: number) => setOpen((o) => (o === i ? null : o));

  return (
    <section
      ref={sectionRef}
      className={`paper flex flex-col items-center gap-14 overflow-clip py-20 lg:h-[900px] lg:py-[120px] ${GUTTER}`}
    >
      <div className="flex w-[550px] max-w-full flex-col items-center gap-6 text-center">
        <p className="text-[16px] leading-6">What they say</p>
        <h2 className={DISPLAY_CENTRED}>Trusted by teams building what&apos;s next.</h2>
      </div>

      {CARDS.map((c, i) => {
        const isOpen = open === i;
        const isText = c.format === "text";
        const { w: openW, photo: openPhoto } = OPEN[c.format];
        const openH = MAT_PAD * 2 + (isText ? 0 : openPhoto + PHOTO_GAP) + quoteH;
        const openLeft = c.x + c.w / 2 - openW / 2;
        const frame: CSSProperties = {
          left: isOpen ? `clamp(16px, calc(50% + ${openLeft}px), calc(100% - ${openW + 16}px))` : `calc(50% + ${c.x}px)`,
          top: isOpen ? Math.min(c.y - 25, SECTION_H - openH - 32) : c.y,
          width: isOpen ? openW : c.w,
          height: isOpen ? openH : c.h,
          zIndex: isOpen ? 30 : raised === i ? 20 : undefined,
          transition: `left .55s ${EASE}, top .55s ${EASE}, width .55s ${EASE}, height .55s ${EASE}`,
        };

        return (
          <div key={c.id} className="absolute hidden lg:block" style={frame}>
            <div ref={(el) => { roamRefs.current[i] = el; }} className="size-full will-change-transform">
              <figure
                tabIndex={0}
                onMouseEnter={() => show(i)}
                onMouseLeave={() => hide(i)}
                onFocus={() => show(i)}
                onBlur={(e: FocusEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(i); }}
                className={`relative flex size-full cursor-default flex-col gap-2 overflow-hidden p-1.5 outline-none transition-shadow duration-500 focus-visible:ring-2 focus-visible:ring-teal ${MAT} ${isOpen ? "shadow-[0_12px_32px_rgba(14,31,33,0.12),1px_1px_2px_rgba(0,0,0,0.16)]" : ""}`}
              >
                {c.src && (
                  <div
                    className="relative shrink-0"
                    style={{ height: isOpen ? openPhoto : c.h - MAT_PAD * 2 - LIP, transition: `height .55s ${EASE}` }}
                  >
                    <Photo src={c.src} sizes={`${openW}px`} />
                    {c.video && <WatchButton visible={isOpen} />}
                  </div>
                )}
                {isText && (
                  <Excerpt t={c.t} className={`transition-opacity ${isOpen ? "opacity-0 duration-150" : "opacity-100 delay-200 duration-300"}`} />
                )}
                {/* fixed width so the copy doesn't reflow while the mat grows */}
                <Quote
                  t={c.t}
                  large={isText}
                  className={`shrink-0 transition-opacity ${isOpen ? "opacity-100 delay-200 duration-300" : "opacity-0 duration-150"}`}
                  style={{ width: openW - MAT_PAD * 2 }}
                  ref={(el) => { quoteRefs.current[i] = el; }}
                />
              </figure>
            </div>
          </div>
        );
      })}

      {/* small screens: no hover, so the cards sit open in a swipeable carousel */}
      <Carousel />
    </section>
  );
}

// Native scroll-snap does the swiping. The cards are laid out three times over
// and the reader is kept in the middle set: once a scroll settles in an outer
// set it hops, unseen, by one set's width to the same card in the middle, so the
// carousel runs on forever either way. A timer nudges it to the next card while
// it is on screen and the reader hasn't touched it for a slide's length.
const LOOP = [0, 1, 2].flatMap((copy) => SLIDES.map((c) => ({ c, copy })));

function Carousel() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const slides = () => [...el.children] as HTMLElement[];
    const centreOn = (s: HTMLElement, behavior: ScrollBehavior) =>
      el.scrollTo({ left: s.offsetLeft + s.offsetWidth / 2 - el.clientWidth / 2, behavior });
    centreOn(slides()[SLIDES.length], "instant");

    let touching = false;
    let held = 0;
    let settle = 0;
    const recentre = () => {
      if (touching) return;
      const all = slides();
      const set = all[SLIDES.length].offsetLeft - all[0].offsetLeft;
      const half = (all[1].offsetLeft - all[0].offsetLeft) / 2;
      if (el.scrollLeft < set - half) el.scrollTo({ left: el.scrollLeft + set, behavior: "instant" });
      else if (el.scrollLeft >= set * 2 - half) el.scrollTo({ left: el.scrollLeft - set, behavior: "instant" });
    };
    const onScroll = () => { clearTimeout(settle); settle = window.setTimeout(recentre, 150); };
    const down = () => { touching = true; held = Date.now(); };
    const up = () => { touching = false; held = Date.now(); onScroll(); };
    const hold = () => { held = Date.now(); };

    let visible = false;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(el);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = reduced ? 0 : window.setInterval(() => {
      if (!visible || touching || document.hidden || Date.now() - held < SLIDE_MS) return;
      const all = slides();
      const centre = el.scrollLeft + el.clientWidth / 2;
      const offset = (s: HTMLElement) => Math.abs(s.offsetLeft + s.offsetWidth / 2 - centre);
      const current = all.reduce((best, s, i) => (offset(s) < offset(all[best]) ? i : best), 0);
      centreOn(all[Math.min(current + 1, all.length - 1)], "smooth");
    }, SLIDE_MS);

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchend", up);
    el.addEventListener("touchcancel", up);
    el.addEventListener("pointerdown", hold);
    el.addEventListener("wheel", hold, { passive: true });
    return () => {
      clearInterval(timer);
      clearTimeout(settle);
      io.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
      el.removeEventListener("pointerdown", hold);
      el.removeEventListener("wheel", hold);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="region"
      aria-roledescription="carousel"
      aria-label="Testimonials"
      className="relative -mx-4 flex snap-x snap-mandatory items-start gap-3 self-stretch overflow-x-auto px-[calc(50vw-150px)] pb-2 [scrollbar-width:none] sm:-mx-11 lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      {LOOP.map(({ c, copy }) => (
        <figure
          key={`${copy}-${c.id}`}
          // only the middle set is read out and focusable; the outer sets are scenery
          inert={copy !== 1}
          aria-roledescription="slide"
          className={`relative flex shrink-0 snap-center flex-col gap-2 p-1.5 ${MAT}`}
          style={{ width: SLIDE_W }}
        >
          {c.src && (
            <div className="relative" style={{ aspectRatio: `${OPEN[c.format].w - MAT_PAD * 2} / ${OPEN[c.format].photo}` }}>
              <Photo src={c.src} sizes={`${SLIDE_W}px`} />
              {c.video && <WatchButton />}
            </div>
          )}
          <Quote t={c.t} large={c.format === "text"} />
        </figure>
      ))}
    </div>
  );
}
