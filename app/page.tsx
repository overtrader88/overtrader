import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Differentials } from "@/components/landing/differentials";
import { Pricing } from "@/components/landing/pricing";
import { WaitlistSection } from "@/components/landing/waitlist-section";
import { LandingFooter } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <Features />
        <Differentials />
        <Pricing />
        <WaitlistSection />
      </main>
      <LandingFooter />
    </>
  );
}
