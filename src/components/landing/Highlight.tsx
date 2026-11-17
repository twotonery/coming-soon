"use client";

import { useEffect, useRef, useState } from "react";
import { DISPLAY, GUTTER, Painting } from "./shared";

// Only Suho is real; the other two hold the slots until there are more cases.
const PROJECTS = [
  { title: "Suho finance platform", tags: "Web design, Web development, UI/UX Design, Branding, Marketing" },
  { title: "Kala travel companion", tags: "Product strategy, UI/UX Design, Mobile app" },
  { title: "Noro coffee roasters", tags: "Branding, Visual identity, Packaging, Web design" },
];

// Peeking cases sit at 410px against the 534px one in view.
const PEEK_SCALE = 410 / 534;
// Centre-to-centre distance between cases, as a share of a case's height.
const STEP = 471 / 338;
// A name is gone (fully faded, NAME_BLUR px of blur) this far into its step.
const NAME_FADE = 0.85;
const NAME_BLUR = 16;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

// The section is one screen tall per case and its frame sticks while the page
// scrolls through it: the cases ride up the column (the one in view full size,
// its neighbours peeking smaller above and below), the names follow over a
// shorter run, blurring as they leave, and the tags cross-fade.
export function Highlight() {
  const section = useRef<HTMLElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const names = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = section.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const raw = Math.min(Math.max(-r.top / travel, 0), 1) * (PROJECTS.length - 1);
      // ease each hand-over so a case settles in the middle before the next moves in
      const i = Math.min(Math.floor(raw), PROJECTS.length - 2);
      const p = i + smoothstep(raw - i);
      const column = cards.current[0]?.parentElement;
      const peekX = column ? parseFloat(getComputedStyle(column).getPropertyValue("--peek-x")) || 0 : 0;
      cards.current.forEach((card, k) => {
        if (!card) return;
        const d = k - p;
        const away = Math.min(Math.abs(d), 1);
        const scale = 1 - away * (1 - PEEK_SCALE);
        card.style.transform = `translate3d(${away * peekX * card.offsetWidth}px, ${d * card.offsetHeight * STEP}px, 0) scale(${scale})`;
      });
      const step = names.current ? parseFloat(getComputedStyle(names.current).getPropertyValue("--name-step")) : 0;
      [...(names.current?.children ?? [])].forEach((name, k) => {
        const d = Math.abs(k - p);
        const s = (name as HTMLElement).style;
        s.transform = `translate3d(0, ${(k - p) * step}px, 0)`;
        s.opacity = String(Math.max(0, 1 - d / NAME_FADE));
        s.filter = `blur(${Math.min(d / NAME_FADE, 1) * NAME_BLUR}px)`;
      });
      setActive(Math.round(p));
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, []);

  return (
    // the frame fills the screen under the navbar, so #work lands flush at the top
    <section id="work" ref={section} className="scroll-mt-[calc(var(--nav-h)*-1)]" style={{ height: `${PROJECTS.length * 100}svh` }}>
      {/* the paper sits on the frame, not the section, so it holds still too */}
      <div className={`paper sticky top-0 h-svh overflow-clip ${GUTTER}`}>
        <p className="absolute top-[calc(var(--nav-h)+16px)] text-[16px] leading-6">Project highlight</p>

        {/* the column of cases on the right half on desktop, the peeking ones set
            off to the right of the one in view (centres at 50%+303px vs 50%+144px;
            --peek-x is that 159px as a share of a case's width); below that it
            runs straight, in a band between the title and the tags */}
        <div className="absolute inset-x-0 top-[calc(var(--nav-h)+160px)] bottom-[132px] overflow-clip lg:inset-0 lg:overflow-visible">
          <div className="absolute inset-x-(--gutter) top-1/2 [--peek-x:0] lg:left-[calc(50%+144px-267px)] lg:right-auto lg:w-[534px] lg:[--peek-x:0.2978]">
            {PROJECTS.map((p, k) => (
              <div
                key={p.title}
                ref={(n) => { cards.current[k] = n; }}
                aria-hidden={k !== active}
                className="group absolute inset-x-0 top-0 aspect-[534/338] -translate-y-1/2 will-change-transform"
              >
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.03]">
                    <Painting scrim="bg-black/24" sizes="(min-width: 1024px) 534px, 100vw" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* names ride the scroll too, over a shorter run, and blur out before
            they get far from the middle (--name-step is the distance between them) */}
        <div
          ref={names}
          className="pointer-events-none absolute top-[calc(var(--nav-h)+96px)] right-(--gutter) left-(--gutter) [--name-step:56px] lg:top-1/2 lg:right-auto lg:w-[min(386px,calc(50%-220px))] lg:[--name-step:240px]"
        >
          {PROJECTS.map((p, k) => (
            <h2
              key={p.title}
              aria-hidden={k !== active}
              className={`${DISPLAY} absolute inset-x-0 top-0 -translate-y-1/2 will-change-[transform,opacity,filter]`}
            >
              {p.title}
            </h2>
          ))}
        </div>

        {/* tags for each case stacked in one place; only the active one shows */}
        {PROJECTS.map((p, k) => (
          <p
            key={p.title}
            aria-hidden={k !== active}
            className={`pointer-events-none absolute right-(--gutter) bottom-11 left-(--gutter) text-[16px] leading-6 transition-opacity duration-500 ease-out lg:right-auto lg:w-[255px] ${k === active ? "opacity-100" : "opacity-0"}`}
          >
            {p.tags}
          </p>
        ))}
      </div>
    </section>
  );
}
