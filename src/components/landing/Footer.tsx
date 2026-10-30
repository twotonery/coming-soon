import Image from "next/image";
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

// Figma Code-layer 11:2.
export function Footer() {
  return (
    <footer data-nav-tone="dark" className={`relative isolate flex flex-col overflow-hidden bg-teal pb-10 text-white lg:h-[900px] ${GUTTER}`}>
      {/* teal paper ground, with the debossed wordmark laid over its top */}
      <Image src="/figma/footer-bg.png" alt="" fill sizes="100vw" className="-z-10 object-cover" />
      <div aria-hidden className="relative -mx-4 h-[160px] mix-blend-luminosity sm:-mx-11 sm:h-[260px] lg:h-[392px]">
        <Image src="/figma/footer-wordmark.png" alt="" fill sizes="100vw" className="object-cover" />
      </div>

      <div className="flex flex-col gap-14 lg:gap-[72px]">
        <div aria-hidden className="relative h-px w-full">
          <Image src="/figma/footer-line.svg" alt="" fill />
        </div>
        <div className="flex flex-col gap-14 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col items-start gap-6">
            <p data-reveal="words" className="w-[241px] text-[24px] leading-8"><Words text="Thoughtful design for what comes next." /></p>
            {/* reveals sit on wrappers where the element has a hover transition of its own */}
            <div data-reveal="up" style={delay(200)}>
              <a href={BOOKING_HREF} className="block rounded-md bg-white px-2.5 py-1 text-[16px] leading-6 font-semibold text-teal transition-colors hover:bg-white/85">
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
              <p data-reveal="up" className="text-[16px] leading-6 text-white/60">Social</p>
              <ul className="flex flex-col gap-2">
                {SOCIAL.map((s, i) => (
                  <li key={s} data-reveal="up" style={delay(60 + i * 60)} className="flex flex-col gap-2">
                    <a href="#" className="group flex items-center gap-2.5 text-[20px] leading-[26px]">
                      <span className="flex-1">{s}</span>
                      <Image src="/figma/arrow-out.svg" alt="" width={16} height={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                    <div aria-hidden className="relative h-px w-full">
                      <Image src={i === 0 ? "/figma/rule-first.svg" : "/figma/rule.svg"} alt="" fill />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div data-reveal="up" className="mt-16 flex flex-col gap-4 text-[16px] leading-6 whitespace-nowrap text-white/60 lg:mt-auto lg:flex-row lg:items-center lg:justify-between">
        <p>© Twotonery 2026. All right reserved.</p>
        <div className="flex items-center gap-4">
          <a href="#" className="transition-colors hover:text-white">Privacy</a>
          <span aria-hidden>•</span>
          <a href="#" className="transition-colors hover:text-white">Term &amp; conditions</a>
        </div>
        <a href="#top" className="flex items-center gap-2.5 transition-colors hover:text-white">
          Back to top
          <Image src="/figma/arrow-up.svg" alt="" width={16} height={16} />
        </a>
      </div>
    </footer>
  );
}
