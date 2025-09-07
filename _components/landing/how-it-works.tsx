/**
 * @description
 * A client component for the landing page that explains the core workflow of the TripTrizz app.
 * It features a large video thumbnail that opens a tutorial in a modal, followed by a
 * clear, 3-step guide on how to get started.
 * UPDATED: Reduced vertical padding to make the landing page more compact.
 * UPDATED: Removed local background color to inherit the new body gradient.
 *
 * Key features:
 * - Displays a prominent video thumbnail to attract user attention.
 * - Opens the video in a modal dialog for an immersive viewing experience.
 * - Presents a simple 3-step process with numbered circles and descriptions.
 * - Uses Framer Motion for scroll-triggered animations.
 *
 * @dependencies
 * - react: For component rendering.
 * - framer-motion: For scroll-triggered animations.
 * - @/components/magicui/hero-video-dialog: The reusable video dialog component.
 *
 * @notes
 * - The video source is a placeholder and should be updated to a real tutorial video URL.
 * - This component expects a thumbnail image at `/public/landing/video-thumbnail.jpg`.
 */
"use client"

import React from "react"
import { motion } from "framer-motion"
import HeroVideoDialog from "@/components/magicui/hero-video-dialog"

const steps = [
  {
    number: "1",
    title: "Create Profile",
    description: "Sign up and verify your ID for a trusted travel experience."
  },
  {
    number: "2",
    title: "Find Matches",
    description: "Browse itineraries and connect with compatible travellers."
  },
  {
    number: "3",
    title: "Start Journey",
    description: "Plan together and embark on unforgettable adventures."
  }
]

export default function HowItWorks() {
  const sectionVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: "easeOut", staggerChildren: 0.2 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
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
            How TripTrizz Works
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="mt-4 text-lg text-gray-600"
          >
            Get started in minutes and discover your perfect travel companion
          </motion.p>

          <motion.div variants={itemVariants} className="mt-12">
            <HeroVideoDialog
              videoSrc="https://www.youtube.com/embed/yXf4wKj7aTA"
              thumbnailSrc="/landing/video-thumbnail.png"
              thumbnailAlt="TripTrizz App Tutorial Video"
            />
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3"
          >
            {steps.map(step => (
              <div key={step.number} className="text-center">
                <div className="bg-primary mx-auto mb-4 flex size-12 items-center justify-center rounded-full text-xl font-bold text-white">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  {step.title}
                </h3>
                <p className="mt-2 text-gray-600">{step.description}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
