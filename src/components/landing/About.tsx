import Image from "next/image";
import { DISPLAY, GUTTER, Words, delay } from "./shared";

const PRINCIPLES = [
  { label: "Approach", title: "Strategy meets execution", body: "We connect clear thinking with considered design, making sure ideas are not only compelling but practical." },
  { label: "Perspective", title: "Designed around people", body: "Good design starts with understanding the people who use it and the goals it needs to serve." },
];

export function About() {
  return (
    <section id="about" className={`paper pt-20 pb-16 lg:pt-[120px] lg:pb-24 ${GUTTER}`}>
      <div className="grid gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,868px)] lg:gap-y-16">
        <p data-reveal="up" className="pt-1.5 text-[16px] leading-6 lg:w-[254px]">About</p>
        <p data-reveal="words" style={delay(80)} className={`${DISPLAY} indent-[88px]`}>
          <Words text="Twotonery is a design partner for healthcare, medical technology, and ambitious tech companies." />
        </p>

        <div className="relative grid gap-y-10 border-t border-line pt-16 text-[16px] leading-6 lg:col-span-2 lg:grid-cols-subgrid">
          <p data-reveal="up" className="lg:w-[254px]">Twotonery</p>
          <div className="flex max-w-[537px] flex-col gap-14">
            {PRINCIPLES.map((p, i) => (
              <div key={p.label} data-reveal="up" style={delay(100 + i * 120)} className="flex flex-col gap-2 sm:flex-row sm:gap-[120px]">
                <p className="w-[120px] shrink-0">{p.label}</p>
                <div className="flex flex-col gap-2">
                  <p>{p.title}</p>
                  <p className="text-muted">{p.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* wax seal straddling the rule; the art is olive, a teal hue layer (masked to the seal) recolours it */}
          <div className="absolute -top-[64px] right-0 h-[129px] w-[124px] lg:-top-[128.5px] lg:right-auto lg:left-[145px] lg:h-[269px] lg:w-[258px]">
            <Image src="/figma/seal-green.png" alt="Twotonery wax seal" fill sizes="258px" />
            <div
              aria-hidden
              className="absolute inset-0 bg-[#28796b] mix-blend-hue"
              style={{ maskImage: "url(/figma/seal-green.png)", maskSize: "100% 100%" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
