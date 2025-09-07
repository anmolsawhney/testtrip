/**
 * @description
 * A client component for the application's landing page footer.
 * Provides essential links such as contact information, terms of service, and privacy policy.
 * Also includes social media links.
 * UPDATED: The "Terms" and "Privacy" links now point to the new `/terms` and `/privacy` pages.
 * UPDATED: The legal links ("Community Guidelines", "Terms", "Privacy") are now bolded for better visibility.
 *
 * Key features:
 * - Displays copyright information with the current year.
 * - Contains navigation links for legal and support pages.
 * - Includes social media icons linking to external profiles.
 *
 * @dependencies
 * - react: For component rendering.
 * - next/link: For client-side navigation.
 * - lucide-react: For social media icons.
 *
 * @notes
 * - The social media links point to generic homepages and should be updated with actual profile URLs.
 */
"use client"

import Link from "next/link"
import { Github, Twitter, Instagram, Youtube, Linkedin } from "lucide-react"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-lavender-50 border-t-lavender-100 border-t">
      <div className="landing-container py-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-center md:text-left">
            <p className="text-sm text-gray-500">
              © {currentYear} TripTrizz, Inc. All rights reserved.
            </p>
          </div>
          <div className="flex space-x-6">
            <Link
              href="/community-guidelines"
              className="hover:text-primary text-sm font-semibold text-gray-500 transition-colors"
            >
              Community Guidelines
            </Link>
            <Link
              href="/terms"
              className="hover:text-primary text-sm font-semibold text-gray-500 transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:text-primary text-sm font-semibold text-gray-500 transition-colors"
            >
              Privacy
            </Link>
          </div>
          <div className="flex space-x-6">
            <a
              href="https://x.com/TripTrizz"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              className="hover:text-primary text-gray-400 transition-colors"
            >
              <Twitter className="size-5" />
            </a>
            <a
              href="https://www.youtube.com/@TripTrizz"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Youtube"
              className="hover:text-primary text-gray-400 transition-colors"
            >
              <Youtube className="size-5" />
            </a>
            <a
              href="https://www.instagram.com/triptrizz"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hover:text-primary text-gray-400 transition-colors"
            >
              <Instagram className="size-5" />
            </a>
            <a
              href="https://www.linkedin.com/company/triptrizz/about/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="hover:text-primary text-gray-400 transition-colors"
            >
              <Linkedin className="size-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
