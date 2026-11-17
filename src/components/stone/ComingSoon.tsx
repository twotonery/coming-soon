"use client";

import { useEffect, useRef, useState } from "react";
import { clockText, findCity } from "./clock";
import { mountStone } from "./engine";

// The coming-soon page: the footer's debossed wordmark as a slab of stone the
// visitor can carve. engine.ts draws the stone; this is the page around it
// (its styles are the .stone-* rules in globals.css).
// Underneath it is a still of the stone: it shows until the live stone is
// running, and stays if the browser can't draw it.
export function ComingSoon() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const stone = mountStone(root.current, {
      sounds: { carve: "/sfx/stone-roll.mp3", heal: "/sfx/stone-heal.mp3", idle: "/sfx/stone-idle.mp3" },
    });
    return () => stone?.destroy();
  }, []);

  // Sunset is the teal stone, and what the page opens on; Sunlit is the limestone
  // (engine.ts reads data-stone).
  const [sunset, setSunset] = useState(true);
  // The phone's browser bars (above and below the page) take the page's background
  // colour, so it follows the stone: they then read as part of the slab.
  useEffect(() => {
    const colour = sunset ? "#5b7d7b" : "#d6c4a3";
    document.documentElement.style.backgroundColor = document.body.style.backgroundColor = colour;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colour);
  }, [sunset]);
  // The clock is filled in once the page is running, since only the browser knows the visitor's time.
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(clockText(new Date()));
    tick();
    void findCity().then(tick);
    const timer = window.setInterval(tick, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main ref={root} data-stone={sunset ? "teal" : undefined} className="stone fixed inset-0 touch-none overflow-hidden select-none">
      {/* the still of the Sunset stone the page opens on (see .stone in globals.css), fetched early */}
      <link rel="preload" as="image" href="/stone/teal-wide.webp" media="(min-aspect-ratio: 1/1)" />
      <link rel="preload" as="image" href="/stone/teal-tall.webp" media="(max-aspect-ratio: 1/1)" />
      <canvas data-stone-canvas aria-hidden className="stone-canvas absolute inset-0 size-full" />

      <h1 className="sr-only">Twotonery</h1>
      <p className="stone-tag">
        <strong>Thoughtful design for what comes next.</strong>
        <br />
        Coming soon December 2026.
      </p>
      <p className="stone-talk">
        <span>Like what you see?</span>
        <a href="https://cal.com/twotonerydesign/15min" target="_blank" rel="noopener noreferrer" className="stone-glass stone-shine">
          Let&rsquo;s talk.
        </a>
      </p>
      <p className="stone-clock">{clock}</p>
      <p className="stone-copy">© Twotonery 2026. All right reserved.</p>

      <div className="stone-switch stone-glass stone-shine" data-on={sunset ? "sunset" : "sunlit"} role="group" aria-label="Light">
        <span aria-hidden className="stone-knob" />
        <button type="button" aria-pressed={sunset} onClick={() => setSunset(true)}>
          Sunset
        </button>
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

      <div data-stone-hint aria-hidden className="stone-hint stone-glass stone-shine">
        Click to carve
      </div>
    </main>
  );
}
