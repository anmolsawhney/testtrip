/**
 * @description
 * Server component page for displaying the Terms and Conditions.
 * The content has been updated with the official legal text from the provided documents.
 * It is wrapped in the shared legal layout for consistent styling and includes functional
 * links to other legal pages.
 *
 * @dependencies
 * - react: For component rendering.
 * - next/link: For linking between legal pages.
 *
 * @notes
 * - The `prose` class provides clean, readable typography for the legal text.
 * - Placeholders like [Insert Date] should be replaced with actual information.
 */
"use server"

import React from "react"
import Link from "next/link"

export default async function TermsPage() {
  return (
    <div className="bg-card text-card-foreground rounded-lg border p-6 shadow-sm md:p-10">
      <div className="prose prose-sm dark:prose-invert md:prose-base max-w-none">
        <h1>Terms and Conditions</h1>
        <p>
          <strong>Last Updated:</strong> 2025-07-17
        </p>
        <p>
          These Terms and Conditions ("Terms") govern your access to and use of
          the TripTrizz social media platform ("we," "us," or "our"). By
          creating an account or accessing the platform, you agree to be bound
          by these Terms and our <Link href="/privacy">Privacy Policy</Link> &{" "}
          <Link href="/community-guidelines">Community Guidelines</Link>, which
          complies with the applicable Indian laws.
        </p>

        <h2>1. Definitions</h2>
        <ul>
          <li>
            <strong>Platform:</strong> The website and mobile application
            services provided by us.
          </li>
          <li>
            <strong>Personal Data:</strong> Any data about you that can identify
            you.
          </li>
          <li>
            <strong>Data Fiduciary:</strong> TripTrizz, which determines the
            purpose and means of processing personal data.
          </li>
          <li>
            <strong>Data Principal:</strong> You, the owner of your personal
            data.
          </li>
          <li>
            <strong>User or you:</strong> Any individual who uses the platform.
          </li>
        </ul>

        <h2>2. Eligibility</h2>
        <ul>
          <li>You must be 16 years or older to use the platform.</li>
          <li>
            If you are under 18, you must have parental or legal guardian
            consent.
          </li>
          <li>
            You must provide accurate, complete, and up-to-date information
            during registration.
          </li>
        </ul>

        <h2>3. Account Registration & Security</h2>
        <ul>
          <li>You are responsible for safeguarding your login credentials.</li>
          <li>
            You must notify us immediately if you suspect unauthorized access.
          </li>
          <li>
            We may suspend or terminate accounts that pose a risk to platform
            security or violate our policies.
          </li>
        </ul>

        <h2>4. User Obligations</h2>
        <p>By using the platform, you agree:</p>
        <ul>
          <li>
            Not to post content that is illegal, abusive, defamatory, obscene,
            or promotes harm.
          </li>
          <li>Not to impersonate others or create misleading accounts.</li>
          <li>Not to violate the intellectual property rights of others.</li>
          <li>To comply with the applicable laws.</li>
        </ul>

        <h2>5. Content Ownership & Usage</h2>
        <ul>
          <li>
            You retain full ownership of the content you create and share.
          </li>
          <li>
            By posting content, you grant us a non-exclusive, worldwide,
            royalty-free license to host, display, and distribute your content
            as part of our service.
          </li>
        </ul>
        <p>
          We reserve the right to remove or moderate any content that violates
          these Terms or our community guidelines.
        </p>

        <h2>6. Data Protection & Privacy</h2>
        <p>
          Your personal data is collected, processed, and stored in accordance
          with the applicable rules and regulations under Indian laws. Refer to
          our <Link href="/privacy">Privacy Policy</Link> for complete details.
        </p>

        <h2>7. Cookies and Tracking</h2>
        <p>
          You may control or disable cookies via your browser settings. See our{" "}
          <Link href="/privacy#cookies-policy">Cookies Policy</Link> for more.
        </p>

        <h2>8. Retention of Data</h2>
        <p>We retain personal data:</p>
        <ul>
          <li>For as long as your account is active.</li>
          <li>
            As required for legitimate purposes (e.g., support, analytics,
            legal).
          </li>
          <li>
            As per applicable retention periods defined in our{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </li>
        </ul>

        <h2>9. Platform Availability & Changes</h2>
        <p>
          We may modify, suspend, or discontinue services (including any
          features) at any time without notice. We are not liable for any losses
          caused by service interruptions.
        </p>

        <h2>10. Intellectual Property</h2>
        <p>
          All platform-related software, design, logos, and content (excluding
          user-generated content) are the exclusive property of TripTrizz. You
          may not copy, modify, distribute, or exploit platform materials
          without our express permission.
        </p>

        <h2>11. Termination of Access</h2>
        <p>We may suspend or terminate your account if:</p>
        <ul>
          <li>You breach these Terms or any applicable laws.</li>
          <li>
            You violate our{" "}
            <Link href="/community-guidelines">community guidelines</Link>.
          </li>
          <li>
            You post spam, phishing, harmful, illegal, misleading, or incendiary
            content.
          </li>
        </ul>
        <p>
          You may also delete your account at any time through the platform
          settings.
        </p>

        <h2>12. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless TripTrizz, its employees, and
          affiliates from any claims, liabilities, or damages arising out of:
        </p>
        <ul>
          <li>Your use of the platform.</li>
          <li>Your violation of these Terms or applicable laws.</li>
          <li>Any content you upload or share.</li>
        </ul>

        <h2>13. Limitation of Liability</h2>
        <p>We are not liable for:</p>
        <ul>
          <li>Any indirect, incidental, or consequential damages.</li>
          <li>Loss of data, reputation, or profit.</li>
          <li>User content or third-party services linked on the platform.</li>
        </ul>
        <p>Use the platform at your own discretion and risk.</p>

        <h2>14. Governing Law & Dispute Resolution</h2>
        <p>
          These Terms are governed by the laws of India. Any dispute or
          difference arising out of or relating to the user and TripTrizz, shall
          be settled by binding Individual Arbitration in accordance with the
          provisions of the Arbitration and Conciliation Act, 1996. The seat of
          Arbitration shall be at Jammu, Jammu and Kashmir, India. You waive to
          you right to participate in class-action lawsuit.
        </p>

        <h2>16. Updates to Terms</h2>
        <p>
          We may modify these Terms periodically. Updated terms will be posted
          on the platform and notified to users. Continued use of the platform
          after updates implies acceptance of the revised Terms.
        </p>
      </div>
    </div>
  )
}
