/**
 * @description
 * Clerk middleware for handling application-wide authentication and routing logic.
 * This middleware's primary responsibility is to protect non-public routes.
 * UPDATED: The middleware is now configured to explicitly ignore specific routes
 * like API webhooks and special `.well-known` paths to prevent Clerk auth errors.
 *
 * Key features:
 * - Route Protection: Redirects unauthenticated users from protected routes.
 * - Ignored Routes: Skips middleware logic for specified paths.
 *
 * @dependencies
 * - next/server: For `NextResponse` and `NextRequest` types.
 * - @clerk/nextjs/server: For `clerkMiddleware`.
 *
 * @notes
 * - This middleware now runs on the default Edge runtime as it no longer needs Node.js APIs.
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that do not require authentication.
const isPublicRoute = createRouteMatcher(["/", "/login(.*)", "/signup(.*)"]);

// Define routes to be completely ignored by the Clerk middleware.
const ignoredRoutes = [
  "/api/webhook/clerk",
  "/.well-known/appspecific/com.chrome.devtools.json",
  "/landing/hello-banner.jpeg",
  "/landing/video-thumbnail.png",
];

export default clerkMiddleware((auth, req) => {
  // If the route is not public and not ignored, protect it.
  if (!isPublicRoute(req)) {
    auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!.*\\..*|_next).*)",
    // Re-include root and all API routes
    "/",
    "/(api|trpc)(.*)",
  ],
  // Add the ignoredRoutes to the middleware config
  ignoredRoutes,
};