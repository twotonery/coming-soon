import { About } from "@/components/landing/About";
import { Faq } from "@/components/landing/Faq";
import { Founder } from "@/components/landing/Founder";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { Highlight } from "@/components/landing/Highlight";
import { Navbar } from "@/components/landing/Navbar";
import { Pricing } from "@/components/landing/Pricing";
import { Services } from "@/components/landing/Services";
import { Testimonials } from "@/components/landing/Testimonials";
import { Reveals } from "@/components/Reveals";
import { SHOWN } from "@/content";

// Each section between the hero and the footer can be switched off from the
// content editor (src/content).
export default function Home() {
  return (
    <>
      <Hero />
      <Navbar />
      <main className="mt-[calc(var(--hero-h)/2-var(--nav-h)/2)]">
        {SHOWN("about") && <About />}
        {SHOWN("founder") && <Founder />}
        {SHOWN("work") && <Highlight />}
        {/* Services closes into Pricing's dark ground, so it only hands over when Pricing follows it */}
        {SHOWN("services") && <Services handover={SHOWN("pricing")} />}
        {SHOWN("pricing") && <Pricing />}
        {SHOWN("testimonials") && <Testimonials />}
        {SHOWN("faq") && <Faq />}
      </main>
      <Footer />
      <Reveals />
    </>
  );
}
