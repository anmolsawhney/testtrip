/**
 * @description
 * A client component for the landing page that displays recent announcements or news.
 * Designed to be easily updatable with the latest information to keep users informed.
 *
 * Key features:
 * - Showcases a featured announcement in a styled Card component.
 * - Includes a link to a blog post or full announcement page.
 * - Uses Framer Motion for a subtle "slide-in" animation.
 *
 * @dependencies
 * - react: For component rendering.
 * - framer-motion: For animations.
 * - next/link: For navigation.
 * - lucide-react: For icons.
 * - @/components/ui/button: For the "Read More" button.
 * - @/components/ui/card: For styling the announcement.
 *
 * @notes
 * - Currently displays static content but is structured to be easily connected to a CMS or data source.
 */
"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function Announcements() {
  return (
    <section className="bg-gray-50 py-20 md:py-32 dark:bg-gray-900/50">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold md:text-4xl">
            What's New at TripTrizz?
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-3xl text-lg">
            We're constantly improving your travel planning experience. Check
            out our latest updates!
          </p>
          <Card className="mx-auto mt-8 max-w-2xl text-left shadow-lg">
            <CardHeader>
              <CardTitle>The Social Update is Here!</CardTitle>
              <CardDescription>June 20, 2024</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We're thrilled to launch our biggest update yet! Connect with
                travellers like never before with our new social features.
                Follow your favorite adventurers, get inspired by their trips in
                the new Activity Feed, and slide into their DMs to plan your
                next journey together. Happy travels!
              </p>
              <Button asChild variant="link" className="mt-4 px-0">
                <Link href="/blog/social-update">
                  Read More <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
