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

export default function Home() {
  return (
    <>
      <Hero />
      <Navbar />
      <main className="mt-[calc(var(--hero-h)/2-var(--nav-h)/2)]">
        <About />
        <Founder />
        <Highlight />
        <Services />
        <Pricing />
        <Testimonials />
        <Faq />
      </main>
      <Footer />
      <Reveals />
    </>
  );
}
