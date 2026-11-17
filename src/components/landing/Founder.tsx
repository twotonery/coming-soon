import { DISPLAY, GUTTER, Words, delay } from "./shared";
import "./founder.css";

// Who is behind the studio, and who she has worked with.
// The portrait is a postage stamp, printed on the page's own paper: the photo
// is laid down as one ink (the brand's teal) so the paper's grain shows through
// it, and a postmark is struck across its corner onto the sheet. To change the
// photo, replace public/founder/portrait.jpg (4:5, any colour: it is printed in
// teal either way).

const CLIENTS = [
  { name: "Areta", file: "areta" },
  { name: "EVYD", file: "evyd" },
  { name: "Family Clinic", file: "familyclinic" },
  { name: "Overclock", file: "overclock" },
  { name: "Superbiome", file: "superbiome" },
  { name: "Zingage", file: "zingage" },
];

// The cancel mark: a ring of type round the studio's mark, and the wavy lines
// a franking machine leaves beside it.
function Postmark() {
  return (
    <svg aria-hidden viewBox="0 0 250 132" fill="none" stroke="currentColor" className="founder-postmark">
      <defs>
        <path id="founder-ring" d="M66 66m-44 0a44 44 0 1 1 88 0a44 44 0 1 1 -88 0" />
      </defs>
      <circle cx="66" cy="66" r="60" strokeWidth="1.6" />
      <circle cx="66" cy="66" r="31" strokeWidth="1.1" />
      <text fill="currentColor" stroke="none" fontSize="10.5" letterSpacing="2" fontWeight="600">
        <textPath href="#founder-ring" startOffset="0" textLength="272" lengthAdjust="spacing">TWOTONERY STUDIO · DPS • YIA ·</textPath>
      </text>
      {/* the studio's mark, from logo.svg */}
      <g transform="translate(66 66) scale(1.02) translate(-20.9 -15)" fill="currentColor" stroke="none">
        <path d="M19.15 1.25a.24.24 0 0 1 .46-.1l1.19 2.58a2.9 2.9 0 0 0 2.6 1.63l4.32-.07a.23.23 0 0 1 .02.47c-.9.08-1.8.22-2.68.42-.44.1-1 .22-1.41.38-1.06.4-1.7 1.69-1.66 2.81l.11 3.03a.24.24 0 0 1-.47.1l-1.11-2.63c-.46-1.1-1.7-1.97-2.89-1.82l-.26.04-.45.11c-.25.07-.5.13-.76.2-.7.2-1.39.44-2.07.7-.39.15-.77.31-1.16.48a38 38 0 0 0-3.5 1.7c-.35.2-.7.39-1.04.6-.45.27-.88.55-1.32.84-1.15.77-2.27 1.6-3.22 2.61-1 1.04-1.85 2.33-1.94 3.8-.01.25 0 .68.05.93.07.33.25.7.44.98.25.38.57.7.92.99.66.53 1.44.92 2.23 1.22 1.07.41 2.19.67 3.32.86a.23.23 0 0 1-.06.45 20 20 0 0 1-1.5-.19c-.41-.07-.82-.15-1.22-.26-1.78-.44-3.64-1.2-4.63-2.83a4.7 4.7 0 0 1-.4-.84l-.05-.15-.04-.25a6.3 6.3 0 0 1-.01-1.5c.07-.63.25-1.25.51-1.84.35-.77.84-1.47 1.41-2.1.95-1.05 2.1-1.92 3.27-2.72.36-.24.72-.48 1.08-.72l.53-.34c.25-.15.5-.3.76-.44a37 37 0 0 1 4.14-2.01l.63-.25.39-.15 1.1-.47 1.3-.55.77-.32.53-.2a2.76 2.76 0 0 0 1.77-2.53l-.01-2.7Z" />
        <path d="M22.69 28.76a.24.24 0 0 1-.46.1l-1.19-2.57a2.9 2.9 0 0 0-2.6-1.63l-4.32.06a.23.23 0 0 1-.02-.46c.9-.08 1.8-.22 2.68-.42.44-.1 1-.22 1.41-.38 1.06-.4 1.7-1.69 1.66-2.81l-.11-3.03a.24.24 0 0 1 .47-.1l1.11 2.63c.46 1.1 1.7 1.97 2.89 1.82l.26-.04.45-.11c.25-.07.5-.13.76-.2.7-.2 1.39-.44 2.07-.7.39-.15.77-.31 1.16-.48a38 38 0 0 0 3.5-1.7c.35-.2.7-.39 1.04-.6.45-.27.88-.55 1.32-.84 1.15-.77 2.27-1.6 3.22-2.61 1-1.04 1.85-2.33 1.94-3.8.01-.25 0-.68-.05-.93a3.3 3.3 0 0 0-.44-.98 4.3 4.3 0 0 0-.92-.99 8.4 8.4 0 0 0-2.23-1.22c-1.07-.41-2.19-.67-3.32-.86a.23.23 0 0 1 .06-.45c.5.04 1 .1 1.5.19.41.07.82.15 1.22.26 1.78.44 3.64 1.2 4.63 2.83.16.26.3.55.4.84l.05.15.04.25c.06.5.07 1 .01 1.5a6.2 6.2 0 0 1-.51 1.84 8 8 0 0 1-1.41 2.1c-.95 1.05-2.1 1.92-3.27 2.72-.36.24-.72.48-1.08.72l-.53.34c-.25.15-.5.3-.76.44a37 37 0 0 1-4.14 2.01l-.63.25-.39.15-1.1.47-1.3.55-.77.32-.53.2a2.76 2.76 0 0 0-1.77 2.53l.01 2.7Z" />
      </g>
      {[36, 51, 66, 81, 96].map((y) => (
        <path key={y} strokeWidth="1.5" strokeLinecap="round" d={`M132 ${y}c10-7 19 7 29 0s19 7 29 0s19 7 29 0s19 7 29 0`} />
      ))}
    </svg>
  );
}

export function Founder() {
  return (
    <section id="founder" className={`paper overflow-clip pb-20 lg:pb-[120px] ${GUTTER}`}>
      <div className="grid gap-y-14 border-t border-line pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,868px)]">
        <div className="flex flex-col gap-10">
          <p data-reveal="up" className="text-[16px] leading-6 lg:w-[254px]">Founder</p>
          <div data-reveal="up" style={delay(120)} className="founder-stamp-wrap">
            <figure className="founder-stamp paper">
              <div className="founder-print">
                {/* eslint-disable-next-line @next/next/no-img-element -- blended into the paper; next/image's wrapper-free img is fine but adds nothing here */}
                <img src="/founder/portrait.jpg" alt="Regina, founder of Twotonery" width={880} height={1100} loading="lazy" />
              </div>
              <figcaption className="founder-caption">
                <span>Twotonery</span>
                <span>Founder</span>
              </figcaption>
            </figure>
            <Postmark />
          </div>
        </div>

        <div className="flex flex-col gap-12 lg:gap-16">
          <p data-reveal="words" style={delay(80)} className={`${DISPLAY} indent-[88px]`}>
            <Words text="I’ve worked across products and teams." />
          </p>
          {/* the companies, on a slow endless line: each logo an ink print on the paper */}
          <div className="flex flex-col gap-6 border-t border-line pt-6">
            <p data-reveal="up" className="text-[16px] leading-6 text-muted">Regina, founder</p>
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
          </div>
        </div>
      </div>
    </section>
  );
}
