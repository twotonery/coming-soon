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
// No ground of its own on desktop: it reads the section underneath
// (data-nav-tone="dark" marks the dark ones) and turns ink over paper, and the
// logo shrinks once the bar has left the hero. Below lg the docked bar gets a
// frosted ground (there is no room to keep clear of the copy), the links move
// into a full-screen menu behind the two-line button, and on phones the CTA shortens.
export function Navbar() {
  const ref = useRef<HTMLDivElement>(null);
  const [tone, setTone] = useState<"dark" | "light">("dark");
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

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

  // while the menu is open the page holds still; Escape or growing past lg closes it
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const wide = window.matchMedia("(min-width: 64rem)");
    const onWide = () => { if (wide.matches) setOpen(false); };
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      data-tone={open ? "dark" : tone}
      data-compact={compact}
      data-open={open}
      className="group sticky top-0 z-50 -mt-[calc(var(--hero-h)/2+var(--nav-h)/2)] h-(--nav-h) text-white transition-colors duration-300 data-[tone=light]:text-ink"
    >
      {/* the mobile ground: a sibling layer, so its blur doesn't trap the fixed menu */}
      <span
        aria-hidden
        className="absolute inset-0 bg-ink/56 opacity-0 backdrop-blur-[12px] transition-opacity duration-300 group-data-[tone=light]:bg-white/72 max-lg:group-data-[compact=true]:opacity-100 group-data-[open=true]:opacity-0!"
      />

      {/* the menu, below lg */}
      <div
        id="mobile-menu"
        data-lenis-prevent
        inert={!open}
        className="pointer-events-none fixed inset-0 flex flex-col justify-between overflow-y-auto bg-ink px-4 pt-[calc(var(--nav-h)+40px)] pb-10 opacity-0 transition-opacity duration-300 group-data-[open=true]:pointer-events-auto group-data-[open=true]:opacity-100 sm:px-11 lg:hidden"
      >
        <nav className="flex flex-col border-t border-white/20">
          {NAV.map((n, i) => (
            <a
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              style={{ transitionDelay: open ? `${80 + i * 50}ms` : "0ms" }}
              className="flex items-baseline justify-between border-b border-white/20 py-5 font-display text-[34px] leading-10 tracking-[-0.04em] opacity-0 translate-y-3 transition-[opacity,translate] duration-500 ease-out group-data-[open=true]:translate-y-0 group-data-[open=true]:opacity-100"
            >
              {n.label}
              <span className="font-sans text-[12px] leading-[18px] tracking-[0.08em] text-white/50">0{i + 1}</span>
            </a>
          ))}
        </nav>
        <div className="mt-12 flex flex-col gap-4">
          <p className="max-w-[280px] text-[16px] leading-6 text-white/64">
            A design partner for healthcare companies. Tell us what you&apos;re building.
          </p>
          <a
            href={BOOKING_HREF}
            onClick={() => setOpen(false)}
            className="pill pill-white py-3"
          >
            Book a strategy call
          </a>
        </div>
      </div>

      <div className={`relative flex h-full items-center justify-between ${GUTTER}`}>
        <a href="#top" aria-label="Twotonery" onClick={() => setOpen(false)} className="flex h-9 items-center sm:w-[167px]">
          <span
            aria-hidden
            className="h-6 w-[128px] origin-left sm:h-[30px] sm:w-[159px] bg-current transition-transform duration-500 ease-out group-data-[compact=true]:scale-75"
            style={{ mask: LOGO_MASK, WebkitMask: LOGO_MASK }}
          />
        </a>
        <nav className="hidden items-center gap-8 text-[16px] leading-6 lg:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition-opacity hover:opacity-70">{n.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={BOOKING_HREF}
            className="pill pill-glass stone-shine"
          >
            <span className="sm:hidden">Book a call</span>
            <span className="max-sm:hidden">Book a strategy call</span>
          </a>
          {/* two strokes that cross into an X when open */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="pill pill-glass relative size-[38px] p-0 lg:hidden"
          >
            <span className="absolute top-1/2 left-1/2 h-[1.5px] w-4 -translate-x-1/2 -translate-y-[3.5px] bg-current transition-transform duration-300 ease-out group-data-[open=true]:translate-y-[-0.75px] group-data-[open=true]:rotate-45" />
            <span className="absolute top-1/2 left-1/2 h-[1.5px] w-4 -translate-x-1/2 translate-y-[2px] bg-current transition-transform duration-300 ease-out group-data-[open=true]:translate-y-[-0.75px] group-data-[open=true]:-rotate-45" />
          </button>
        </div>
      </div>
    </div>
  );
}
