import Image from "next/image";
import { HERO } from "@/content";
import { Dot, HLine, MediaFill, VLine } from "./shared";

// Square markers, as offsets from the centre of the hero (Figma 8:37–8:48).
const DOTS: [number, number][] = [
  [-244, 202], [243, -260], [-321, 191], [320, -247], [-244, 130], [-422, 158],
  [243, -332], [-244, -332], [-244, 274], [243, 274], [243, -188], [424, -205],
];

// The logo / links / CTA row across the middle is the Navbar, layered on top from page.tsx.
export function Hero() {
  return (
    <header id="top" data-nav-tone="dark" className="relative h-(--hero-h) overflow-clip text-white">
      <div className="absolute -top-[108px] -right-3.5 -bottom-4 -left-8">
        {/* the background comes from the content editor: a picture, or a clip on a loop */}
        <MediaFill media={HERO} sizes="100vw" preload />
        <div className="absolute inset-0 bg-black/32" />
      </div>

      {/* frame: ellipse, crosshair lines and markers */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-[calc(50%-30.23px)] left-[calc(50%-10.13px)] h-[438.728px] w-[1008.14px] -translate-1/2 -rotate-[10.88deg]">
          <Image src="/figma/hero-ellipse.svg" alt="" fill />
        </div>
        <VLine left="calc(50% - 244px)" />
        <VLine left="calc(50% + 243px)" />
        <HLine className="top-[calc(50%-332px)]" />
        <HLine className="top-[calc(50%+274px)]" />
        {DOTS.map(([x, y]) => (
          <Dot key={`${x},${y}`} left={`calc(50% + ${x}px)`} top={`calc(50% + ${y}px)`} />
        ))}
      </div>
    </header>
  );
}
