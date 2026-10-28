import Image from "next/image";

// Placeholder until there is a booking link.
export const BOOKING_HREF = "mailto:hello@twotonery.com";

// Section statement / title type (Epilogue 48/56, -4% tracking); centred titles run 48/54.
export const DISPLAY = "font-display text-[34px] leading-[40px] tracking-[-0.04em] sm:text-[48px] sm:leading-[56px]";
export const DISPLAY_CENTRED = "font-display text-[34px] leading-[40px] tracking-[-0.04em] sm:text-[48px] sm:leading-[54px]";

// Side gutter used by every section.
export const GUTTER = "px-4 sm:px-11";

// Thin white rules from the Figma file (stroke white @ 20%).
export function HLine({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`absolute inset-x-0 h-px -translate-y-1/2 ${className}`}>
      <Image src="/figma/line-h.svg" alt="" fill />
    </div>
  );
}

// line-v.svg is a 942px horizontal stroke, turned upright around its centre.
export function VLine({ left }: { left: string }) {
  return (
    <div aria-hidden className="absolute top-1/2 h-px w-[942px] -translate-1/2 rotate-90" style={{ left }}>
      <Image src="/figma/line-v.svg" alt="" fill />
    </div>
  );
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
