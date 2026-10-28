"use client";

import Image from "next/image";
import { useState } from "react";
import { Dot, GUTTER, HLine, Painting, VLine } from "./shared";

const SERVICES = ["Brand strategy", "Visual identity", "Web development", "Product/UIUX"];

export function Services() {
  const [active, setActive] = useState(0);

  return (
    <section id="services" data-nav-tone="dark" className="relative h-svh max-h-[900px] min-h-[680px] overflow-clip text-white">
      <div className="absolute -top-[108px] -right-3.5 -bottom-4 -left-8">
        <Painting scrim="bg-black/32" sizes="100vw" />
      </div>

      {/* frame: lines run through the gutters, markers at the corners */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <HLine className="top-[calc(50%-332px)]" />
        <HLine className="top-[calc(50%+332px)]" />
        <div className="absolute inset-y-0 left-3.5 sm:left-[42px]"><VLine left="0px" /></div>
        <div className="absolute inset-y-0 right-3.5 sm:right-[42px]"><VLine left="0px" /></div>
        {["left-3.5 sm:left-[42px]", "right-3.5 sm:right-[42px]"].map((x) => (
          <div key={x} className={`absolute inset-y-0 ${x}`}>
            <Dot left="0px" top="calc(50% - 332px)" />
            <Dot left="0px" top="calc(50% + 332px)" />
          </div>
        ))}
      </div>

      <div className={`absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col gap-6 py-4 text-[16px] leading-6 md:flex-row md:items-center md:justify-between ${GUTTER}`}>
        <h2 className="font-normal text-silver">Our services</h2>
        <ul className="contents max-md:flex max-md:flex-col max-md:gap-3 max-md:pl-[18px]">
          {SERVICES.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                aria-pressed={active === i}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className="relative cursor-pointer transition-opacity hover:opacity-100 aria-[pressed=false]:opacity-85"
              >
                <span
                  aria-hidden
                  className={`absolute top-1/2 -left-[18px] size-1.5 -translate-y-1/2 transition-[opacity,scale] duration-300 ${active === i ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
                >
                  <Image src="/figma/dot.svg" alt="" width={6} height={6} />
                </span>
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
