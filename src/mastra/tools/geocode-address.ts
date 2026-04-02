import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

// In-memory cache for geocode results
const geocodeCache = new Map<string, { lat: number; lng: number; address: string }>()

// Hardcoded landmark database for fallback
const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number; address: string }> = {
  'times square': { lat: 40.758, lng: -73.9855, address: 'Times Square, New York, NY' },
  'empire state building': { lat: 40.7484, lng: -73.9856, address: 'Empire State Building, New York, NY' },
  'jfk airport': { lat: 40.6413, lng: -73.7781, address: 'JFK Airport, Queens, NY' },
  'jfk': { lat: 40.6413, lng: -73.7781, address: 'JFK Airport, Queens, NY' },
  'laguardia': { lat: 40.7772, lng: -73.8726, address: 'LaGuardia Airport, Queens, NY' },
  'laguardia airport': { lat: 40.7772, lng: -73.8726, address: 'LaGuardia Airport, Queens, NY' },
  'central park': { lat: 40.7829, lng: -73.9654, address: 'Central Park, New York, NY' },
  'brooklyn bridge': { lat: 40.7061, lng: -73.9969, address: 'Brooklyn Bridge, New York, NY' },
  'union square': { lat: 40.7359, lng: -73.9911, address: 'Union Square, New York, NY' },
  'grand central': { lat: 40.7527, lng: -73.9772, address: 'Grand Central Terminal, New York, NY' },
  'grand central terminal': { lat: 40.7527, lng: -73.9772, address: 'Grand Central Terminal, New York, NY' },
  'penn station': { lat: 40.7506, lng: -73.9935, address: 'Penn Station, New York, NY' },
  'wall street': { lat: 40.7069, lng: -74.0089, address: 'Wall Street, New York, NY' },
  'sfo': { lat: 37.6213, lng: -122.379, address: 'SFO Airport, San Francisco, CA' },
  'sfo airport': { lat: 37.6213, lng: -122.379, address: 'SFO Airport, San Francisco, CA' },
  'golden gate bridge': { lat: 37.8199, lng: -122.4783, address: 'Golden Gate Bridge, San Francisco, CA' },
  'lax': { lat: 33.9425, lng: -118.408, address: 'LAX Airport, Los Angeles, CA' },
  'lax airport': { lat: 33.9425, lng: -118.408, address: 'LAX Airport, Los Angeles, CA' },
  'hollywood': { lat: 34.0928, lng: -118.3287, address: 'Hollywood, Los Angeles, CA' },
}

/**
 * Fuzzy match an address against the known locations database.
 * Returns the best match if the normalized input contains a known key or vice versa.
 */
function fuzzyMatch(input: string): { lat: number; lng: number; address: string } | null {
  const normalized = input.toLowerCase().trim()

  // Exact match first
  if (KNOWN_LOCATIONS[normalized]) {
    return KNOWN_LOCATIONS[normalized]
  }

  // Check if any known key is contained in the input, or input is contained in a key
  let bestMatch: { key: string; score: number } | null = null
  for (const key of Object.keys(KNOWN_LOCATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      const score = key.length // Prefer longer (more specific) matches
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { key, score }
      }
    }
  }

  return bestMatch ? KNOWN_LOCATIONS[bestMatch.key] : null
}

/**
 * Geocode using Google Geocoding API.
 */
async function geocodeWithGoogle(address: string, apiKey: string): Promise<{ lat: number; lng: number; address: string }> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
  const response = await fetch(url)
  const data = await response.json()

  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Google Geocoding failed for "${address}": ${data.status}`)
  }

  const result = data.results[0]
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    address: result.formatted_address,
  }
}

export const geocodeAddressTool = createTool({
  id: 'geocode-address',
  description:
    'Resolves a human-readable address or landmark name to geographic coordinates (latitude and longitude). ' +
    'Use this tool to convert addresses like "Times Square" or "123 Main St, New York" into lat/lng coordinates ' +
    'before passing them to ride-related tools such as get-estimates or book-ride.',
  inputSchema: z.object({
    address: z.string().describe('The address or landmark name to geocode, e.g. "Times Square" or "JFK Airport"'),
  }),
  outputSchema: z.object({
    lat: z.number().describe('Latitude coordinate'),
    lng: z.number().describe('Longitude coordinate'),
    address: z.string().describe('The resolved/formatted address'),
  }),
  execute: async ({ address }) => {
    // Check cache first
    const cacheKey = address.toLowerCase().trim()
    const cached = geocodeCache.get(cacheKey)
    if (cached) {
      return cached
    }

    let result: { lat: number; lng: number; address: string }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY
    if (googleApiKey) {
      // Use Google Geocoding API
      result = await geocodeWithGoogle(address, googleApiKey)
    } else {
      // Fall back to hardcoded landmark database with fuzzy matching
      const match = fuzzyMatch(address)
      if (!match) {
        throw new Error(
          `Could not geocode "${address}". No Google API key is configured and the address did not match any known landmarks. ` +
            `Known landmarks include: Times Square, Empire State Building, JFK Airport, LaGuardia, Central Park, Brooklyn Bridge, ` +
            `Union Square, Grand Central, Penn Station, Wall Street, SFO, Golden Gate Bridge, LAX, Hollywood.`,
        )
      }
      result = match
    }

    // Cache the result
    geocodeCache.set(cacheKey, result)

    return result
  },
})
