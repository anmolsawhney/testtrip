/**
 * @description
 * The root server layout for the TripRizz app.
 * This component sets up the overall HTML structure and global providers.
 * UPDATED: This layout now fetches the current user data from Clerk once and passes it
 * down to the TopNavLoader. This is the primary fix for the Clerk rate limit issue, as it
 * prevents re-fetching the user on every page navigation.
 *
 * Key features:
 * - Centralized User Fetching: Calls `currentUser()` once per request.
 * - Provides the root HTML shell for the entire application.
 * - Wraps the app in `<ClerkProvider>` and other essential providers.
 * - Renders the global `TopNavLoader` and Toaster.
 *
 * @dependencies
 * - "@clerk/nextjs/server": For ClerkProvider and `currentUser`.
 * - All other existing UI and utility dependencies.
 */

import { ClerkProvider } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import { Toaster } from "@/components/ui/toaster"
import { PostHogPageview } from "@/components/utilities/posthog/posthog-pageview"
import { PostHogUserIdentify } from "@/components/utilities/posthog/posthog-user-identity"
import { Providers } from "@/components/utilities/providers"
import { cn } from "@/lib/utils"
import "./globals.css"
import { TopNavLoader } from "@/components/ui/top-nav-loader"
import { NotificationProviderWrapper } from "@/components/utilities/notification-provider-wrapper"

// This forces all pages using this layout to be rendered in the Node.js runtime.
// This is essential because database access (e.g., in TopNavLoader) requires Node.js APIs.
export const runtime = "nodejs"

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  // Fetch the user data once here at the highest level of the application.
  const user = await currentUser()

  // Prepare a serializable user object to pass to client-hydrated components.
  const safeUser = user
    ? {
        id: user.id,
        fullName: user.fullName,
        imageUrl: user.imageUrl,
        primaryEmailAddress: user.primaryEmailAddress?.emailAddress
      }
    : null

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link
            rel="stylesheet"
            href="https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css"
          />
          <link
            rel="stylesheet"
            href="https://cdn-uicons.flaticon.com/2.6.0/uicons-bold-rounded/css/uicons-bold-rounded.css"
          />
          <link
            rel="stylesheet"
            href="https://cdn-uicons.flaticon.com/2.6.0/uicons-solid-rounded/css/uicons-solid-rounded.css"
          />
        </head>
        <body
          className={cn(
            "bg-background mx-auto flex min-h-screen w-full flex-col scroll-smooth antialiased"
          )}
        >
          <NotificationProviderWrapper>
            <Providers
              attribute="class"
              defaultTheme="light"
              enableSystem={false}
              disableTransitionOnChange
            >
              <PostHogUserIdentify />
              <PostHogPageview />
              {/* Pass the fetched user object down to the loader component as a prop. */}
              <TopNavLoader user={safeUser} />
              <main className="flex-1">{children}</main>
              <Toaster />
            </Providers>
          </NotificationProviderWrapper>
        </body>
      </html>
    </ClerkProvider>
  )
}
