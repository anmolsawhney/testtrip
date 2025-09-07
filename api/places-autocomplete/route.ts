/**
 * @description
 * API route handler for fetching place autocomplete suggestions from Google Places API.
 * Acts as a secure proxy to avoid exposing the API key directly to the client.
 * UPDATED: The API call has been optimized for Indian locations by removing the restrictive
 * `types=(cities)` filter and adding a `components=country:in` parameter to bias
 * results towards India. This provides much more relevant and comprehensive suggestions
 * for the app's target region.
 *
 * Endpoint: GET /api/places-autocomplete
 * Query Param: query (string) - The user's input string for location search.
 *
 * Key features:
 * - Securely uses server-side GOOGLE_PLACES_API_KEY.
 * - Fetches suggestions from Google Places Autocomplete API.
 * - Returns a simplified list of predictions (description, place_id).
 * - Handles errors gracefully.
 *
 * @dependencies
 * - next/server: For Next.js API route handling (NextRequest, NextResponse).
 *
 * @notes
 * - Requires GOOGLE_PLACES_API_KEY to be set in environment variables.
 * - Consider adding more robust error logging/reporting in production.
 * - Rate limiting might be necessary for high-traffic applications.
 */
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  // --- Input Validation ---
  if (!apiKey) {
    console.error(
      "Places Autocomplete Error: GOOGLE_PLACES_API_KEY is not set."
    )
    return NextResponse.json(
      { error: "API configuration error." },
      { status: 500 }
    )
  }

  if (!query) {
    // Return empty array if query is empty, no need to call Google API
    return NextResponse.json({ predictions: [] })
  }

  if (query.length < 2) {
    // Don't search for very short queries to save API calls
    return NextResponse.json({ predictions: [] })
  }
  // --- End Validation ---

  // --- UPDATED Google Places API URL ---
  // Removed `&types=(cities)` to allow for a broader range of location types (towns, localities, etc.).
  // Added `&components=country:in` to strongly bias search results towards India.
  // Added `&language=en` to ensure results are in English.
  const googleApiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
    query
  )}&key=${apiKey}&language=en`

  try {
    console.log(
      `[API Places Autocomplete] Fetching suggestions for query: "${query}" with India focus.`
    )
    const response = await fetch(googleApiUrl)
    const data = await response.json()

    if (!response.ok || data.status !== "OK") {
      // Handle Google API errors
      console.error(
        `[API Places Autocomplete] Google API Error (${data.status}):`,
        data.error_message || "Unknown error"
      )
      // Avoid exposing detailed Google errors directly to client if sensitive
      let clientErrorMessage = "Failed to fetch place suggestions."
      if (data.status === "ZERO_RESULTS") {
        clientErrorMessage = "No suggestions found."
        // Return empty array for zero results instead of error
        return NextResponse.json({ predictions: [] })
      } else if (data.status === "REQUEST_DENIED") {
        clientErrorMessage = "API request denied. Check API key or permissions."
      } else if (data.status === "OVER_QUERY_LIMIT") {
        clientErrorMessage = "Rate limit exceeded. Please try again later."
      }
      // For other errors, keep the generic message
      return NextResponse.json(
        { error: clientErrorMessage },
        { status: data.status === "OVER_QUERY_LIMIT" ? 429 : 500 } // Use appropriate status codes
      )
    }

    // Simplify the response to only include necessary fields
    const simplifiedPredictions = data.predictions.map((prediction: any) => ({
      description: prediction.description,
      place_id: prediction.place_id
    }))

    console.log(
      `[API Places Autocomplete] Returning ${simplifiedPredictions.length} suggestions.`
    )
    return NextResponse.json({ predictions: simplifiedPredictions })
  } catch (error) {
    console.error("[API Places Autocomplete] Internal Server Error:", error)
    return NextResponse.json(
      { error: "Internal server error fetching place suggestions." },
      { status: 500 }
    )
  }
}
