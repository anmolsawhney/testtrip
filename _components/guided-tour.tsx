/**
 * @description
 * Client component that provides a comprehensive guided tour for new users.
 * It renders as a non-closable modal that overlays the application, walking the user
 * through the main features step-by-step. The tour is only shown once and is
 * controlled by a flag in the user's profile.
 *
 * Key features:
 * - Step-by-step modal interface for feature discovery.
 * - Uses Framer Motion for smooth transitions between steps.
 * - Displays progress to the user.
 * - Calls a server action (`markGuidedTourAsCompletedAction`) upon completion to
 *   update the user's profile so the tour does not show again.
 * - Handles loading and success/error feedback via toasts.
 *
 * @dependencies
 * - react: For state management and hooks.
 * - framer-motion: For animations.
 * - @/components/ui/*: Shadcn UI components (Dialog, Button, Progress).
 * - lucide-react: For icons.
 * - @/actions/db/onboarding-actions: For the server action to mark the tour as complete.
 * - @/lib/hooks/use-toast: For user feedback.
 *
 * @notes
 * - This component is intended to be conditionally rendered by a parent server component
 *   (e.g., the homepage) based on the user's `hasCompletedGuidedTour` profile flag.
 * - The modal cannot be dismissed by clicking outside to ensure the user completes the tour.
 */
"use client"

import React, { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AnimatePresence, motion } from "framer-motion"
import {
  Compass,
  Heart,
  MessageCircle,
  Newspaper,
  PlusCircle,
  User,
  Loader2
} from "lucide-react"
import { markGuidedTourAsCompletedAction } from "@/actions/db/onboarding-actions"
import { useToast } from "@/lib/hooks/use-toast"

// Tour steps definition
const tourSteps = [
  {
    icon: Compass,
    title: "Welcome to TripTrizz!",
    description:
      "Let's take a quick tour of the key features to help you get started on your next adventure."
  },
  {
    icon: Compass,
    title: "Discover Your Next Trip",
    description:
      "The home page is your main discovery feed. Here you can browse all public trips, filter by type, location, budget, and more to find the perfect journey."
  },
  {
    icon: Heart,
    title: "Find Your Travel Match",
    description:
      "Head over to the 'Match' tab to find your Trizzer! Our AI-powered system shows you profiles of like-minded travellers you can connect with."
  },
  {
    icon: Newspaper,
    title: "Stay Updated with the Feed",
    description:
      "The 'Feed' tab is your social hub. See the latest activities from people you follow, like new trips, photos, reviews, and more."
  },
  {
    icon: MessageCircle,
    title: "Chat & Connect",
    description:
      "Once you match with someone or join a group trip, you can start a conversation in the 'Chat' tab. Plan your adventures together!"
  },
  {
    icon: User,
    title: "Your Profile Hub",
    description:
      "Your profile is where you can see your trips, photos, followers, and manage your details. Keep it updated to improve your match recommendations!"
  },
  {
    icon: PlusCircle,
    title: "Create Your Own Trip",
    description:
      "Have an idea for an adventure? Click the '+' button to create your own trip. You can make it public, private, or for followers only."
  }
]

export function GuidedTour() {
  const [isOpen, setIsOpen] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = async () => {
    setIsFinishing(true)
    try {
      const result = await markGuidedTourAsCompletedAction()
      if (result.isSuccess) {
        toast({
          title: "Tour Complete!",
          description: "Enjoy exploring TripTrizz!"
        })
        startTransition(() => {
          setIsOpen(false)
        })
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          "Could not save tour completion status. You may see this tour again.",
        variant: "destructive"
      })
    } finally {
      setIsFinishing(false)
    }
  }

  const step = tourSteps[currentStep]
  const Icon = step.icon
  const isLastStep = currentStep === tourSteps.length - 1

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[480px]"
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon className="size-5 text-purple-500" />
            {step.title}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="py-4"
          >
            <DialogDescription className="text-base text-gray-600">
              {step.description}
            </DialogDescription>
          </motion.div>
        </AnimatePresence>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex w-full items-center gap-4">
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {tourSteps.length}
            </span>
            <Progress
              value={((currentStep + 1) / tourSteps.length) * 100}
              className="flex-1"
            />
          </div>
          <div className="flex w-full justify-end gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isFinishing}
              >
                Previous
              </Button>
            )}
            {isLastStep ? (
              <Button
                onClick={handleFinish}
                disabled={isFinishing || isPending}
                className="bg-gradient-1 text-white"
              >
                {isFinishing || isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Finish
              </Button>
            ) : (
              <Button onClick={handleNext}>Next</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
