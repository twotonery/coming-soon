"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { DISPLAY_CENTRED, GUTTER, Words, delay } from "./shared";

// Only the first answer is in the Figma file; the rest are draft copy.
const QUESTIONS = [
  { q: "What kind of projects do you take on?", a: "Brand strategy, visual identity, websites, and digital products. We're at our best when a complex product needs to feel clear and human." },
  { q: "How does a project start?", a: "With a short call about your product, your team and what success looks like. We follow up with a clear scope, timeline and quote." },
  { q: "How long does a project take?", a: "Most identity and website projects take six to ten weeks. Product work usually runs as an ongoing monthly partnership." },
  { q: "Can you work with our in-house team?", a: "Yes. We often work as an extension of in-house product, marketing and engineering teams, inside your tools and rituals." },
  { q: "How is pricing structured?", a: "Ongoing product work is a monthly plan. Larger or more complex engagements are scoped and quoted individually." },
  { q: "Do you handle development?", a: "For websites, yes. For products, we hand off clean, documented designs and work closely with your developers through the build." },
  { q: "What happens after launch?", a: "We stay on to measure, refine and support. Many teams keep us on a monthly plan once the first release is out." },
  { q: "What happens after launch?", a: "We stay on to measure, refine and support. Many teams keep us on a monthly plan once the first release is out." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();

  return (
    <section className={`paper flex flex-col items-center gap-14 overflow-clip py-20 lg:py-[120px] ${GUTTER}`}>
      <div className="flex w-[664px] max-w-full flex-col items-center gap-6 text-center">
        <p data-reveal="up" className="text-[16px] leading-6">Common Questions Answered</p>
        <h2 data-reveal="words" style={delay(80)} className={DISPLAY_CENTRED}><Words text={"Everything you need\nto know first."} /></h2>
      </div>

      <ul className="flex w-[664px] max-w-full flex-col gap-3">
        {QUESTIONS.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={i} data-reveal="up" style={delay(Math.min(i, 5) * 60)} className="group relative border border-line-2 bg-white px-[19px] py-[15px] text-[16px] leading-6">
              <h3>
                {/* the button's hit area covers the whole card */}
                <button
                  type="button"
                  id={`${id}-q${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`${id}-a${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full cursor-pointer text-left transition-colors group-hover:text-teal after:absolute after:inset-0"
                >
                  {item.q}
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
