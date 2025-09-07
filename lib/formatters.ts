/**
 * @description
 * This file contains utility functions for formatting data for display in the UI.
 * UPDATED: The `formatEnumForDisplay` function is now more robust and can handle
 * both snake_case and kebab-case strings, converting them to Title Case.
 *
 * Key features:
 * - formatEnumForDisplay: Converts snake_case or kebab-case enum values into Title Case strings.
 */

/**
 * Converts a snake_case or kebab-case string into a Title Case string.
 * e.g., 'prefer_not_to_say' becomes 'Prefer Not To Say', and 'low-range' becomes 'Low Range'.
 * @param enumValue The string value to format. Can be null or undefined.
 * @returns A formatted, human-readable string, or an empty string if input is falsy.
 */
export const formatEnumForDisplay = (
  enumValue: string | null | undefined
): string => {
  if (!enumValue) return ""
  // Replace both underscores and hyphens with a space, then process
  return enumValue
    .replace(/_|-/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
