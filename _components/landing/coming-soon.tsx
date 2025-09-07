/**
 * @description
 * A client component for the landing page that announces the upcoming mobile apps
 * and includes an email signup form to notify users upon launch.
 * UPDATED: The success toast message has been changed to "Thank you! We will reach out to you soon."
 *
 * Key features:
 * - Two-column layout with a clear call-to-action and visuals.
 * - An email input form with a "Notify Me" button.
 * - Placeholder form submission logic that logs to console and shows a toast.
 * - Animated phone mockups using Framer Motion for a dynamic effect.
 *
 * @dependencies
 * - react: For component state management.
 * - framer-motion: For animations.
 * - @/lib/hooks/use-toast: For displaying a success message on form submission.
 *
 * @notes
 * - The form does not yet connect to a backend service; it only simulates submission.
 * - Requires placeholder images for the phone mockups in `/public/landing/`.
 */
"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { useToast } from "@/lib/hooks/use-toast"

export default function ComingSoon() {
  const [email, setEmail] = useState("")
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (email) {
      console.log("Email submitted for notification:", email)
      toast({
        title: "Thank you!",
        description: "We will reach out to you soon."
      })
      setEmail("")
    }
  }

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
    <section className="overflow-hidden py-20 lg:py-32">
      <div className="landing-container">
        <motion.div
          className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="space-y-6">
            <motion.h2
              variants={itemVariants}
              className="text-4xl font-bold text-gray-900 lg:text-5xl"
            >
              On the Go? <br />
              Our Apps Are Almost Here
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="text-lg leading-relaxed text-gray-600"
            >
              Take TripTrizz with you wherever you go. Download on launch day or
              get notified in advance.
            </motion.p>
            <motion.form
              variants={itemVariants}
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="focus:border-primary focus:ring-primary w-full rounded-md border border-gray-300 px-4 py-3 text-lg"
                required
              />
              <button
                type="submit"
                className="btn-primary shrink-0 px-6 py-3 text-lg"
              >
                Notify Me
              </button>
            </motion.form>
          </div>
          <div className="relative h-96">
            <motion.img
              initial={{ y: 20, x: -20, rotate: -5 }}
              animate={{ y: [20, 0, 20], x: [-20, -10, -20] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
              src="/landing/phone-mockup-1.png"
              alt="TripTrizz mobile app screenshot 1"
              className="absolute left-0 top-0 w-64 rounded-3xl shadow-2xl"
            />
            <motion.img
              initial={{ y: -20, x: 20, rotate: 5 }}
              animate={{ y: [-20, 0, -20], x: [20, 10, 20] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              src="/landing/phone-mockup-2.png"
              alt="TripTrizz mobile app screenshot 2"
              className="absolute bottom-0 right-0 w-64 rounded-3xl shadow-2xl"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
