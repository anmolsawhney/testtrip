/**
 * @description
 * A client component for the landing page that showcases a tutorial or guide video.
 * It uses the `HeroVideoDialog` component to display a video in a modal when a user clicks the thumbnail.
 *
 * Key features:
 * - Displays a prominent video thumbnail to attract user attention.
 * - Opens the video in a modal dialog for an immersive viewing experience.
 * - Uses Framer Motion for a subtle "scale-in" animation.
 *
 * @dependencies
 * - react: For component rendering.
 * - framer-motion: For scroll-triggered animations.
 * - @/components/magicui/hero-video-dialog: The reusable video dialog component.
 *
 * @notes
 * - The video source is a placeholder and should be updated to a real tutorial video URL.
 * - This component expects a thumbnail image at `/public/landing/video-thumbnail.jpg`. This asset needs to be provided by the user.
 */
"use client"

import { motion } from "framer-motion"
import HeroVideoDialog from "@/components/magicui/hero-video-dialog"

export function TutorialsSection() {
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            See TripTrizz in Action
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-3xl text-lg">
            Watch our quick guide to see how easy it is to start planning your
            next trip and connecting with travellers.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <HeroVideoDialog
            videoSrc="https://www.youtube.com/embed/yXf4wKj7aTA"
            thumbnailSrc="/landing/video-thumbnail.png"
            thumbnailAlt="TripTrizz App Tutorial Video"
          />
        </motion.div>
      </div>
    </section>
  )
}
