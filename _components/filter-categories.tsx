/**
 * @description
 * Collection of filter category components for the TripRizz filter modal.
 * Each component handles a specific filter type with appropriate UI controls.
 * UPDATED: The list of activities/interests is now sourced from a central
 * constants file to ensure consistency with the profile creation form.
 *
 * @dependencies
 * - "react": For component rendering and state.
 * - "@/components/ui/*": For UI elements (radio groups, sliders, date pickers, etc.).
 * - "date-fns": For date formatting and validation.
 * - "@/lib/utils": For cn utility.
 * - "@/lib/constants": For the centralized list of travel preferences.
 */

"use client"

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  ChangeEvent
} from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { format, parseISO, isValid } from "date-fns"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SelectProfile } from "@/types"
import { travelPreferenceOptions } from "@/lib/constants"

// --- Types ---
interface PlaceSuggestion {
  description: string
  place_id: string
}

// --- Reusable Filter Section Wrapper ---
const FilterSection = ({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) => (
  <div className="space-y-4 border-b pb-6 last:border-b-0 last:pb-0">
    <h3 className="text-lg font-medium">{title}</h3>
    <div className="pt-2">{children}</div>
  </div>
)

// --- Trip Type Filter Component ---
interface TripTypeFilterProps {
  value: string | null
  onChange: (value: string | null) => void
  profile: SelectProfile | null
}

export function TripTypeFilter({
  value,
  onChange,
  profile
}: TripTypeFilterProps) {
  const baseOptions = ["solo", "group"]
  const showWomenOnlyOption = profile?.gender === "female"
  const options = showWomenOnlyOption
    ? [...baseOptions, "women_only"]
    : baseOptions

  return (
    <FilterSection title="Trip Type">
      <RadioGroup
        value={value || ""}
        onValueChange={v => onChange(v === "" ? null : v)}
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {options.map(option => (
          <div key={option} className="flex items-center space-x-2">
            <RadioGroupItem value={option} id={`modal-trip-${option}`} />
            <Label htmlFor={`modal-trip-${option}`} className="capitalize">
              {option.replace("_", " ")}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </FilterSection>
  )
}

// --- Budget Filter Component ---
interface BudgetFilterProps {
  value: number | null
  onChange: (value: number | null) => void
}

export function BudgetFilter({ value, onChange }: BudgetFilterProps) {
  const maxVal = 100000
  const minVal = 1000
  const displayValue = value ?? maxVal

  return (
    <FilterSection title="Budget per person (INR)">
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <Label htmlFor="max-budget">Min: ₹{minVal.toLocaleString()}</Label>
            <span>
              Max: ₹{displayValue.toLocaleString()}
              {displayValue === maxVal ? "+" : ""}
            </span>
          </div>
          <Slider
            id="max-budget"
            defaultValue={[maxVal]}
            value={[displayValue]}
            min={minVal}
            max={maxVal}
            step={1000}
            onValueChange={values => {
              onChange(values[0] === maxVal ? null : values[0])
            }}
          />
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Show trips with a budget up to the selected amount.
      </p>
    </FilterSection>
  )
}

// --- Group Size Filter Component ---
interface GroupSizeFilterProps {
  value: number | null
  onChange: (value: number | null) => void
}

export function GroupSizeFilter({ value, onChange }: GroupSizeFilterProps) {
  const maxVal = 20
  const displayValue = value ?? maxVal

  return (
    <FilterSection title="Group Size">
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex justify-between">
            <Label htmlFor="max-group-size">Min</Label>
            <span>{displayValue === maxVal ? "Any" : displayValue}</span>
          </div>
          <Slider
            id="max-group-size"
            defaultValue={[maxVal]}
            value={[displayValue]}
            min={1}
            max={maxVal}
            step={1}
            onValueChange={values => {
              onChange(values[0] === maxVal ? null : values[0])
            }}
          />
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Find trips with a maximum group size up to the selected number.
      </p>
    </FilterSection>
  )
}

// --- Date Range Filter Component ---
interface DateRangeFilterProps {
  startDate: string | null
  endDate: string | null
  onStartDateChange: (value: string | null) => void
  onEndDateChange: (value: string | null) => void
}

const formatSafeDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "Select date"
  try {
    const parsedDate = parseISO(dateString)
    if (isValid(parsedDate)) {
      return format(parsedDate, "PPP")
    } else {
      console.warn(
        `[formatSafeDate] Received invalid date string: ${dateString}`
      )
      return "Invalid date"
    }
  } catch (e) {
    console.error("[formatSafeDate] Error formatting date:", dateString, e)
    return "Error"
  }
}

const parseSafeDate = (
  dateString: string | null | undefined
): Date | undefined => {
  if (!dateString) return undefined
  try {
    const parsed = parseISO(dateString)
    return isValid(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange
}: DateRangeFilterProps) {
  const safeStartDate = parseSafeDate(startDate)
  const safeEndDate = parseSafeDate(endDate)

  return (
    <FilterSection title="Trip Dates">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col space-y-2">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <i className="fi fi-rr-calendar mr-2 text-base"></i>
                {formatSafeDate(startDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={safeStartDate}
                onSelect={date =>
                  onStartDateChange(date ? format(date, "yyyy-MM-dd") : null)
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col space-y-2">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <i className="fi fi-rr-calendar mr-2 text-base"></i>
                {formatSafeDate(endDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={safeEndDate}
                onSelect={date =>
                  onEndDateChange(date ? format(date, "yyyy-MM-dd") : null)
                }
                initialFocus
                disabled={safeStartDate ? { before: safeStartDate } : undefined}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </FilterSection>
  )
}

// --- Location Filter Component ---
interface LocationFilterProps {
  value: string | null
  onChange: (value: string | null) => void
}

export function LocationFilter({ value, onChange }: LocationFilterProps) {
  const [inputValue, setInputValue] = useState(value || "")
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputValue(value || "")
  }, [value])

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/places-autocomplete?query=${encodeURIComponent(query)}`
      )
      if (!response.ok) throw new Error("Failed to fetch suggestions")
      const data = await response.json()
      setSuggestions(data.predictions || [])
      setShowSuggestions(data.predictions?.length > 0)
    } catch (error) {
      console.error("Error fetching place suggestions:", error)
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current)
    if (inputValue.length >= 2) {
      debounceTimeoutRef.current = setTimeout(() => {
        fetchSuggestions(inputValue)
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current)
    }
  }, [inputValue, fetchSuggestions])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    if (e.target.value === "") {
      onChange(null)
    }
  }

  const handleSuggestionClick = (suggestion: PlaceSuggestion) => {
    setInputValue(suggestion.description)
    onChange(suggestion.description)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (
        suggestionsRef.current &&
        suggestionsRef.current.contains(document.activeElement)
      ) {
        return
      }
      setShowSuggestions(false)
      if (inputValue !== value) {
        onChange(inputValue.trim() || null)
      }
    }, 150)
  }

  const handleFocus = () => {
    if (inputValue.length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  return (
    <FilterSection title="Location">
      <div className="relative">
        <Input
          placeholder="Enter destination"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
            onMouseDown={e => e.preventDefault()}
          >
            {suggestions.map(suggestion => (
              <div
                key={suggestion.place_id}
                onClick={() => handleSuggestionClick(suggestion)}
                className="cursor-pointer select-none px-4 py-2 text-gray-900 hover:bg-purple-100 hover:text-purple-900"
                tabIndex={0}
              >
                {suggestion.description}
              </div>
            ))}
          </div>
        )}
      </div>
    </FilterSection>
  )
}

// --- Activities Filter Component ---
interface ActivitiesFilterProps {
  values: string[]
  onChange: (values: string[]) => void
}

export function ActivitiesFilter({ values, onChange }: ActivitiesFilterProps) {
  const activities = travelPreferenceOptions.map(opt => opt.label)

  const handleToggle = (activity: string) => {
    if (values.includes(activity)) {
      onChange(values.filter(v => v !== activity))
    } else {
      onChange([...values, activity])
    }
  }

  return (
    <FilterSection title="Activities & Interests">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {activities.map(activity => (
          <div className="flex items-center space-x-2" key={activity}>
            <Checkbox
              id={`activity-${activity.replace(/[^a-zA-Z0-9]/g, "-")}`}
              checked={values.includes(activity)}
              onCheckedChange={() => handleToggle(activity)}
            />
            <Label
              htmlFor={`activity-${activity.replace(/[^a-zA-Z0-9]/g, "-")}`}
              className="capitalize"
            >
              {activity}
            </Label>
          </div>
        ))}
      </div>
    </FilterSection>
  )
}

// --- Status Filter Component ---
interface StatusFilterProps {
  value: string | null
  onChange: (value: string | null) => void
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const options = ["upcoming", "ongoing", "completed"]

  return (
    <FilterSection title="Trip Status">
      <RadioGroup
        value={value || ""}
        onValueChange={v => onChange(v === "" ? null : v)}
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {options.map(option => (
          <div key={option} className="flex items-center space-x-2">
            <RadioGroupItem value={option} id={`status-${option}`} />
            <Label htmlFor={`status-${option}`} className="capitalize">
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </FilterSection>
  )
}

// --- Sort By Filter Component ---
interface SortByFilterProps {
  value: string | null
  onChange: (value: string | null) => void
}

export function SortByFilter({ value, onChange }: SortByFilterProps) {
  const options = [
    { value: "createdAt", label: "Newest" },
    { value: "likes", label: "Most Liked" },
    { value: "startDate", label: "Start Date" }
  ]

  return (
    <FilterSection title="Sort By">
      <RadioGroup
        value={value || "createdAt"}
        onValueChange={v => {
          onChange(v === "createdAt" ? null : v)
        }}
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {options.map(option => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem value={option.value} id={`sort-${option.value}`} />
            <Label htmlFor={`sort-${option.value}`}>{option.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </FilterSection>
  )
}
