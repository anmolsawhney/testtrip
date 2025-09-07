/**
 * @description
 * Server component page for displaying the Community Guidelines.
 * The content has been updated with the official text from the provided documents.
 * It is wrapped in the shared legal layout for consistent styling.
 *
 * @dependencies
 * - react: For component rendering.
 *
 * @notes
 * - The `prose` class provides clean, readable typography for the legal text.
 * - The [Insert Email] placeholder should be replaced with a valid support email address.
 */
"use server"

import React from "react"

export default async function CommunityGuidelinesPage() {
  return (
    <div className="bg-card text-card-foreground rounded-lg border p-6 shadow-sm md:p-10">
      <div className="prose prose-sm dark:prose-invert md:prose-base max-w-none">
        <h1>TripTrizz Community Guidelines</h1>
        <p>
          Welcome to TripTrizz – a place where you can discover your tribe of
          travellers to connect, share stories, and create unforgettable
          journeys together. Swipe right on cities, not just people—meet new
          friends and say yes to spontaneous adventures.
        </p>
        <p>
          To maintain a respectful, safe, and engaging environment, we ask all
          users to follow these Community Guidelines.
        </p>
        <p>By using our platform, you agree to abide by the following rules:</p>

        <h2>Respect Others</h2>
        <ul>
          <li>
            No hate speech, bullying, harassment, or discrimination based on
            race, gender, religion, nationality, disability, sexual orientation,
            or personal beliefs.
          </li>
          <li>Do not post threats or encourage violence.</li>
        </ul>

        <h2>Share Authentic Content</h2>
        <ul>
          <li>
            Share tips, guides, reviews, photos, and questions related to
            travel.
          </li>
          <li>
            Avoid posting unrelated content, misleading information, false
            travel reviews, or staged content presented as authentic.
          </li>
          <li>
            Respect intellectual property—post only content you own or have
            permission to share.
          </li>
        </ul>

        <h2>Protect Privacy</h2>
        <ul>
          <li>
            Do not share private or sensitive information (yours or others) such
            as personal contact details, passport numbers, or booking
            references.
          </li>
          <li>
            Avoid posting photos or videos of others without their consent.
          </li>
        </ul>

        <h2>No Spam or Self-Promotion</h2>
        <ul>
          <li>
            Do not flood the platform with repetitive content, links, or
            comments.
          </li>
          <li>
            Business promotions, affiliate links, or advertisements must require
            prior approval.
          </li>
        </ul>

        <h2>Keep It Safe and Legal</h2>
        <ul>
          <li>
            Do not post about or promote illegal activities, including drug use,
            wildlife trafficking, or visa fraud.
          </li>
          <li>Report unsafe travel practices or misinformation.</li>
        </ul>

        <h2>Use Respectful Language</h2>
        <ul>
          <li>No profane, obscene, or sexually explicit language.</li>
          <li>
            Use culturally sensitive and inclusive language when referring to
            destinations or communities.
          </li>
        </ul>

        <h2>Protect the Environment and Local Cultures</h2>
        <ul>
          <li>
            Do not promote harmful practices like littering, damaging nature, or
            disrespecting cultural sites.
          </li>
          <li>Celebrate diversity and local traditions respectfully.</li>
        </ul>

        <h2>Enforcement & Reporting</h2>
        <p>
          We review reported content and take action against violations,
          including warnings, content removal, suspension, or permanent bans.
        </p>
        <ul>
          <li>
            You can report any content that violates our community guidelines.
          </li>
          <li>
            You have the right to appeal against any decision taken against you
            within a period of 10 days from the date of the decision.
          </li>
        </ul>

        <h2>Questions or Feedback?</h2>
        <p>Please contact our Support Team at support@triptrizz.com.</p>
        <p>
          Together, let's create a community where travelers connect,
          collaborate, and embark on adventures together.
        </p>
        <p>Thank you for being part of TripTrizz!</p>
      </div>
    </div>
  )
}
