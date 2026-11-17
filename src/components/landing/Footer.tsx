"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { clockText } from "@/components/stone/clock";
import { mountStone } from "@/components/stone/engine";
import { BOOKING_HREF, GUTTER, Words, delay } from "./shared";

const LINKS = [
  { label: "Project", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Pricing", href: "#pricing" },
  { label: "About us", href: "#about" },
  { label: "Contact", href: BOOKING_HREF },
];

// Placeholder profile links.
const SOCIAL = ["Instagram", "Dribbble", "Behance", "Linkedin"];

// The footer (Figma Code-layer 11:2), on the coming-soon page's stone: the
// debossed wordmark is a slab the visitor can carve (src/components/stone;
// its styles are the .stone-* rules in globals.css), and the footer's menu and
// links lie on it. The flat teal footer underneath (.stone-still) shows until
// the stone is drawing, and stays if the browser can't draw it.
export function Footer() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const stone = mountStone(root.current, {
      sounds: { carve: "/sfx/stone-roll.mp3", heal: "/sfx/stone-heal.mp3", idle: "/sfx/stone-idle.mp3" },
    });
    return () => stone?.destroy();
  }, []);

  // Sunset is the teal stone, and what the footer opens on; Sunlit is the
  // limestone (engine.ts reads data-stone).
  const [sunset, setSunset] = useState(true);
  // the navbar reads the ground under it when the page scrolls: tell it the stone changed
  useEffect(() => { window.dispatchEvent(new Event("scroll")); }, [sunset]);
  // The clock is filled in once the page is running, since only the browser knows the visitor's time.
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(clockText(new Date()));
    tick();
    const timer = window.setInterval(tick, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer
      ref={root}
      data-stone={sunset ? "teal" : undefined}
      data-nav-tone={sunset ? "dark" : undefined}
      className={`stone stone-footer relative isolate flex flex-col overflow-hidden pb-10 select-none [--hint-top:128px] sm:[--hint-top:214px] lg:h-[900px] lg:[--hint-top:330px] ${GUTTER}`}
    >
      {/* the still footer: teal paper ground, with the debossed wordmark laid over its top */}
      <div aria-hidden className="stone-still absolute inset-0 -z-10 bg-teal">
        <Image src="/figma/footer-bg.png" alt="" fill sizes="100vw" className="object-cover" />
        <div className="relative h-[160px] mix-blend-luminosity sm:h-[260px] lg:h-[392px]">
          <Image src="/figma/footer-wordmark.png" alt="" fill sizes="100vw" className="object-cover" />
        </div>
      </div>
      <canvas data-stone-canvas aria-hidden className="stone-canvas absolute inset-0 size-full" />
      {/* the room the wordmark's band takes at the head of the footer (engine.ts lays the band over it) */}
      <div data-stone-band aria-hidden className="-mx-(--gutter) h-[160px] shrink-0 sm:h-[260px] lg:h-[392px]" />

      <div className="flex flex-col gap-14 lg:gap-[72px]">
        <div aria-hidden className="stone-art relative h-px w-full">
          <Image src="/figma/footer-line.svg" alt="" fill />
        </div>
        <div className="flex flex-col gap-14 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col items-start gap-6">
            <p data-reveal="words" className="w-[241px] text-[24px] leading-8"><Words text="Thoughtful design for what comes next." /></p>
            {/* reveals sit on wrappers where the element has a hover transition of its own */}
            <div data-reveal="up" style={delay(200)}>
              <a href={BOOKING_HREF} className="pill pill-white">
                Book a strategy call
              </a>
            </div>
          </div>
          <div className="flex w-full flex-col gap-14 sm:flex-row lg:w-[693px]">
            <nav className="flex flex-1 flex-col gap-4 text-[24px] leading-8">
              {LINKS.map((l, i) => (
                <div key={l.label} data-reveal="up" style={delay(i * 60)}>
                  <a href={l.href} className="block w-fit transition-opacity hover:opacity-70">{l.label}</a>
                </div>
              ))}
            </nav>
            <div className="flex flex-1 flex-col gap-4">
              <p data-reveal="up" className="stone-muted text-[16px] leading-6">Social</p>
              <ul className="flex flex-col gap-2">
                {SOCIAL.map((s, i) => (
                  <li key={s} data-reveal="up" style={delay(60 + i * 60)} className="flex flex-col gap-2">
                    <a href="#" className="group peer flex items-center gap-2.5 text-[20px] leading-[26px]">
                      <span className="flex-1">{s}</span>
                      <Image src="/figma/arrow-out.svg" alt="" width={16} height={16} className="stone-art transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                    {/* the rule turns full strength while its link is hovered or focused */}
                    <div aria-hidden className="stone-rule relative h-px w-full">
                      <Image src={i === 0 ? "/figma/rule-first.svg" : "/figma/rule.svg"} alt="" fill className="stone-art" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* which light the stone stands in */}
      <div className="mt-16 flex lg:mt-auto">
        <div className="stone-switch stone-glass stone-shine" data-on={sunset ? "sunset" : "sunlit"} role="group" aria-label="Light">
          <span aria-hidden className="stone-knob" />
          <button type="button" aria-pressed={sunset} onClick={() => setSunset(true)}>
            Sunset
          </button>
          <button type="button" aria-pressed={!sunset} onClick={() => setSunset(false)}>
            Sunlit
          </button>
        </div>
      </div>

      {/* the small print, with the time here and at the studio and the site's sound on its line */}
      <div data-reveal="up" className="stone-muted mt-6 flex flex-col gap-4 text-[16px] leading-6 whitespace-nowrap lg:flex-row lg:items-center lg:justify-between">
        <p>© Twotonery 2026. All right reserved.</p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 lg:gap-x-10">
          <p className="stone-clock">{clock}</p>
          <button type="button" data-stone-sound aria-pressed="true" aria-label="Sound effects" className="stone-sound">
            <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 6.2h2.3L8 3.4v9.2L4.8 9.8H2.5z" />
              <path className="stone-sound-on" d="M10.4 5.8a3.1 3.1 0 0 1 0 4.4M12.2 4a5.6 5.6 0 0 1 0 8" />
              <path className="stone-sound-off" d="M10.8 6.2l3 3.6m0-3.6l-3 3.6" />
            </svg>
            <span className="stone-sound-on">Sound on</span>
            <span className="stone-sound-off">Sound off</span>
          </button>
          <a href="#top" className="stone-link flex items-center gap-2.5">
            Back to top
            <Image src="/figma/arrow-up.svg" alt="" width={16} height={16} className="stone-art" />
          </a>
        </div>
      </div>

      <div data-stone-hint aria-hidden className="stone-hint stone-glass stone-shine">
        Click to carve
      </div>
    </footer>
  );
}
