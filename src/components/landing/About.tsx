import Image from "next/image";
import { DISPLAY, GUTTER } from "./shared";

const PRINCIPLES = [
  { label: "Approach", title: "Strategy meets execution", body: "We connect clear thinking with considered design, making sure ideas are not only compelling but practical." },
  { label: "Perspective", title: "Designed around people", body: "Good design starts with understanding the people who use it and the goals it needs to serve." },
];

export function About() {
  return (
    <section id="about" className={`paper py-20 lg:py-[120px] ${GUTTER}`}>
      <div className="grid gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,868px)] lg:gap-y-16">
        <p className="pt-1.5 text-[16px] leading-6 lg:w-[254px]">About</p>
        <p className={`${DISPLAY} indent-[88px]`}>
          Twotonery is a small, senior design partner. We work as an extension of your team, turning complex products into clear, human experiences.
        </p>

        <div className="relative grid gap-y-10 border-t border-line pt-16 text-[16px] leading-6 lg:col-span-2 lg:grid-cols-subgrid">
          <p className="lg:w-[254px]">Twotonery</p>
          <div className="flex max-w-[537px] flex-col gap-14">
            {PRINCIPLES.map((p) => (
              <div key={p.label} className="flex flex-col gap-2 sm:flex-row sm:gap-[120px]">
                <p className="w-[120px] shrink-0">{p.label}</p>
                <div className="flex flex-col gap-2">
                  <p>{p.title}</p>
                  <p className="text-muted">{p.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* wax seal straddling the rule */}
          <div className="absolute -top-[61px] right-0 h-[120px] w-[124px] overflow-hidden lg:-top-[98.5px] lg:right-auto lg:left-[174px] lg:h-[194px] lg:w-[200px]">
            <Image
              src="/figma/seal.png"
              alt="Twotonery wax seal"
              width={1024}
              height={1024}
              sizes="230px"
              className="absolute top-[-4.59%] left-[-8.48%] h-[117.43%] w-[114.29%] max-w-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
