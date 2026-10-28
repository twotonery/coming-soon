"use client";

import { useEffect, useRef, useState } from "react";
import { BOOKING_HREF, GUTTER } from "./shared";

const NAV = [
  { label: "Project Highlights", href: "#work" },
  { label: "Service", href: "#services" },
  { label: "Pricing", href: "#pricing" },
  { label: "About Us", href: "#about" },
];

// The white logo SVG used as a mask, so it takes the bar's text colour.
const LOGO_MASK = "url(/figma/logo.svg) left center / contain no-repeat";

// Sits across the middle of the hero, rides up with the page and docks at the
// top once it gets there. The negative margin lifts it from below the hero to
// its centre; <main> gives the space back with a matching top margin.
// No ground of its own: it reads the section underneath (data-nav-tone="dark"
// marks the dark ones) and turns ink over paper, and the logo shrinks once
// the bar has left the hero.
export function Navbar() {
  const ref = useRef<HTMLDivElement>(null);
  const [tone, setTone] = useState<"dark" | "light">("dark");
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const check = () => {
      const bar = ref.current?.getBoundingClientRect();
      if (!bar) return;
      const y = bar.top + bar.height / 2;
      const under = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.top <= y && y < r.bottom;
      };
      setTone([...document.querySelectorAll("[data-nav-tone=dark]")].some(under) ? "dark" : "light");
      const hero = document.getElementById("top");
      setCompact(!hero || !under(hero));
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-tone={tone}
      data-compact={compact}
      className="group sticky top-0 z-50 -mt-[calc(var(--hero-h)/2+var(--nav-h)/2)] h-(--nav-h) text-white transition-colors duration-300 data-[tone=light]:text-ink"
    >
      <div className={`flex h-full items-center justify-between ${GUTTER}`}>
        <a href="#top" aria-label="Twotonery" className="flex h-9 w-[167px] items-center">
          <span
            aria-hidden
            className="h-[30px] w-[159px] origin-left bg-current transition-transform duration-500 ease-out group-data-[compact=true]:scale-75"
            style={{ mask: LOGO_MASK, WebkitMask: LOGO_MASK }}
          />
        </a>
        <nav className="hidden items-center gap-8 text-[16px] leading-6 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition-opacity hover:opacity-70">{n.label}</a>
          ))}
        </nav>
        <a
          href={BOOKING_HREF}
          className="rounded-md bg-white/12 px-3 py-1.5 text-[16px] whitespace-nowrap leading-6 font-semibold backdrop-blur-[6px] transition-colors duration-300 hover:bg-white/20 group-data-[tone=light]:bg-ink/6 group-data-[tone=light]:hover:bg-ink/12"
        >
          Book a strategy call
        </a>
      </div>
    </div>
  );
}
