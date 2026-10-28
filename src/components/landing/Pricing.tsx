"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";
import { BOOKING_HREF, DISPLAY, GUTTER } from "./shared";
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
    <article className="relative isolate flex flex-col [container-type:inline-size] lg:block lg:h-[338px]">
      <span aria-hidden className={`pricing-paper absolute inset-0 -z-10 ${plan.paper}`} />
      <div className="relative m-6 aspect-[372/274] text-white lg:absolute lg:top-8 lg:left-8 lg:m-0 lg:h-[274px] lg:w-[372px]">
        <span aria-hidden className="pricing-stamp absolute inset-0 -z-10 overflow-hidden backdrop-blur-[32.45px]">
          {/* the painting fills the stamp upright and turns with it, a quarter clockwise */}
          <span className="absolute top-1/2 left-1/2 h-[135.77%] w-[73.66%] -translate-1/2 rotate-90 bg-[url(/figma/hero.png)] bg-cover bg-center opacity-44" />
        </span>
        <p className={`absolute top-8 left-8 ${LABEL}`}>{plan.tier}</p>
        <div className="absolute inset-x-8 bottom-8 flex flex-col gap-1.5 lg:right-auto lg:w-[308px]">
          <p className="font-display text-[32px] leading-10 font-medium tracking-[-0.04em]">
            {plan.amount}
            {plan.unit && <span className="text-[14px] font-normal"> {plan.unit}</span>}
          </p>
          <p className="text-[16px] leading-6">{plan.blurb}</p>
        </div>
      </div>
      <div className="relative flex flex-col items-start justify-between gap-8 px-6 pt-8 pb-8 text-ink lg:absolute lg:top-8 lg:bottom-8 lg:left-[473px] lg:w-[367px] lg:p-0">
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

export function Pricing() {
  const [active, setActive] = useState(0);

  // arrow keys move between the two tabs
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = (active + 1) % PLANS.length;
    setActive(next);
    document.getElementById(`pricing-tab-${next}`)?.focus();
  };

  return (
    <section id="pricing" data-nav-tone="dark" className={`flex flex-col gap-16 bg-ink py-20 text-white lg:py-[120px] ${GUTTER}`}>
      <div className="grid gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,868px)]">
        <h2 className="pt-1.5 text-[16px] leading-6 font-normal lg:w-[254px]">Pricing</h2>
        <p className={`${DISPLAY} indent-[88px]`}>
          An investment in better design. Clear scopes, thoughtful collaboration, and design solutions built around what your business actually needs.
        </p>
      </div>
      <div className="flex flex-col gap-10 border-t border-white/30 xl:flex-row xl:items-start xl:justify-between">
        <p className="w-[291px] max-w-full pt-6 text-[16px] leading-6 text-white/80">
          Select the perfect package that aligns with your team&apos;s unique needs!
        </p>
        <div className="flex w-full max-w-[872px] flex-col gap-14 xl:w-[872px] xl:shrink-0">
          {/* tabs sit on the divider: the active one's rule lies over it */}
          <div role="tablist" aria-label="Plans" className="-mt-px flex gap-6 lg:gap-14">
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
                className={`flex min-w-0 flex-1 flex-wrap items-center gap-x-8 border-t pt-6 text-left text-[16px] leading-6 transition-colors ${i === active ? "border-white" : "border-transparent hover:border-white/30"}`}
              >
                <span className="flex-1 text-white">{p.tier}</span>
                <span className="whitespace-nowrap text-white/70">{p.amount}</span>
              </button>
            ))}
          </div>
          {/* the two tickets share one cell; the other plan lies behind, turned
              2° with its centre 47px lower and 5.6px right (as in Figma), so
              its paper shows through the front one's window and perforation */}
          {/* on phones the turned back ticket would poke past the screen edge */}
          <div className="grid pb-[62px] max-lg:overflow-x-clip">
            {PLANS.map((p, i) => {
              const front = i === active;
              return (
                <div
                  key={p.tier}
                  className={`relative [grid-area:1/1] transition-[translate,rotate] duration-500 ease-out ${front ? "z-10" : "translate-x-[5.6px] translate-y-[47px] rotate-2"}`}
                >
                  <div id={`pricing-panel-${i}`} role="tabpanel" aria-labelledby={`pricing-tab-${i}`} inert={!front}>
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
