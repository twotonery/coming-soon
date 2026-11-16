"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { BOOKING_HREF, DISPLAY, GUTTER, Words, delay } from "./shared";
import { playCardFlip } from "./sounds";
import "./pricing.css";

// Pricing, from the Figma section (Twotonery Brand: 426:833 with Growth in
// front, 426:998 with Dedicated in front): plan tabs over a pile of two
// tickets; choosing a plan turns the pile over, with the sound of a card.

type Plan = {
  tier: string;
  amount: string;
  blurb: string[];
  stock: "growth" | "dedicated";
  ink: string;
  cta: { label: string; className: string };
};

const PLANS: Plan[] = [
  {
    tier: "Growth",
    amount: "From $XXX",
    blurb: ["For businesses ready to build, launch, or improve something specific."],
    stock: "growth",
    ink: "text-ink",
    cta: { label: "Start a project", className: "bg-ink text-white hover:bg-ink/85" },
  },
  {
    tier: "Dedicated",
    amount: "Let’s talk",
    blurb: ["Your team, with design built in.", "For businesses that need a consistent design partner as priorities evolve."],
    stock: "dedicated",
    ink: "text-white",
    cta: { label: "Book a strategy call", className: "bg-white text-teal hover:bg-white/85" },
  },
];

// A ticket: paper with a stamp stuck on one half and the plan written on the
// other, either side of a perforated tear. pricing.css cuts the paper and moves
// the writing as the ticket goes to the front or the back of the pile.
function Ticket({ plan }: { plan: Plan }) {
  return (
    <article className={`relative isolate flex h-full flex-col [container-type:inline-size] lg:block lg:h-[338px] ${plan.ink}`}>
      <span aria-hidden data-stock={plan.stock} className="pricing-paper absolute inset-0 -z-10" />
      {/* sized from the ticket's width (cqw), not by aspect-ratio: Safari works
          an aspect-ratio box's height out from the full width here, before the
          margins come off */}
      <div aria-hidden className="pricing-stamp relative m-6 h-[calc((100cqw-48px)*274/372)] w-[calc(100cqw-48px)] shrink-0 overflow-hidden lg:absolute lg:top-8 lg:left-8 lg:m-0 lg:h-[274px] lg:w-[372px]">
        {/* the painting fills the stamp upright and turns with it, a quarter clockwise */}
        <span className="absolute top-1/2 left-1/2 h-[135.77%] w-[73.66%] -translate-1/2 rotate-90 bg-[url(/figma/hero.png)] bg-cover bg-center" />
        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgb(31_75_80/0.5),rgb(14_31_33/0.28)_45%)]" />
      </div>
      <div className="relative flex flex-1 flex-col items-start px-6 pt-8 pb-8 lg:absolute lg:top-8 lg:bottom-8 lg:left-[473px] lg:w-[308px] lg:p-0">
        {/* the perforation below lg, where the mask has no slots */}
        <span aria-hidden className="absolute inset-x-[22px] top-0 flex -translate-y-1/2 justify-between overflow-hidden lg:hidden">
          {Array.from({ length: 12 }, (_, n) => <span key={n} className="h-1.5 w-4 shrink-0 rounded-full bg-ink" />)}
        </span>
        <span aria-hidden data-at="head" className="pricing-spring" />
        <div className="flex w-full flex-col gap-1.5">
          <h3 className="pricing-name font-display text-[40px] leading-[1.2] font-medium tracking-[-0.04em] lg:text-[48px]">{plan.tier}</h3>
          <p className="text-[16px] leading-6">
            {plan.blurb.map((line) => <span key={line} className="block">{line}</span>)}
          </p>
        </div>
        <span aria-hidden data-at="foot" className="pricing-spring min-h-8 lg:min-h-[37px]" />
        <a href={BOOKING_HREF} className={`pricing-cta rounded-md px-2.5 py-1 text-[16px] leading-6 font-semibold whitespace-nowrap ${plan.cta.className}`}>
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
  // set from the first change of plan on: lets the pile's flip play (pricing.css)
  const [turned, setTurned] = useState(false);
  // Turn the pile to a plan, with the sound of the card going over.
  const choose = (next: number) => {
    if (next === active) return;
    setActive(next);
    setTurned(true);
    playCardFlip();
  };
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
    if (Math.abs(drag) > SWIPE) choose((active + 1) % PLANS.length);
    swiped.current = true;
    setDrag(null);
  };

  // arrow keys move between the two tabs
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = (active + 1) % PLANS.length;
    choose(next);
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
                onClick={() => choose(i)}
                onKeyDown={onTabKey}
                className={`flex min-w-0 flex-1 flex-wrap items-center gap-x-8 border-t pt-6 max-sm:flex-col max-sm:items-start text-left text-[16px] leading-6 transition-colors ${i === active ? "border-white" : "border-transparent hover:border-white/30"}`}
              >
                <span className="flex-1 text-white">{p.tier}</span>
                <span className="whitespace-nowrap text-white/70">{p.amount}</span>
              </button>
            ))}
          </div>
          {/* the two tickets share one cell and stretch to the taller one;
              pricing.css places the one behind and turns the pile */}
          <div
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            // a swipe that ends over a button or link shouldn't also press it
            onClickCapture={(e) => { if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; } }}
            data-reveal="fade"
            style={delay(200)}
            data-turned={turned ? "" : undefined}
            className="pricing-pile grid touch-pan-y pb-10 select-none max-lg:overflow-x-clip lg:select-auto lg:pb-[62px]"
          >
            {PLANS.map((p, i) => {
              const front = i === active;
              return (
                <div
                  key={p.tier}
                  data-role={front ? "front" : "back"}
                  className="pricing-card"
                  // a finger dragging the front ticket carries it, tilting as it goes
                  style={front && drag !== null ? { transform: `translateX(${drag}px) rotate(${drag / 40}deg)`, animation: "none" } : undefined}
                >
                  <div id={`pricing-panel-${i}`} role="tabpanel" aria-labelledby={`pricing-tab-${i}`} inert={!front} className="h-full">
                    <Ticket plan={p} />
                  </div>
                  {!front && (
                    <button type="button" tabIndex={-1} aria-hidden onClick={() => choose(i)} className="absolute inset-0 cursor-pointer" />
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
