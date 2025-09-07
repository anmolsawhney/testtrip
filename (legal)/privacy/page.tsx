/**
 * @description
 * Server component page for displaying the Privacy Policy.
 * The content has been updated with the official legal text.
 * It is intended to be wrapped by the shared legal layout for consistent styling.
 *
 * @dependencies
 * - react: For component rendering.
 *
 * @notes
 * - The `prose` class provides clean, readable typography for the legal text.
 * - Placeholders like [Insert Date] should be replaced with actual information.
 */
"use server"

import React from "react"

export default async function PrivacyPage() {
  return (
    <div className="bg-card text-card-foreground rounded-lg border p-6 shadow-sm md:p-10">
      <div className="prose prose-sm dark:prose-invert md:prose-base max-w-none">
        <h1>Privacy Policy</h1>
        <p>
          <strong>Last Updated:</strong> 2025-07-17
        </p>

        <h2>1. Introduction</h2>
        <p>
          TripTrizz ("we," "our," or "us") respects your privacy and is
          committed to protecting your personal data in accordance with the
          applicable laws in India. This Privacy Policy explains how we collect,
          use, store, share, and protect your information when you use our
          social media services.
        </p>

        <h2>2. Definitions</h2>
        <ul>
          <li>
            <strong>Data Principal:</strong> You, the individual whose personal
            data is collected.
          </li>
          <li>
            <strong>Data Fiduciary:</strong> TripTrizz, the entity responsible
            for processing your data.
          </li>
          <li>
            <strong>Personal Data:</strong> Any data about an individual who is
            identifiable by or in relation to such data.
          </li>
          <li>
            <strong>Processing:</strong> Any operation performed on personal
            data, such as collection, storage, use, or sharing.
          </li>
        </ul>

        <h2>3. What Personal Data We Collect</h2>
        <p>We may collect the following categories of personal data:</p>
        <h3>a. Identity & Contact Information</h3>
        <ul>
          <li>
            Full name, email address, phone number, date of birth, gender, among
            any other information identifiable as personal information.
          </li>
        </ul>
        <h3>b. User-Generated Content</h3>
        <ul>
          <li>
            Profile photos, posts, comments, messages, shared media, including
            any other content generated or shared while using our TripTrizz
            platform.
          </li>
        </ul>
        <h3>c. Technical & Device Data</h3>
        <ul>
          <li>
            IP address, device ID, browser type, operating system, location data
            (with your consent).
          </li>
        </ul>
        <h3>d. Cookies and Tracking Data</h3>
        <ul>
          <li>Session identifiers, preferences, usage statistics.</li>
          <li>See Cookies Policy below for more information.</li>
        </ul>

        <h2>4. Purpose of Processing</h2>
        <p>Your data is processed for the following purposes:</p>
        <ul>
          <li>To register and manage your account.</li>
          <li>To enable interaction with other users.</li>
          <li>To improve user experience and TripTrizz platform features.</li>
          <li>To enforce community standards and prevent abuse.</li>
          <li>To comply with legal obligations under Indian laws.</li>
        </ul>
        <p>
          We will only process your data for purposes that are lawful, specific,
          and limited to necessity as required under the Indian laws.
        </p>

        <h2>5. Legal Basis for Processing</h2>
        <p>
          We process your data based on one or more of the following legal
          bases:
        </p>
        <ul>
          <li>Your consent.</li>
          <li>To comply with a legal obligation.</li>
          <li>
            For legitimate business interests (e.g., security, fraud
            prevention).
          </li>
        </ul>

        <h2 id="cookies-policy">6. Cookies Policy</h2>
        <p>We use cookies and similar technologies to:</p>
        <ul>
          <li>Remember your login session.</li>
          <li>Understand user behaviour to improve our services.</li>
          <li>Personalize content and features.</li>
        </ul>
        <p>
          You can manage cookie preferences in your browser settings. Disabling
          essential cookies may affect the functionality of the website.
        </p>

        <h2>7. Data Retention Policy</h2>
        <p>We retain your personal data only as long as:</p>
        <ul>
          <li>You maintain an active account.</li>
          <li>Necessary to provide services or resolve disputes.</li>
          <li>Required to comply with legal obligations.</li>
        </ul>

        <h2>9. Data Security</h2>
        <p>We implement industry-standard security protocols, including:</p>
        <ul>
          <li>Encryption of sensitive data.</li>
          <li>Firewalls and access controls.</li>
          <li>Regular audits and monitoring.</li>
        </ul>
        <p>
          Despite best efforts, no system is 100% secure. We are not liable for
          breaches beyond our reasonable control.
        </p>

        <h2>10. Children’s Privacy</h2>
        <p>
          Our services are not intended for children under 16. If you are
          between 16 and 18, you must use the platform under parental or
          guardian supervision.
        </p>
        <p>
          We do not knowingly collect personal data from minors without lawful
          consent.
        </p>

        <h2>11. Data Sharing and Transfers</h2>
        <p>We may share your data:</p>
        <ul>
          <li>
            With third-party processors (e.g., hosting, analytics, content
            delivery).
          </li>
          <li>
            With law enforcement or regulators, if legally mandated or required.
          </li>
          <li>
            With business partners under strict data processing agreements.
          </li>
          <li>In case of merger, acquisition, or restructuring.</li>
        </ul>
        <p>We do not intend to sell your data.</p>

        <h2>12. Cross-Border Data Transfers</h2>
        <p>
          If we transfer your data outside India (e.g., for cloud storage), we
          ensure:
        </p>
        <ul>
          <li>
            Adequate protection as per rules and guidelines under the Indian
            laws.
          </li>
          <li>Binding agreements with processors.</li>
          <li>Your rights are preserved.</li>
          <li>
            Compliance with the necessary and required legal obligations, as per
            the rules and regulations of that country.
          </li>
        </ul>

        <h2>13. Grievance Redressal Mechanism</h2>
        <p>
          If you have any concerns or complaints regarding our data handling
          practices, please contact:
        </p>
        <p>
          Email: support@triptrizz.com
          <br />
        </p>
        <p>We will respond within 7-10 business days.</p>

        <h2>14. Updates to This Policy</h2>
        <p>
          We may modify this policy from time to time. Significant changes will
          be notified via email or platform notification. Continued use after
          updates implies acceptance.
        </p>
      </div>
    </div>
  )
}
