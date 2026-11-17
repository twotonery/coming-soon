import { FOUNDER } from "@/content";
import { DISPLAY, GUTTER, Words, delay } from "./shared";
import "./founder.css";

// Who is behind the studio, and who she has worked with (Figma: Twotonery
// Brand 533:10096).
// The portrait is a postage stamp, printed on the page's own paper: the photo
// is laid down as one ink (the brand's teal) so the paper's grain shows through
// it, and a postmark is struck across its corner onto the sheet. To change the
// photo, change it in the content editor (src/content) (4:5, any colour: it is printed in
// teal either way).

const CLIENTS = [
  { name: "Areta", file: "areta" },
  { name: "EVYD", file: "evyd" },
  { name: "Family Clinic", file: "familyclinic" },
  { name: "Overclock", file: "overclock" },
  { name: "Superbiome", file: "superbiome" },
  { name: "Zingage", file: "zingage" },
];

// Rubber-stamp ink, as an SVG filter. The drawing's edges are pushed about a
// little (no stamp prints a clean line), fine specks drop out where the ink
// missed the paper's tooth, the whole print is heavier where the stamp was
// pressed harder, and a soft halo of ink bleeds out into the paper round it.
function Ink({ id, seed }: { id: string; seed: number }) {
  return (
    <filter id={id} x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed={seed} result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.7" xChannelSelector="R" yChannelSelector="G" result="rough" />
      <feMorphology in="rough" operator="dilate" radius="0.45" result="fat" />
      <feGaussianBlur in="fat" stdDeviation="1.1" result="soft" />
      <feComponentTransfer in="soft" result="bleed"><feFuncA type="linear" slope="0.38" /></feComponentTransfer>
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={seed + 7} result="grain" />
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  7 0 0 0 -2.1" result="specks" />
      <feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="2" seed={seed + 19} result="hand" />
      <feColorMatrix in="hand" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 3.2 0 0 -0.75" result="press" />
      <feComposite in="rough" in2="specks" operator="in" result="print" />
      <feMerge result="inked"><feMergeNode in="bleed" /><feMergeNode in="print" /></feMerge>
      <feComposite in="inked" in2="press" operator="in" />
    </filter>
  );
}

// The cancel mark: a ring of type round the studio's mark, and the wavy lines
// a franking machine leaves beside it.
function Postmark() {
  return (
    <svg aria-hidden viewBox="-14 -14 278 160" fill="none" stroke="currentColor" className="founder-postmark">
      <defs>
        <path id="founder-ring" d="M66 66m-44 0a44 44 0 1 1 88 0a44 44 0 1 1 -88 0" />
        <Ink id="founder-ink" seed={4} />
      </defs>
      <g filter="url(#founder-ink)">
      <circle cx="66" cy="66" r="60" strokeWidth="2.2" />
      <circle cx="66" cy="66" r="31" strokeWidth="1.6" />
      <text fill="currentColor" stroke="none" fontSize="11" letterSpacing="2" fontWeight="700">
        <textPath href="#founder-ring" startOffset="0" textLength="270" lengthAdjust="spacing">TWOTONERY • DPS • YIA •</textPath>
      </text>
      {/* the studio's mark, from logo.svg */}
      <g transform="translate(66 66) scale(1.02) translate(-20.9 -15)" fill="currentColor" stroke="none">
        <path d="M19.15 1.25a.24.24 0 0 1 .46-.1l1.19 2.58a2.9 2.9 0 0 0 2.6 1.63l4.32-.07a.23.23 0 0 1 .02.47c-.9.08-1.8.22-2.68.42-.44.1-1 .22-1.41.38-1.06.4-1.7 1.69-1.66 2.81l.11 3.03a.24.24 0 0 1-.47.1l-1.11-2.63c-.46-1.1-1.7-1.97-2.89-1.82l-.26.04-.45.11c-.25.07-.5.13-.76.2-.7.2-1.39.44-2.07.7-.39.15-.77.31-1.16.48a38 38 0 0 0-3.5 1.7c-.35.2-.7.39-1.04.6-.45.27-.88.55-1.32.84-1.15.77-2.27 1.6-3.22 2.61-1 1.04-1.85 2.33-1.94 3.8-.01.25 0 .68.05.93.07.33.25.7.44.98.25.38.57.7.92.99.66.53 1.44.92 2.23 1.22 1.07.41 2.19.67 3.32.86a.23.23 0 0 1-.06.45 20 20 0 0 1-1.5-.19c-.41-.07-.82-.15-1.22-.26-1.78-.44-3.64-1.2-4.63-2.83a4.7 4.7 0 0 1-.4-.84l-.05-.15-.04-.25a6.3 6.3 0 0 1-.01-1.5c.07-.63.25-1.25.51-1.84.35-.77.84-1.47 1.41-2.1.95-1.05 2.1-1.92 3.27-2.72.36-.24.72-.48 1.08-.72l.53-.34c.25-.15.5-.3.76-.44a37 37 0 0 1 4.14-2.01l.63-.25.39-.15 1.1-.47 1.3-.55.77-.32.53-.2a2.76 2.76 0 0 0 1.77-2.53l-.01-2.7Z" />
        <path d="M22.69 28.76a.24.24 0 0 1-.46.1l-1.19-2.57a2.9 2.9 0 0 0-2.6-1.63l-4.32.06a.23.23 0 0 1-.02-.46c.9-.08 1.8-.22 2.68-.42.44-.1 1-.22 1.41-.38 1.06-.4 1.7-1.69 1.66-2.81l-.11-3.03a.24.24 0 0 1 .47-.1l1.11 2.63c.46 1.1 1.7 1.97 2.89 1.82l.26-.04.45-.11c.25-.07.5-.13.76-.2.7-.2 1.39-.44 2.07-.7.39-.15.77-.31 1.16-.48a38 38 0 0 0 3.5-1.7c.35-.2.7-.39 1.04-.6.45-.27.88-.55 1.32-.84 1.15-.77 2.27-1.6 3.22-2.61 1-1.04 1.85-2.33 1.94-3.8.01-.25 0-.68-.05-.93a3.3 3.3 0 0 0-.44-.98 4.3 4.3 0 0 0-.92-.99 8.4 8.4 0 0 0-2.23-1.22c-1.07-.41-2.19-.67-3.32-.86a.23.23 0 0 1 .06-.45c.5.04 1 .1 1.5.19.41.07.82.15 1.22.26 1.78.44 3.64 1.2 4.63 2.83.16.26.3.55.4.84l.05.15.04.25c.06.5.07 1 .01 1.5a6.2 6.2 0 0 1-.51 1.84 8 8 0 0 1-1.41 2.1c-.95 1.05-2.1 1.92-3.27 2.72-.36.24-.72.48-1.08.72l-.53.34c-.25.15-.5.3-.76.44a37 37 0 0 1-4.14 2.01l-.63.25-.39.15-1.1.47-1.3.55-.77.32-.53.2a2.76 2.76 0 0 0-1.77 2.53l.01 2.7Z" />
      </g>
      {[36, 51, 66, 81, 96].map((y) => (
        <path key={y} strokeWidth="2" strokeLinecap="round" d={`M132 ${y}c10-7 19 7 29 0s19 7 29 0s19 7 29 0s19 7 29 0`} />
      ))}
      </g>
    </svg>
  );
}

// The closing quote mark behind the founder's words: stamped too, in the same
// ink, but pressed lightly (founder.css) so the words over it stay readable.
function QuoteMark() {
  return (
    <svg aria-hidden viewBox="-12 -12 141 137" className="founder-quote">
      <defs><Ink id="founder-ink-quote" seed={31} /></defs>
      <g filter="url(#founder-ink-quote)" fill="currentColor">
        <path d="M14 0h40v48L27 113H0l21-62h-7z" />
        <path d="M77 0h40v48L90 113H63l21-62h-7z" />
      </g>
    </svg>
  );
}

export function Founder() {
  return (
    <section id="founder" className={`paper overflow-clip pt-8 ${GUTTER}`}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-y-14 border-b border-line pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,762px)] lg:pb-12">
        <div className="flex flex-col gap-10 lg:gap-8">
          <div data-reveal="up" className="founder-stamp-wrap">
            {/* the edge wraps the cut paper, so its lit rim follows the perforations */}
            <div className="founder-stamp-edge">
              <figure className="founder-stamp paper">
                <div className="founder-print">
                  {/* eslint-disable-next-line @next/next/no-img-element -- blended into the paper; next/image adds nothing here */}
                  <img src={FOUNDER.portrait} alt={`${FOUNDER.name}, founder of Twotonery`} width={880} height={1100} loading="lazy" />
                </div>
                <figcaption className="founder-caption">
                  <span>Twotonery</span>
                  <span>Founder</span>
                </figcaption>
              </figure>
            </div>
            <Postmark />
          </div>
          <figure data-reveal="up" style={delay(120)} className="relative isolate m-0 flex max-w-[484px] flex-col gap-2 text-[16px] leading-6 lg:ml-[11px]">
            <QuoteMark />
            <blockquote className="m-0 flex flex-col gap-6">
              {FOUNDER.quote.split(/\n\s*\n/).filter((p) => p.trim()).map((p) => <p key={p}>{p.trim()}</p>)}
            </blockquote>
            <figcaption className="text-muted">{FOUNDER.name}</figcaption>
          </figure>
        </div>

        <div className="flex flex-col gap-12 lg:gap-[94px] lg:pt-[100px]">
          {/* the companies, on a slow endless line: each logo an ink print on the paper */}
          <div data-reveal="fade" style={delay(120)} className="founder-marquee" role="list" aria-label="Companies Regina has worked with">
            <div className="founder-track">
              {[0, 1].map((copy) =>
                CLIENTS.map((c) => (
                  <span
                    key={`${copy}-${c.file}`}
                    role={copy ? undefined : "listitem"}
                    aria-label={copy ? undefined : c.name}
                    aria-hidden={copy ? true : undefined}
                    className="founder-logo"
                    style={{ maskImage: `url(/clients/${c.file}.svg)`, WebkitMaskImage: `url(/clients/${c.file}.svg)` }}
                  />
                )),
              )}
            </div>
          </div>
          <p data-reveal="words" style={delay(80)} className={`${DISPLAY} indent-[88px] lg:max-w-[728px]`}>
            <Words text="Trusted across products and teams. Our team has worked with over 20 brands and products." />
          </p>
        </div>
      </div>
    </section>
  );
}
