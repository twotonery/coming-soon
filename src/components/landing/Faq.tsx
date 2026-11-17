"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { FAQ as QUESTIONS } from "@/content";
import { DISPLAY_CENTRED, GUTTER, Words, delay } from "./shared";

// The questions come from the content editor (src/content); the first starts open.

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();

  return (
    <section className={`paper flex flex-col items-center gap-14 overflow-clip py-20 lg:py-[120px] ${GUTTER}`}>
      <div className="flex w-[664px] max-w-full flex-col items-center gap-6 text-center">
        <p data-reveal="up" className="text-[16px] leading-6">Common questions answered</p>
        <h2 data-reveal="words" style={delay(80)} className={DISPLAY_CENTRED}><Words text={"Everything you need\nto know first."} /></h2>
      </div>

      <ul className="flex w-[664px] max-w-full flex-col gap-3">
        {QUESTIONS.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={item.id} data-reveal="up" style={delay(Math.min(i, 5) * 60)} className="group relative border border-line-2 bg-white px-[19px] py-[15px] text-[16px] leading-6">
              <h3>
                {/* the button's hit area covers the whole card */}
                <button
                  type="button"
                  id={`${id}-q${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`${id}-a${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 text-left transition-colors group-hover:text-teal after:absolute after:inset-0"
                >
                  {item.q}
                  {/* plus, whose upright bar turns flat into a minus while open */}
                  <span aria-hidden className="relative size-3 shrink-0">
                    <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-current" />
                    <span className={`absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-current transition-transform duration-300 ease-out ${isOpen ? "rotate-90" : ""}`} />
                  </span>
                </button>
              </h3>
              <div
                id={`${id}-a${i}`}
                role="region"
                aria-labelledby={`${id}-q${i}`}
                inert={!isOpen}
                className={`relative grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <p className="overflow-hidden text-muted">
                  <span className="block pt-2">{item.a}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div aria-hidden className="absolute top-[72px] -left-[305px] hidden h-[604px] w-[693px] lg:block">
        <Image src="/figma/faq-shape-left.svg" alt="" width={694} height={605} />
      </div>
      <div aria-hidden className="absolute top-[366px] -right-[369px] hidden h-[604px] w-[693px] rotate-180 lg:block">
        <Image src="/figma/faq-shape-right.svg" alt="" width={694} height={605} />
      </div>
    </section>
  );
}
