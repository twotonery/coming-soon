"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { clockText } from "./clock";
import { mountStone } from "./engine";

// The coming-soon page: the footer's debossed wordmark as a slab of stone the
// visitor can carve. engine.ts draws the stone; this is the page around it
// (its styles are the .stone-* rules in globals.css).
// The image underneath is the original footer wordmark: it shows until the
// stone is running, and stays if the browser can't draw it.
export function ComingSoon() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const stone = mountStone(root.current, {
      sounds: { carve: "/sfx/stone-roll.mp3", heal: "/sfx/stone-heal.mp3", idle: "/sfx/stone-idle.mp3" },
    });
    return () => stone?.destroy();
  }, []);

  // Sunlit is the limestone, Sunset the teal stone (engine.ts reads data-stone).
  const [sunset, setSunset] = useState(false);
  // The clock is filled in once the page is running, since only the browser knows the visitor's time.
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(clockText(new Date()));
    tick();
    const timer = window.setInterval(tick, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main ref={root} data-stone={sunset ? "teal" : undefined} className="stone fixed inset-0 touch-none overflow-hidden select-none">
      <div aria-hidden className="absolute inset-x-0 top-[43.7%] h-[160px] -translate-y-1/2 mix-blend-luminosity sm:h-[260px] lg:h-[392px]">
        <Image src="/figma/footer-wordmark.png" alt="" fill sizes="100vw" className="object-cover" />
      </div>
      <canvas data-stone-canvas aria-hidden className="stone-canvas absolute inset-0 size-full" />

      <h1 className="sr-only">Twotonery</h1>
      <p className="stone-tag">
        Thoughtful design for what comes next.
        <br />
        Coming soon December 2026.
      </p>
      <p className="stone-talk">
        Like what you see?{" "}
        <a href="https://cal.com/twotonerydesign/15min" target="_blank" rel="noopener noreferrer">
          Let&rsquo;s talk.
        </a>
      </p>
      <p className="stone-clock">{clock}</p>
      <p className="stone-copy">© Twotonery 2026. All right reserved.</p>

      <div className="stone-switch" role="group" aria-label="Light">
        <button type="button" aria-pressed={sunset} onClick={() => setSunset(true)}>
          Sunset
        </button>
        <span aria-hidden>–</span>
        <button type="button" aria-pressed={!sunset} onClick={() => setSunset(false)}>
          Sunlit
        </button>
      </div>

      <button type="button" data-stone-sound aria-pressed="true" aria-label="Sound effects" className="stone-sound">
        <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.2h2.3L8 3.4v9.2L4.8 9.8H2.5z" />
          <path className="stone-sound-on" d="M10.4 5.8a3.1 3.1 0 0 1 0 4.4M12.2 4a5.6 5.6 0 0 1 0 8" />
          <path className="stone-sound-off" d="M10.8 6.2l3 3.6m0-3.6l-3 3.6" />
        </svg>
        <span className="stone-sound-on">Sound on</span>
        <span className="stone-sound-off">Sound off</span>
      </button>

      <div data-stone-hint aria-hidden className="stone-hint">
        Click to carve
      </div>
    </main>
  );
}
