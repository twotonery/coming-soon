"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { mountStone } from "./engine";

// The coming-soon page: the footer's debossed wordmark as a slab of stone the
// visitor can carve. engine.ts draws the stone; this is the page around it.
// The two images underneath are the original footer art: they show until the
// stone is running, and stay if the browser can't draw it.
export function ComingSoon() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const stone = mountStone(root.current);
    return () => stone?.destroy();
  }, []);

  return (
    <main ref={root} className="stone fixed inset-0 touch-none overflow-hidden bg-teal text-white select-none">
      <Image src="/figma/footer-bg.png" alt="" fill preload sizes="100vw" className="object-cover" />
      <div aria-hidden className="absolute inset-x-0 top-[44%] h-[160px] -translate-y-1/2 mix-blend-luminosity sm:h-[260px] lg:h-[392px]">
        <Image src="/figma/footer-wordmark.png" alt="" fill sizes="100vw" className="object-cover" />
      </div>
      <canvas data-stone-canvas aria-hidden className="stone-canvas absolute inset-0 size-full" />

      <h1 className="sr-only">Twotonery</h1>
      <p className="pointer-events-none absolute inset-x-0 top-[76.5%] -translate-y-1/2 px-6 text-center text-[20px] text-balance leading-7 sm:text-[24px] sm:leading-8">
        Thoughtful design for what comes next.
        <br />
        Coming soon December 2026.
      </p>
      <p className="pointer-events-none absolute inset-x-0 bottom-10 px-6 text-center text-[14px] leading-6 text-white/60 sm:text-[16px]">
        © Twotonery 2026. All right reserved.
      </p>

      <button
        type="button"
        data-stone-sound
        aria-pressed="true"
        aria-label="Sound effects"
        className="stone-sound absolute top-5 right-4 flex cursor-pointer items-center gap-2 text-[14px] leading-6 text-white/60 transition-colors hover:text-white focus-visible:text-white sm:top-auto sm:right-11 sm:bottom-10 sm:text-[16px]"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.2h2.3L8 3.4v9.2L4.8 9.8H2.5z" />
          <path className="stone-sound-on" d="M10.4 5.8a3.1 3.1 0 0 1 0 4.4M12.2 4a5.6 5.6 0 0 1 0 8" />
          <path className="stone-sound-off" d="M10.8 6.2l3 3.6m0-3.6l-3 3.6" />
        </svg>
        <span className="stone-sound-on">Sound on</span>
        <span className="stone-sound-off">Sound off</span>
      </button>

      <div data-stone-hint aria-hidden className="stone-hint pointer-events-none absolute rounded-md bg-white px-2.5 py-1 text-[16px] leading-6 font-semibold whitespace-nowrap text-teal">
        click to carve
      </div>
    </main>
  );
}
