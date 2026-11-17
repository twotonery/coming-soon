"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Dot, HLine, VLine } from "./shared";

// Only Visual identity has its own picture in the Figma file so far; the
// others show the hero painting until theirs are ready.
const SERVICES = [
  { name: "Brand strategy", image: "/figma/hero.png" },
  { name: "Visual identity", image: "/figma/service-visual-identity.png" },
  { name: "Web development", image: "/figma/hero.png" },
  { name: "Product/UIUX", image: "/figma/hero.png" },
];

// Page scroll (in svh) spent on each service change while the section is
// pinned, and on the louver that closes it into Pricing.
const STEP = 90;
const OUTRO = 90;
// The louver starts a fifth of the way into the outro; from there on Pricing
// (pulled up over the section's foot) rises under it, so the screen is never
// left a whole page of bare ink.
const LOUVER_FROM = 0.2;

// The louver, after elementis.co: thin horizontal slats, each filling from its
// own bottom edge upwards, the bottom slat first and the top one last, all
// scrubbed by scroll. Each slat takes SLAT_SPAN of a transition; the rest is
// the stagger up the screen.
const SLATS = 30;
const SLAT_SPAN = 0.45;
const SLAT_STAGGER = (1 - SLAT_SPAN) / (SLATS - 1);

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

// Masks `el` so `t` (0–1) of the louver shows.
function louver(el: HTMLElement, t: number) {
  el.style.visibility = t <= 0 ? "hidden" : "";
  let mask = "none";
  if (t > 0 && t < 1) {
    const slat = 100 / SLATS;
    const stops = Array.from({ length: SLATS }, (_, j) => {
      const f = clamp01((t - SLAT_STAGGER * j) / SLAT_SPAN);
      const a = j * slat;
      const b = a + (1 - (1 - f) ** 3) * slat;
      return `#000 ${a.toFixed(3)}% ${b.toFixed(3)}%, transparent ${b.toFixed(3)}% ${(a + slat).toFixed(3)}%`;
    });
    mask = `linear-gradient(to top, ${stops.join(", ")})`;
  }
  el.style.setProperty("mask-image", mask);
  el.style.setProperty("-webkit-mask-image", mask);
}

// The list reads like a drum: the current service sits level with "What we
// shape" at full size and the rest ride above and below it at half size,
// nudged left and faded out by the mask (Figma Services 33:2).
const LIST_MASK = "linear-gradient(to bottom, transparent 0, #000 100px, #000 176px, transparent 290px)";

export function Services() {
  const ref = useRef<HTMLElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const zooms = useRef<(HTMLDivElement | null)[]>([]);
  const ink = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Pinned for the service changes, then the outro. `x` runs 0 → 3 across the
  // services; image k louvers in over most of the scroll from x = k - 1 to k,
  // and zooms from 1.1 to 1 as it settles.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const progress = travel > 0 ? clamp01(-r.top / travel) : 0;
      const split = ((SERVICES.length - 1) * STEP) / ((SERVICES.length - 1) * STEP + OUTRO);
      const x = clamp01(progress / split) * (SERVICES.length - 1);

      SERVICES.forEach((_, k) => {
        const layer = layers.current[k];
        if (k > 0 && layer) louver(layer, clamp01((x - (k - 1) - 0.1) / 0.8));
        const zoom = zooms.current[k];
        if (zoom) zoom.style.transform = `scale(${1.1 - 0.1 * clamp01((x - (k - 1) - 0.1) / 1.6)})`;
      });
      setActive(Math.min(Math.floor(x + 0.5), SERVICES.length - 1));

      // the last service holds for the start of the outro
      if (ink.current) louver(ink.current, clamp01(((progress - split) / (1 - split) - LOUVER_FROM) / (1 - LOUVER_FROM)));
    };
    const schedule = () => { frame ||= requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section
      ref={ref}
      id="services"
      data-nav-tone="dark"
      className="relative text-white"
      style={{
        height: `calc(max(100svh, 680px) + ${(SERVICES.length - 1) * STEP + OUTRO}svh)`,
        marginBottom: `-${OUTRO * (1 - LOUVER_FROM)}svh`,
      }}
    >
      <div className="sticky top-0 h-svh min-h-[680px] overflow-clip">
        {SERVICES.map((s, k) => (
          <div
            key={s.name}
            ref={(el) => { layers.current[k] = el; }}
            className="absolute inset-0 overflow-clip"
            style={k > 0 ? { visibility: "hidden" } : undefined}
          >
            <div ref={(el) => { zooms.current[k] = el; }} className="absolute -top-[65px] -right-3.5 -bottom-[47px] -left-3.5">
              <Image src={s.image} alt="" fill sizes="100vw" className="object-cover" />
            </div>
          </div>
        ))}
        <div className="absolute inset-0 bg-black/44" />

        {/* frame: lines run through the gutters, markers at the corners */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <HLine className="top-[calc(50%-332px)]" />
          <HLine className="top-[calc(50%+332px)]" />
          <div className="absolute inset-y-0 left-[calc(var(--gutter)-2px)]"><VLine left="0px" /></div>
          <div className="absolute inset-y-0 right-[calc(var(--gutter)-2px)]"><VLine left="0px" /></div>
          {["left-[calc(var(--gutter)-2px)]", "right-[calc(var(--gutter)-2px)]"].map((x) => (
            <div key={x} className={`absolute inset-y-0 ${x}`}>
              <Dot left="0px" top="calc(50% - 332px)" />
              <Dot left="0px" top="calc(50% + 332px)" />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col gap-28 px-[calc(var(--gutter)+16px)] font-display tracking-[-0.04em] sm:px-[calc(var(--gutter)+36px)] md:flex-row md:items-center md:justify-between">
          <h2 className="text-[24px] leading-8 font-normal text-white/71">What we shape</h2>

          <div className="relative h-10 w-full [--half-gap:8px] [--row:40px] sm:h-14 sm:[--half-gap:12px] sm:[--row:56px] md:w-[408px]">
            <ul className="absolute -inset-x-6 -top-[112px] h-[308px]" style={{ mask: LIST_MASK, WebkitMask: LIST_MASK }}>
              {SERVICES.map((s, i) => {
                const d = i - active;
                return (
                  <li
                    key={s.name}
                    aria-current={d === 0 ? "true" : undefined}
                    className="absolute top-[112px] left-6 origin-left text-[34px] leading-10 whitespace-nowrap transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] sm:text-[48px] sm:leading-14"
                    style={{
                      transform: `translate(${d === 0 ? 0 : -12}px, calc(${d} * var(--row) + ${Math.sign(d)} * var(--half-gap))) scale(${d === 0 ? 1 : 0.5})`,
                    }}
                  >
                    {s.name}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* outro: the same louver in ink over everything, handing over to Pricing's ground */}
        <div ref={ink} aria-hidden className="pointer-events-none absolute inset-0 bg-ink" style={{ visibility: "hidden" }} />
      </div>
    </section>
  );
}
