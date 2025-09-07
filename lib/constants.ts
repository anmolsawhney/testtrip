/**
 * @description
 * This file contains shared constants used throughout the TripTrizz application.
 * Centralizing these constants helps ensure consistency and makes maintenance easier.
 *
 * Key features:
 * - travelPreferenceOptions: A single source of truth for travel preferences,
 *   including their display labels and corresponding Flaticon icon class names.
 */

/**
 * An array of objects representing the available travel preferences.
 * Each object has a `label` for display and an `iconClass` for its Flaticon icon.
 */
export const travelPreferenceOptions = [
  { label: "Adventure / Outdoor", iconClass: "fi fi-rr-snowmobile" },
  { label: "Beach / Coastal", iconClass: "fi fi-rr-island-tropical" },
  { label: "Mountain / Nature", iconClass: "fi fi-rr-mountain" },
  { label: "City / Urban", iconClass: "fi fi-rr-train-station-building" },
  { label: "Countryside", iconClass: "fi fi-rr-mill" },
  { label: "Desert / Safari", iconClass: "fi fi-rr-cactus" },
  { label: "Culture / History", iconClass: "fi fi-rr-lanterns" },
  { label: "Wellness / Relaxation", iconClass: "fi fi-rr-massage" },
  {
    label: "Spiritual / Pilgrimage",
    iconClass: "fi fi-rr-incense-sticks-yoga"
  },
  { label: "Road Trip", iconClass: "fi fi-rr-car-side" },
  { label: "Events ( e.g. concert )", iconClass: "fi fi-rr-stage" }
] as const
