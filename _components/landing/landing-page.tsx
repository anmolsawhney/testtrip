/**
 * @description
 * The main container component for the new unauthenticated landing page.
 * It orchestrates the various sections of the redesigned landing page, including
 * the Hero, Features, How It Works, More Features, Coming Soon, and Footer sections.
 *
 * Key features:
 * - Assembles all new landing page sections in the correct order.
 * - Imports the dedicated `landing.css` to apply the new, scoped styles.
 * - Provides the main layout structure for the page.
 *
 * @dependencies
 * - react: For component rendering.
 * - ./hero: The new hero section component.
 * - ./features: The new features showcase component.
 * - ./how-it-works: The new "how it works" section.
 * - ./more-features: The new "more features" section.
 * - ./coming-soon: The new mobile app announcement section.
 * - ./footer: The new page footer component.
 * - ./landing.css: The dedicated stylesheet for this page.
 *
 * @notes
 * - This component replaces the old landing page structure entirely.
 */
"use client"

import React from "react"
import HeroSection from "./hero"
import Features from "./features-overview"
import { Footer } from "./footer"
import HowItWorks from "./how-it-works"
import MoreFeatures from "./more-features"
import ComingSoon from "./coming-soon"
import "./landing.css" // Import the new, scoped CSS

export default function LandingPage() {
  return (
    <div className="triptrizz-landing-body flex min-h-screen flex-col bg-white text-gray-900">
      <main className="flex-1">
        <HeroSection />
        <Features />
        <HowItWorks />
        <MoreFeatures />
        <ComingSoon />
      </main>
      <Footer />
    </div>
  )
}
