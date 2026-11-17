import Image from "next/image";
import { Fragment, type CSSProperties } from "react";

// Placeholder until there is a booking link.
export const BOOKING_HREF = "mailto:hello@twotonery.com";

// Section statement / title type (Epilogue 48/56, -4% tracking); centred titles run 48/54.
export const DISPLAY = "font-display text-[34px] leading-[40px] tracking-[-0.04em] sm:text-[48px] sm:leading-[56px]";
export const DISPLAY_CENTRED = "font-display text-[34px] leading-[40px] tracking-[-0.04em] sm:text-[48px] sm:leading-[54px]";

// Side gutter used by every section: --gutter (globals.css) is 16px on phones
// and 44px above, and grows on screens wider than 1440px so the content stays
// 1352px wide in the middle while grounds still run edge to edge.
export const GUTTER = "px-(--gutter)";

// Thin white rules from the Figma file (stroke white @ 20%).
export function HLine({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`absolute inset-x-0 h-px -translate-y-1/2 ${className}`}>
      <Image src="/figma/line-h.svg" alt="" fill />
    </div>
  );
}

// The upright rule (line-v.svg's white @ 20%), run the full height of its frame
// rather than the svg's fixed 942px, so it reaches the edges on tall screens.
export function VLine({ left }: { left: string }) {
  return <div aria-hidden className="absolute inset-y-0 w-px -translate-x-1/2 bg-white/20" style={{ left }} />;
}

export function Dot({ left, top }: { left: string; top: string }) {
  return <span aria-hidden className="absolute size-1 -translate-1/2 bg-white" style={{ left, top }} />;
}

// The hero painting, with a black scrim, used across the page.
export function Painting({ scrim, sizes, preload }: { scrim: string; sizes: string; preload?: boolean }) {
  return (
    <>
      <Image src="/figma/hero.png" alt="" fill sizes={sizes} preload={preload} className="object-cover" />
      <div className={`absolute inset-0 ${scrim}`} />
    </>
  );
}

// Holds a reveal back (ms) after the ones around it; see [data-reveal] in globals.css.
export const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

// Splits a line of copy into words for data-reveal="words"; a \n breaks the
// line. Screen readers get the sentence whole.
export function Words({ text }: { text: string }) {
  let i = 0;
  return (
    <>
      <span className="sr-only">{text.replace(/\n/g, " ")}</span>
      <span aria-hidden>
        {text.split("\n").map((line, l) => (
          <Fragment key={l}>
            {l > 0 && <br />}
            {line.split(" ").map((word, k) => (
              <Fragment key={k}>
                {k > 0 && " "}
                <span className="reveal-word"><span style={{ "--i": i++ } as CSSProperties}>{word}</span></span>
              </Fragment>
            ))}
          </Fragment>
        ))}
      </span>
    </>
  );
}
