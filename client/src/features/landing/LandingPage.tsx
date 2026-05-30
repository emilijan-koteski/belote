import { ClosingCta } from "@/features/landing/components/ClosingCta";
import { HowItWorks } from "@/features/landing/components/HowItWorks";
import { LandingFeatures } from "@/features/landing/components/LandingFeatures";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { LandingHero } from "@/features/landing/components/LandingHero";

/**
 * Public marketing landing page at `/` — Direction A "The Table".
 *
 * Full-bleed: it brings its own felt nav + footer rather than the app shell,
 * so it's mounted directly under `GuestRoute` (which bounces authed users to
 * `/lobby`). Felt sections (`.felt-surface`) and parchment sections share one
 * token sheet; every colour resolves from a CSS variable.
 */
export function LandingPage() {
  return (
    <div className="bg-background min-h-screen" data-testid="landing-page">
      <LandingHero />
      <HowItWorks />
      <LandingFeatures />
      <ClosingCta />
      <LandingFooter />
    </div>
  );
}
