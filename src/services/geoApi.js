import { apiRequest } from './apiClient'

/**
 * Resolve a Google Maps share/place URL to latitude & longitude via the backend
 * (short links like maps.app.goo.gl need server-side redirect follow).
 */
export async function resolveGoogleMapsUrl(url) {
    return apiRequest('/geo/resolve-maps-url', {
        method: 'POST',
        body: { url: String(url || '').trim() },
    })
}

export function looksLikeGoogleMapsUrl(value) {
    const text = String(value || '').trim().toLowerCase()
    if (!text) return false
    return (
        text.includes('maps.app.goo.gl')
        || text.includes('goo.gl/maps')
        || text.includes('google.com/maps')
        || text.includes('maps.google.')
        || /https?:\/\/.*(google|goo\.gl)/i.test(text)
    )
}
