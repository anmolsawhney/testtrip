/**
 * @description
 * Client-side component for handling user profile setup during onboarding.
 * This is a legacy component and is being replaced by `profile-form.tsx`.
 * UPDATED: Replaced `displayName` with `username` to align with schema.
 *
 * @dependencies
 * - All existing dependencies.
 */
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useDropzone, type FileRejection } from "react-dropzone"
import { isValid, parseISO, format } from "date-fns"
import { getProfileByUserIdAction } from "@/actions/db/profiles-actions"
import { completeOnboardingAction } from "@/actions/db/onboarding-actions"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"
import { budgetPreferenceEnum, genderEnum } from "@/db/schema/enums"
import type { InsertProfile } from "@/db/schema"
import { useToast } from "@/lib/hooks/use-toast"

const travelPreferenceOptions = [
  "Adventure / Outdoor",
  "Beach / Coastal",
  "Mountain / Nature",
  "City / Urban",
  "Countryside",
  "Desert / Safari",
  "Culture / History",
  "Wellness / Relaxation",
  "Spiritual / Pilgrimage",
  "Road Trip",
  "Events ( e.g. concert )"
] as const

const personalizedQuestions = [
  {
    id: "qTravelMood",
    label: "What’s your ideal travel mood?",
    type: "textarea"
  },
  {
    id: "qNightOwl",
    label: "Early bird or night owl on trips?",
    type: "textarea"
  },
  {
    id: "qTravelPlaylist",
    label: "Your go-to travel playlist? (name or link)",
    type: "input"
  },
  {
    id: "qMustPack",
    label: "Must-pack item you never travel without?",
    type: "textarea"
  },
  {
    id: "qBucketListGoal",
    label: "One travel goal on your bucket list?",
    type: "input"
  },
  {
    id: "qNextDestination",
    label: "Where are you dreaming of going next?",
    type: "input"
  }
] as const

const profileSetupFormSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be less than 30 characters")
    .refine(s => s.trim().length > 0, "Username is required"),
  bio: z
    .string()
    .min(1, "Bio is required")
    .max(500, "Bio must be less than 500 characters"),
  gender: z.enum(genderEnum.enumValues, {
    required_error: "Gender is required."
  }),
  dateOfBirth: z
    .string()
    .refine(dob => dob, { message: "Date of Birth is required." })
    .refine(
      dob => {
        if (!dob) return false
        try {
          const parsedDate = parseISO(dob)
          return isValid(parsedDate)
        } catch {
          return false
        }
      },
      { message: "Invalid date format (YYYY-MM-DD)." }
    ),
  location: z.string().max(100, "Location too long").optional().nullable(),
  travelPreferences: z
    .array(z.string())
    .min(1, { message: "Please select at least one travel preference." })
    .default([]),
  budgetPreference: z
    .enum(budgetPreferenceEnum.enumValues)
    .optional()
    .nullable(),
  qTravelMood: z.string().max(500, "Answer too long").optional().nullable(),
  qNightOwl: z.string().max(500, "Answer too long").optional().nullable(),
  qTravelPlaylist: z.string().max(200, "Answer too long").optional().nullable(),
  qMustPack: z.string().max(500, "Answer too long").optional().nullable(),
  qBucketListGoal: z.string().max(500, "Answer too long").optional().nullable(),
  qNextDestination: z.string().max(500, "Answer too long").optional().nullable()
})

type ProfileSetupFormValues = z.infer<typeof profileSetupFormSchema>

export default function ProfileSetup() {
  const router = useRouter()
  const { userId } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isExistingUser, setIsExistingUser] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [hasRequiredPhoto, setHasRequiredPhoto] = useState(false)

  const form = useForm<ProfileSetupFormValues>({
    resolver: zodResolver(profileSetupFormSchema),
    defaultValues: {
      username: "",
      bio: "",
      gender: undefined,
      dateOfBirth: "",
      location: "",
      travelPreferences: [],
      budgetPreference: undefined,
      qTravelMood: "",
      qNightOwl: "",
      qTravelPlaylist: "",
      qMustPack: "",
      qBucketListGoal: "",
      qNextDestination: ""
    },
    mode: "onChange"
  })

  const bioValue = form.watch("bio") || ""
  const MAX_BIO_LENGTH = 500

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    onDrop: useCallback(
      (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
          const file = acceptedFiles[0]
          setProfilePhotoFile(file)
          setHasRequiredPhoto(true)
          if (photoPreview && photoPreview.startsWith("blob:"))
            URL.revokeObjectURL(photoPreview)
          const newPreviewUrl = URL.createObjectURL(file)
          setPhotoPreview(newPreviewUrl)
        }
      },
      [photoPreview]
    ),
    onDropRejected: useCallback(
      (rejections: FileRejection[]) => {
        setError(
          rejections[0]?.errors[0]?.code === "file-too-large"
            ? "Max size is 5MB."
            : "Invalid file type."
        )
        setProfilePhotoFile(null)
        setHasRequiredPhoto(!!photoPreview && photoPreview.startsWith("http"))
        if (photoPreview && photoPreview.startsWith("blob:"))
          URL.revokeObjectURL(photoPreview)
        setPhotoPreview(prev => (prev?.startsWith("http") ? prev : null))
      },
      [photoPreview]
    )
  })

  useEffect(() => {
    const currentPreview = photoPreview
    return () => {
      if (currentPreview && currentPreview.startsWith("blob:"))
        URL.revokeObjectURL(currentPreview)
    }
  }, [photoPreview])

  useEffect(() => {
    async function checkExistingProfile() {
      if (!userId) {
        setInitializing(false)
        return
      }
      try {
        setInitializing(true)
        const profileResult = await getProfileByUserIdAction(userId)
        if (profileResult.isSuccess && profileResult.data) {
          const profile = profileResult.data
          form.reset({
            username: profile.username ?? "",
            bio: profile.bio ?? "",
            gender: profile.gender ?? undefined,
            dateOfBirth: profile.dateOfBirth
              ? format(parseISO(String(profile.dateOfBirth)), "yyyy-MM-dd")
              : "",
            location: profile.location ?? "",
            travelPreferences: profile.travelPreferences ?? [],
            budgetPreference: profile.budgetPreference ?? undefined,
            qTravelMood: profile.qTravelMood ?? "",
            qNightOwl: profile.qNightOwl ?? "",
            qTravelPlaylist: profile.qTravelPlaylist ?? "",
            qMustPack: profile.qMustPack ?? "",
            qBucketListGoal: profile.qBucketListGoal ?? "",
            qNextDestination: profile.qNextDestination ?? ""
          })
          if (profile.profilePhoto && profile.profilePhoto.startsWith("http")) {
            setPhotoPreview(profile.profilePhoto)
            setHasRequiredPhoto(true)
          } else {
            setHasRequiredPhoto(false)
          }
          setIsExistingUser(true)
        } else if (
          profileResult.message !== "Profile not found" &&
          profileResult.message !== "Profile already exists for this user."
        ) {
          setError("Could not load profile data.")
        }
      } catch (error) {
        setError("An error occurred loading profile.")
        console.error(error)
      } finally {
        setInitializing(false)
      }
    }
    checkExistingProfile()
  }, [userId, form])

  const onSubmit = async (data: ProfileSetupFormValues) => {
    if (!userId) {
      setError("Authentication error.")
      return
    }
    if (!hasRequiredPhoto && !profilePhotoFile) {
      setError("Profile photo is required.")
      return
    }
    setLoading(true)
    setError(null)
    let finalPhotoUrl: string | null = photoPreview?.startsWith("http")
      ? photoPreview
      : null

    if (profilePhotoFile) {
      setIsUploadingPhoto(true)
      const photoFormData = new FormData()
      photoFormData.append("profilePhoto", profilePhotoFile)
      try {
        const response = await fetch("/api/upload/profile-photo", {
          method: "POST",
          body: photoFormData
        })
        if (!response.ok) {
          const errorResult = await response.json()
          throw new Error(
            errorResult.error || `Upload failed: ${response.statusText}`
          )
        }
        const result = await response.json()
        if (!result.publicUrl) {
          throw new Error("Upload succeeded but URL missing from response.")
        }
        finalPhotoUrl = result.publicUrl
      } catch (uploadError) {
        const errorMessage =
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload photo."
        setError(errorMessage)
        toast({
          title: "Photo Upload Error",
          description: errorMessage,
          variant: "destructive"
        })
        setLoading(false)
        setIsUploadingPhoto(false)
        return
      } finally {
        setIsUploadingPhoto(false)
      }
    }

    if (!finalPhotoUrl) {
      setError("Profile photo is required and upload failed or was missing.")
      setLoading(false)
      return
    }

    try {
      const updatePayload: Partial<InsertProfile> = {
        username: data.username,
        bio: data.bio,
        profilePhoto: finalPhotoUrl,
        gender: data.gender || null,
        budgetPreference: data.budgetPreference || null,
        travelPreferences: data.travelPreferences || [],
        dateOfBirth: data.dateOfBirth || null,
        location: data.location || null,
        profileQuestionsCompleted: true,
        qTravelMood: data.qTravelMood || null,
        qNightOwl: data.qNightOwl || null,
        qTravelPlaylist: data.qTravelPlaylist || null,
        qMustPack: data.qMustPack || null,
        qBucketListGoal: data.qBucketListGoal || null,
        qNextDestination: data.qNextDestination || null
      }

      const result = await completeOnboardingAction(userId, updatePayload)
      if (result.isSuccess) {
        toast({
          title: "Profile Setup Complete!",
          description: "Welcome to TripTrizz. You will be redirected shortly."
        })
        router.push("/")
      } else {
        throw new Error(result.message || "Failed to save profile.")
      }
    } catch (dbError) {
      const errorMessage =
        dbError instanceof Error
          ? dbError.message
          : "An unexpected error occurred."
      setError(errorMessage)
      toast({
        title: "Error Saving Profile",
        description: errorMessage,
        variant: "destructive"
      })
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-t-purple-500"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {isExistingUser ? "Complete Your Profile" : "Welcome to TripRizz!"}
          </CardTitle>
          <CardDescription>
            {isExistingUser
              ? "Please complete your profile to get started."
              : "Tell us about yourself to personalize your experience."}
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8">
              <Accordion type="single" collapsible defaultValue="item-1">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="text-lg font-semibold">
                    Step 1: Basic Info
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pt-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Username<span className="ml-1 text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Your unique username"
                              disabled={loading || isUploadingPhoto}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>
                        Profile Photo
                        <span className="ml-1 text-red-500">*</span>
                      </FormLabel>
                      <div
                        {...getRootProps()}
                        className={`mt-1 cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition-colors ${isDragActive ? "border-purple-500 bg-purple-50" : "border-gray-300 hover:border-purple-400"} ${loading || isUploadingPhoto ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        <FormControl>
                          <input
                            {...getInputProps()}
                            disabled={loading || isUploadingPhoto}
                          />
                        </FormControl>
                        {photoPreview ? (
                          <div className="flex flex-col items-center">
                            <img
                              src={photoPreview}
                              alt="Profile preview"
                              className="mb-4 size-32 rounded-full object-cover"
                            />
                            <p className="text-sm text-gray-600">
                              Click or drag to replace
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <i className="fi fi-rr-cloud-upload-alt mb-2 text-5xl text-gray-400"></i>
                            <p className="mb-1 text-gray-600">
                              {isDragActive
                                ? "Drop here"
                                : "Click or drag photo"}
                            </p>
                            <p className="text-xs text-gray-500">
                              Supports: PNG / JPG / GIF / WEBP. Max 5MB.
                            </p>
                          </div>
                        )}
                      </div>
                      {!hasRequiredPhoto &&
                        !profilePhotoFile &&
                        form.formState.isSubmitted && (
                          <p className="text-destructive text-sm font-medium">
                            Profile photo is required.
                          </p>
                        )}
                    </FormItem>
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Bio <span className="ml-1 text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="About you..."
                              className="min-h-[120px]"
                              disabled={loading || isUploadingPhoto}
                              maxLength={MAX_BIO_LENGTH}
                              {...field}
                            />
                          </FormControl>
                          <div className="text-muted-foreground text-right text-xs">
                            {bioValue.length}/{MAX_BIO_LENGTH}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Date of Birth
                            <span className="ml-1 text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              disabled={loading || isUploadingPhoto}
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., London, UK"
                              disabled={loading || isUploadingPhoto}
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Your city, state, or country.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Gender <span className="ml-1 text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ""}
                            disabled={loading || isUploadingPhoto}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {genderEnum.enumValues.map(gv => (
                                <SelectItem
                                  key={gv}
                                  value={gv}
                                  className="capitalize"
                                >
                                  {gv.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="budgetPreference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Budget Preference (Optional)</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ""}
                            disabled={loading || isUploadingPhoto}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select budget" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {budgetPreferenceEnum.enumValues.map(bv => (
                                <SelectItem
                                  key={bv}
                                  value={bv}
                                  className="capitalize"
                                >
                                  {bv.replace("-", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <Accordion type="single" collapsible>
                <AccordionItem value="item-2">
                  <AccordionTrigger className="text-lg font-semibold">
                    Step 2: Travel Preferences
                    <span className="ml-1 text-red-500">*</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <FormField
                      control={form.control}
                      name="travelPreferences"
                      render={({ field }) => (
                        <FormItem>
                          <div className="mb-4 text-base font-medium">
                            What kind of travel do you enjoy?
                            <p className="text-muted-foreground text-sm font-normal">
                              Select all that apply.
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                            {travelPreferenceOptions.map(item => (
                              <FormItem
                                key={item}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    disabled={loading || isUploadingPhoto}
                                    checked={field.value?.includes(item)}
                                    onCheckedChange={checked => {
                                      const currentValue = field.value ?? []
                                      return checked
                                        ? field.onChange([
                                            ...currentValue,
                                            item
                                          ])
                                        : field.onChange(
                                            currentValue.filter(
                                              value => value !== item
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {item}
                                </FormLabel>
                              </FormItem>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <Accordion type="single" collapsible>
                <AccordionItem value="item-3">
                  <AccordionTrigger className="text-lg font-semibold">
                    Step 3: A Little More About You (Optional)
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pt-4">
                    {personalizedQuestions.map(question => (
                      <FormField
                        key={question.id}
                        control={form.control}
                        name={question.id as keyof ProfileSetupFormValues}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{question.label}</FormLabel>
                            <FormControl>
                              {question.type === "textarea" ? (
                                <Textarea
                                  placeholder="Your answer..."
                                  disabled={loading || isUploadingPhoto}
                                  maxLength={500}
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              ) : (
                                <Input
                                  placeholder="Your answer..."
                                  disabled={loading || isUploadingPhoto}
                                  maxLength={500}
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              )}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="bg-gradient-1 w-full"
                disabled={loading || isUploadingPhoto}
              >
                {loading || isUploadingPhoto ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {isUploadingPhoto
                      ? "Uploading Photo..."
                      : "Saving Profile..."}
                  </>
                ) : (
                  "Save Profile & Continue"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
