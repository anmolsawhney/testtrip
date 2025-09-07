"use client"

import { useClerk } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useTheme } from "next-themes"

export default function VerifyPage() {
  const { theme } = useTheme()
  const { client } = useClerk()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="bg-card rounded-lg border p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Verify your email</h1>
        <p className="text-muted-foreground">
          Please check your email for a verification link. After verifying your
          email, you can proceed to sign in.
        </p>
      </div>
    </div>
  )
}
