/**
 * @description
 * This component is deprecated and should be deleted. It was previously used
 * to initialize the Lenis smooth scrolling library, but that library caused
 * conflicts with the main application's scroll listeners. Native CSS smooth
 * scrolling is now used on the landing page instead.
 *
 * This file's content has been cleared to resolve the build error, and the file can now be safely removed from the project.
 */
"use client"

import React from "react"

interface LandingLayoutProps {
  children: React.ReactNode
}

// The component now does nothing but render its children.
// Please follow the instructions to delete this file.
export default function LandingLayout({ children }: LandingLayoutProps) {
  return <>{children}</>
}
