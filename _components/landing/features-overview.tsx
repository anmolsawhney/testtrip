/**
 * @description
 * A client component for the landing page that showcases the key features
 * of the TripTrizz application using a dynamic "sticky image" scroll effect.
 * As the user scrolls through feature descriptions on the left, the corresponding
 * image updates and remains fixed on the right.
 * UPDATED: The component is now fully responsive. On mobile devices, the layout
 * stacks vertically, with each feature's image appearing directly below its text.
 * The sticky effect is preserved for desktop screens.
 * UPDATED: Added a "pop-in" animation to the feature images on mobile view for a more dynamic experience, as the sticky effect is not active on smaller screens.
 * UPDATED: The feature icon and title are now aligned horizontally.
 *
 * Key features:
 * - "Scrollytelling" Experience: Engages users by syncing imagery with text content on scroll.
 * - Sticky Image Panel: The image container on the right remains visible while scrolling through features on desktop.
 * - Smooth Transitions: Uses Framer Motion's AnimatePresence for a cross-fade effect between images.
 * - Responsive Fallback: On mobile, the layout gracefully degrades to a simple stacked view of text and images, now with animations.
 *
 * @dependencies
 * - react: For component rendering, state (useState), and refs (useRef).
 * - framer-motion: For scroll-triggered animations and image transitions.
 * - lucide-react: For feature icons.
 *
 * @notes
 * - The `useInView` hook with a negative margin `"-50% 0px -50% 0px"` is used to trigger the image change when a feature's text is in the vertical center of the viewport.
 */
"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, useInView, AnimatePresence } from "framer-motion"
import { Activity, MessageSquare, ShieldCheck, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const featureList = [
  {
    icon: Search,
    title: "Discover & Plan",
    description:
      "Filter by destination, trip type, or vibe. Find the perfect trip and meet Travellers who match your pace, your style, your energy.",
    image: "/landing/feature-discover.png",
    imageAlt:
      "A discovery feed showing swipeable profile cards of other travellers."
  },
  {
    icon: ShieldCheck,
    title: "Verified & Safe Community",
    description:
      "Your safety is our priority. We connect you with a community of ID-verified travellers, creating a trusted environment for everyone, especially for our women-only trips.",
    image: "/landing/feature-women-only.jpeg",
    imageAlt: "A badge showing a user's verified status."
  },
  {
    icon: Activity,
    title: "Find Your Travel Match",
    description:
      "Discover travellers who share your journey style.From mountain treks to cultural getaways connect, match, and explore together with confidence.",
    image: "/landing/feature-match.jpeg",
    imageAlt: "Screenshot of the TripTrizz activity feed on a mobile phone."
  },
  {
    icon: MessageSquare,
    title: "Everything You Need for Safer, Smarter Travel",
    description:
      "From verified profiles and AI-powered matches to women-only options  TripTrizz is designed for secure, community-led adventures.",
    image: "/landing/feature-verified-profile.jpeg",
    imageAlt: "A vibrant chat interface for direct messaging between two users."
  }
]

// Sub-component for individual feature text blocks
const FeatureText = ({
  feature,
  setActiveImage
}: {
  feature: (typeof featureList)[0]
  setActiveImage: (image: string) => void
}) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { margin: "-50% 0px -50% 0px" })

  useEffect(() => {
    if (isInView) {
      setActiveImage(feature.image)
    }
  }, [isInView, feature.image, setActiveImage])

  // Animation variants for the mobile image
  const mobileImageVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  }

  return (
    <div ref={ref} className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="bg-lavender-100 inline-flex items-center justify-center rounded-lg p-3">
          <feature.icon className="text-primary size-7" />
        </div>
        <h3 className="text-3xl font-bold text-gray-800">{feature.title}</h3>
      </div>
      <p className="text-lg leading-relaxed text-gray-600">
        {feature.description}
      </p>
      {/* Image for mobile view, now with animation */}
      <motion.div
        className="lg:hidden"
        variants={mobileImageVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <img
          src={feature.image}
          alt={feature.imageAlt}
          className="feature-image mt-8 w-full rounded-2xl object-cover"
        />
      </motion.div>
    </div>
  )
}

export default function Features() {
  const [activeImage, setActiveImage] = useState(featureList[0].image)

  return (
    <section className="bg-white py-20 lg:py-32">
      <div className="landing-container">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-4xl font-bold text-gray-900 lg:text-5xl">
            Everything You Need for Your Next Adventure
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            From finding inspiration to planning every detail, TripTrizz is your
            all-in-one travel social platform.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2">
          {/* Left Column: Text Content */}
          <div className="space-y-32">
            {featureList.map(feature => (
              <FeatureText
                key={feature.title}
                feature={feature}
                setActiveImage={setActiveImage}
              />
            ))}
          </div>

          {/* Right Column: Sticky Image */}
          <div className="top-24 hidden h-[45vh] w-full overflow-hidden rounded-2xl lg:sticky lg:block">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImage}
                src={activeImage}
                alt="Feature screenshot"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  transition: { duration: 0.5, ease: "easeOut" }
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  transition: { duration: 0.3, ease: "easeIn" }
                }}
                className="feature-image size-full object-cover"
              />
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
