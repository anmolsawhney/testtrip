/**
 * @description
 * A client component for the landing page that highlights additional key features
 * of the TripTrizz application in a clean, three-column card layout.
 * UPDATED: Removed the explicit `bg-white` class to allow the section to inherit the new warm background from the parent stylesheet.
 *
 * Key features:
 * - Three-Column Grid: Presents features in a balanced and easy-to-scan grid.
 * - Animated Cards: Uses Framer Motion for a subtle "fade-in" effect on scroll.
 * - Custom Icons: Utilizes Lucide icons to visually represent each feature.
 * - Hover Effects: Cards subtly scale up on hover to provide interaction feedback.
 *
 * @dependencies
 * - react: For component rendering.
 * - framer-motion: For scroll-triggered animations.
 * - lucide-react: For icons (Wand2, MessageSquareText, Lock).
 * - @/components/ui/card: For styling the feature cards.
 *
 * @notes
 * - The content is hardcoded but can be easily extended or updated.
 */
"use client"

import React from "react"
import { motion } from "framer-motion"
import { Wand2, MessageSquareText, Lock, Gem } from "lucide-react"

const moreFeaturesList = [
  {
    icon: Wand2,
    title: "AI Itinerary Generator",
    description: "Create a custom plan in seconds."
  },
  {
    icon: Gem,
    title: "Hidden Gems & Hotspots",
    description:
      "Explore curated local finds  cafés, viewpoints, and cultural gems handpicked for you."
  },
  {
    icon: Lock,
    title: "Forum",
    description:
      "Join real conversations with verified women Travellers. Ask, share, plan  all in a safe space."
  }
]

export default function MoreFeatures() {
  const sectionVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: "easeOut", staggerChildren: 0.2 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
  }

  return (
    <section className="py-16 lg:py-24">
      <div className="landing-container">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.h2
            variants={itemVariants}
            className="text-4xl font-bold text-gray-900 lg:text-5xl"
          >
            Upcoming features
          </motion.h2>

          <motion.div
            variants={sectionVariants}
            className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3"
          >
            {moreFeaturesList.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="feature-card rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm"
              >
                <div className="bg-lavender-100 mx-auto mb-6 inline-block rounded-full p-4">
                  <feature.icon className="text-primary size-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  {feature.title}
                </h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
