"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { BOOKING_HREF, DISPLAY, GUTTER, Words, delay } from "./shared";
import "./pricing.css";

// Pricing, from the Figma section (Code-layer node 25:201): plan tabs over two
// stacked tickets; the chosen plan's ticket comes to the front.

const LABEL = "text-[12px] leading-[18px] font-semibold tracking-[0.08em] uppercase";

type Plan = {
  tier: string;
  amount: string;
  unit?: string;
  blurb: string;
  items: string[];
  check: string;
  itemGap: string;
  cta: { label: string; className: string };
  paper: string;
};

const PLANS: Plan[] = [
  {
    tier: "Growth",
    amount: "From $XXX",
    unit: "/ month",
    blurb: "Design support for teams building and scaling products.",
    items: [
      "Continuous product discovery and planning",
      "User flows and feature wireframes",
      "UI design for new and existing features",
      "Interactive prototyping in Figma",
      "Ongoing design iterations and refinements",
      "Design system updates and developer handoff",
    ],
    check: "/figma/check-growth.svg",
    itemGap: "gap-2",
    cta: { label: "Start a project", className: "bg-ink text-white hover:bg-ink/85" },
    // paper at 44% over white
    paper: "bg-[linear-gradient(rgb(255_255_255/0.56),rgb(255_255_255/0.56)),url(/figma/paper.png)] bg-cover bg-center",
  },
  {
    tier: "Dedicated",
    amount: "Let’s talk",
    blurb: "A tailored design partnership for complex products and ambitious business goals.",
    items: [
      "Product strategy and design roadmap",
      "In-depth research and user journey mapping",
      "End-to-end UX/UI design execution",
      "Advanced prototyping and user testing",
      "Scalable design systems and documentation",
      "Cross-team collaboration and support",
    ],
    check: "/figma/check-dedicated.svg",
    itemGap: "gap-2.5",
    cta: { label: "Book a strategy call", className: "bg-white text-teal hover:bg-white/85" },
    // paper multiplied into mint
    paper: "bg-[#0dd3b1] bg-[url(/figma/paper.png)] bg-cover bg-center bg-blend-multiply",
  },
];

// A ticket: paper with a perforated stamp window punched through it. The
// window holds frosted glass printed with the painting, so whatever lies
// behind (the other ticket) shows through blurred; the plan's name and price
// sit on the glass. The glass is a sibling of the masked paper, not a child,
// so its blur reaches past the ticket.
function Ticket({ plan }: { plan: Plan }) {
  return (
    <article className="relative isolate flex h-full flex-col [container-type:inline-size] lg:block lg:h-[338px]">
      <span aria-hidden className={`pricing-paper absolute inset-0 -z-10 ${plan.paper}`} />
      {/* sized from the ticket's width (cqw) by the same sum as the window in
          pricing.css, not by aspect-ratio: Safari works an aspect-ratio box's
          height out from the full width here, before the margins come off */}
      <div className="relative m-6 h-[calc((100cqw-48px)*274/372)] w-[calc(100cqw-48px)] shrink-0 text-white lg:absolute lg:top-8 lg:left-8 lg:m-0 lg:h-[274px] lg:w-[372px]">
        <span aria-hidden className="pricing-stamp absolute inset-0 -z-10 overflow-hidden backdrop-blur-[32.45px]">
          {/* the painting fills the stamp upright and turns with it, a quarter clockwise */}
          <span className="absolute top-1/2 left-1/2 h-[135.77%] w-[73.66%] -translate-1/2 rotate-90 bg-[url(/figma/hero.png)] bg-cover bg-center opacity-44" />
        </span>
        <p className={`absolute top-6 left-6 @max-[320px]:top-5 @max-[320px]:left-5 sm:top-8 sm:left-8 ${LABEL}`}>{plan.tier}</p>
        <div className="absolute inset-x-6 bottom-6 flex flex-col gap-1.5 @max-[320px]:inset-x-5 @max-[320px]:bottom-5 sm:inset-x-8 sm:bottom-8 lg:right-auto lg:w-[308px]">
          <p className="font-display text-[28px] leading-9 font-medium tracking-[-0.04em] @max-[320px]:text-[24px] @max-[320px]:leading-8 sm:text-[32px] sm:leading-10">
            {plan.amount}
            {plan.unit && <span className="text-[14px] font-normal"> {plan.unit}</span>}
          </p>
          <p className="text-[15px] leading-[22px] @max-[320px]:text-[14px] @max-[320px]:leading-5 sm:text-[16px] sm:leading-6">{plan.blurb}</p>
        </div>
      </div>
      <div className="relative flex flex-1 flex-col items-start justify-between gap-8 px-6 pt-8 pb-8 text-ink lg:absolute lg:top-8 lg:bottom-8 lg:left-[473px] lg:w-[367px] lg:p-0">
        {/* the perforation below lg, where the mask has no slots */}
        <span aria-hidden className="absolute inset-x-[22px] top-0 flex -translate-y-1/2 justify-between overflow-hidden lg:hidden">
          {Array.from({ length: 12 }, (_, n) => <span key={n} className="h-1.5 w-4 shrink-0 rounded-full bg-ink" />)}
        </span>
        <div className="flex w-full flex-col gap-3">
          <p className={`${LABEL} text-ink/64`}>What&apos;s included</p>
          <ul className="flex flex-col gap-1">
            {plan.items.map((item) => (
              <li key={item} className={`flex items-start text-[16px] leading-6 ${plan.itemGap}`}>
                <span className="flex h-6 shrink-0 items-center"><Image src={plan.check} alt="" width={14} height={14} /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <a href={BOOKING_HREF} className={`rounded-md px-2.5 py-1 text-[16px] leading-6 font-semibold transition-colors ${plan.cta.className}`}>
          {plan.cta.label}
        </a>
      </div>
    </article>
  );
}

// A touch swipe this far across the tickets (px) changes plan; under it the
// front ticket springs back.
const SWIPE = 60;

export function Pricing() {
  const [active, setActive] = useState(0);
  // how far the front ticket is being dragged sideways, while a swipe is on
  const [drag, setDrag] = useState<number | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  // Touch (and pen) only: the front ticket follows the finger once the move is
  // clearly sideways; an upright move is left to the page scroll (pan-y).
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    touch.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const t = touch.current;
    if (!t) return;
    const dx = e.clientX - t.x;
    if (drag === null) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - t.y)) return;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDrag(dx);
  };
  const onUp = () => {
    touch.current = null;
    if (drag === null) return;
    // either way round turns to the other plan (left: on, right: back)
    if (Math.abs(drag) > SWIPE) setActive((a) => (a + (drag < 0 ? 1 : PLANS.length - 1)) % PLANS.length);
    swiped.current = true;
    setDrag(null);
  };

  // arrow keys move between the two tabs
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = (active + 1) % PLANS.length;
    setActive(next);
    document.getElementById(`pricing-tab-${next}`)?.focus();
  };

  return (
    // relative: it slides up over Services' pinned frame (see LOUVER_FROM there)
    <section id="pricing" data-nav-tone="dark" className={`relative flex flex-col gap-16 bg-ink py-20 text-white lg:py-[120px] ${GUTTER}`}>
      <div className="grid gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,868px)]">
        <h2 data-reveal="up" className="pt-1.5 text-[16px] leading-6 font-normal lg:w-[254px]">Pricing</h2>
        <p data-reveal="words" style={delay(80)} className={`${DISPLAY} indent-[88px]`}>
          <Words text="An investment in better design. Clear scopes, thoughtful collaboration, and design solutions built around what your business actually needs." />
        </p>
      </div>
      <div className="flex flex-col gap-10 border-t border-white/30 xl:flex-row xl:items-start xl:justify-between">
        <p data-reveal="up" className="w-[291px] max-w-full pt-6 text-[16px] leading-6 text-white/80">
          Select the perfect package that aligns with your team&apos;s unique needs!
        </p>
        <div className="flex w-full max-w-[872px] flex-col gap-14 xl:w-[872px] xl:shrink-0">
          {/* tabs sit on the divider: the active one's rule lies over it */}
          <div role="tablist" aria-label="Plans" data-reveal="up" style={delay(100)} className="-mt-px flex gap-6 lg:gap-14">
            {PLANS.map((p, i) => (
              <button
                key={p.tier}
                id={`pricing-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-controls={`pricing-panel-${i}`}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={onTabKey}
                className={`flex min-w-0 flex-1 flex-wrap items-center gap-x-8 border-t pt-6 max-sm:flex-col max-sm:items-start text-left text-[16px] leading-6 transition-colors ${i === active ? "border-white" : "border-transparent hover:border-white/30"}`}
              >
                <span className="flex-1 text-white">{p.tier}</span>
                <span className="whitespace-nowrap text-white/70">{p.amount}</span>
              </button>
            ))}
          </div>
          {/* the two tickets share one cell; the other plan lies behind, turned
              2° with its centre 47px lower and 5.6px right (as in Figma), so
              its paper shows through the front one's window and perforation */}
          {/* on phones the turned back ticket would poke past the screen edge,
              so it turns less there; both tickets stretch to the taller one so
              only the back one's foot shows below the front. Plain transform,
              not translate/rotate: Safari keeps the masked paper and the glass
              in step with it. */}
          <div
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            // a swipe that ends over a button or link shouldn't also press it
            onClickCapture={(e) => { if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; } }}
            data-reveal="fade"
            style={delay(200)}
            className="grid touch-pan-y pb-10 select-none max-lg:overflow-x-clip lg:select-auto lg:pb-[62px]"
          >
            {PLANS.map((p, i) => {
              const front = i === active;
              return (
                <div
                  key={p.tier}
                  className={`relative [grid-area:1/1] transition-transform ease-out ${front && drag !== null ? "duration-0" : "duration-500"} ${front ? "z-10" : "[transform:translate(3px,28px)_rotate(1deg)] lg:[transform:translate(5.6px,47px)_rotate(2deg)]"}`}
                  style={front && drag !== null ? { transform: `translateX(${drag}px) rotate(${drag / 40}deg)` } : undefined}
                >
                  <div id={`pricing-panel-${i}`} role="tabpanel" aria-labelledby={`pricing-tab-${i}`} inert={!front} className="h-full">
                    <Ticket plan={p} />
                  </div>
                  {!front && (
                    <button type="button" tabIndex={-1} aria-hidden onClick={() => setActive(i)} className="absolute inset-0 cursor-pointer" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
