/**
 * @description
 * The new hero section for the unauthenticated landing page.
 * It features a two-column layout with an engaging title, description,
 * call-to-action, and an animated image panel.
 * UPDATED: The layout now uses flexbox ordering to place the image above the text on mobile devices, while maintaining the side-by-side grid on desktops.
 *
 * Key features:
 * - Animated Content: Uses Framer Motion for entrance and continuous animations.
 * - Responsive Two-Column Layout: Stacks with image-first on mobile and side-by-side on desktop.
 * - Gradient Text: Custom "gradient-text" class for visually appealing headlines.
 * - Key Value Propositions: Highlights "ID Verified Users", "AI-Powered Matching", and "Women-Only Trips".
 *
 * @dependencies
 * - react: For component rendering.
 * - framer-motion: For animations.
 * - next/link: For the "Start Your Journey" button link.
 *
 * @notes
 * - The "Start Your Journey" button links directly to the signup page.
 */
"use client"

import React from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Shield, Users, Heart } from "lucide-react"

export default function HeroSection() {
  return (
    <section className="relative pb-12 pt-24">
      <div className="landing-container">
        <div className="flex flex-col items-center gap-12 lg:grid lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="order-2 text-center lg:order-none lg:text-left"
          >
            <h1 className="hero-title text-5xl font-bold leading-tight text-gray-900 lg:text-6xl">
              Connect with <br />
              <span className="gradient-text">Travellers</span> who match your
              vibe
            </h1>
            <p className="mt-4 text-xl leading-relaxed text-gray-600">
              Create & Browse trips, Find your perfect travel buddies via
              TripTrizz AI powered matches and feel free to connect with other
              verified travellers.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-primary px-8 py-4 text-lg"
                >
                  Discover Now
                </motion.button>
              </Link>
            </div>
            <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row lg:justify-start">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex items-center space-x-2"
              >
                <Shield className="text-primary size-5" />
                <span className="font-medium text-gray-700">
                  ID Verified Users
                </span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex items-center space-x-2"
              >
                <Users className="text-primary size-5" />
                <span className="font-medium text-gray-700">
                  AI-Powered Matching
                </span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex items-center space-x-2"
              >
                <Heart className="text-primary size-5" />
                <span className="font-medium text-gray-700">
                  Women-Only Trips
                </span>
              </motion.div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative order-1 block lg:order-none"
          >
            <motion.img
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              src="/landing/hero-image-1.png"
              alt="Young travellers group exploring India"
              className="w-full rounded-2xl shadow-2xl"
              width={800}
              height={600}
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
