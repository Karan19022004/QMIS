/**
 * Queen Mira International School — Madurai
 * Source: https://maps.app.goo.gl/2JVmiagM4b4V3GaFA
 * Exact place pin: 9.949084, 78.0696864
 */
export const SCHOOL_CAMPUS = {
    name: 'Queen Mira International School',
    lat: 9.949084,
    lng: 78.0696864,
    position: [9.949084, 78.0696864],
    mapsUrl: 'https://maps.app.goo.gl/2JVmiagM4b4V3GaFA',
}

const SCHOOL_NAME_HINTS = [
    'queen mira',
    'queen mira international school',
    'qmis',
    'school campus',
    'school',
    'campus',
]

export function isSchoolPlaceName(value) {
    const text = String(value || '').trim().toLowerCase()
    if (!text) return false
    return SCHOOL_NAME_HINTS.some((hint) => text === hint || text.includes('queen mira'))
}

/** Reject null-island / empty GPS pairs. */
export function parseMapLatLng(lat, lng) {
    const a = Number(lat)
    const b = Number(lng)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    if (Math.abs(a) > 90 || Math.abs(b) > 180) return null
    // 0,0 is Null Island — never a real Madurai stop
    if (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6) return null
    return [a, b]
}

export function resolveDestinationPosition({ endPosition, endLat, endLng, endLocation } = {}) {
    const fromProp = Array.isArray(endPosition)
        ? parseMapLatLng(endPosition[0], endPosition[1])
        : null
    if (fromProp) return fromProp
    const fromFields = parseMapLatLng(endLat, endLng)
    if (fromFields) return fromFields
    if (isSchoolPlaceName(endLocation)) return SCHOOL_CAMPUS.position
    return null
}
