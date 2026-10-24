import { looksLikeGoogleMapsUrl, resolveGoogleMapsUrl } from '../../services/geoApi'

const hasPin = (stop) => {
    const lat = Number(stop?.pickupLat ?? stop?.startLat)
    const lng = Number(stop?.pickupLng ?? stop?.startLng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
    if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return false
    return true
}

/**
 * Fill missing pickupLat/Lng from Google Maps share links so every stop can render on Track Bus.
 */
export async function ensureStopCoordinates(stops = []) {
    const list = Array.isArray(stops) ? stops : []
    return Promise.all(list.map(async (stop) => {
        if (!stop || hasPin(stop)) return stop
        const url = String(stop.pickupMapsUrl || stop.mapsUrl || '').trim()
        if (!looksLikeGoogleMapsUrl(url)) return stop
        try {
            const resolved = await resolveGoogleMapsUrl(url)
            const lat = Number(resolved?.lat)
            const lng = Number(resolved?.lng)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return stop
            if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return stop
            return {
                ...stop,
                pickupLat: lat,
                pickupLng: lng,
                startLat: lat,
                startLng: lng,
                pickupMapsUrl: String(resolved?.sourceUrl || url),
            }
        } catch {
            return stop
        }
    }))
}
