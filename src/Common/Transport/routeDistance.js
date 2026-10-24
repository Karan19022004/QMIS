/**
 * Route length from ordered pickup pins → school destination (haversine).
 */

const toRad = (deg) => (Number(deg) * Math.PI) / 180

export function haversineKm(a, b) {
    if (!a || !b) return null
    const lat1 = Number(a[0])
    const lng1 = Number(a[1])
    const lat2 = Number(b[0])
    const lng2 = Number(b[1])
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null
    if (Math.abs(lat1) < 1e-6 && Math.abs(lng1) < 1e-6) return null
    if (Math.abs(lat2) < 1e-6 && Math.abs(lng2) < 1e-6) return null

    const R = 6371
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const sinLat = Math.sin(dLat / 2)
    const sinLng = Math.sin(dLng / 2)
    const h = sinLat * sinLat
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function stopToLatLng(stop) {
    const lat = Number(stop?.pickupLat ?? stop?.startLat)
    const lng = Number(stop?.pickupLng ?? stop?.startLng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return null
    return [lat, lng]
}

/**
 * Sum pickup1 → pickup2 → … → destination (school).
 * @returns {{ km: number|null, pinnedStops: number, label: string, estimatedMinutes: number|null }}
 */
export function computeRouteDistanceFromStops(stops, destination) {
    const points = (Array.isArray(stops) ? stops : [])
        .map(stopToLatLng)
        .filter(Boolean)

    const destLat = Number(destination?.lat ?? destination?.[0])
    const destLng = Number(destination?.lng ?? destination?.[1])
    const dest = Number.isFinite(destLat) && Number.isFinite(destLng)
        && !(Math.abs(destLat) < 1e-6 && Math.abs(destLng) < 1e-6)
        ? [destLat, destLng]
        : null

    if (points.length === 0) {
        return { km: null, pinnedStops: 0, label: '', estimatedMinutes: null }
    }

    const path = dest ? [...points, dest] : points
    if (path.length < 2) {
        return {
            km: null,
            pinnedStops: points.length,
            label: '',
            estimatedMinutes: null,
        }
    }

    let total = 0
    for (let i = 0; i < path.length - 1; i += 1) {
        const segment = haversineKm(path[i], path[i + 1])
        if (segment == null) {
            return { km: null, pinnedStops: points.length, label: '', estimatedMinutes: null }
        }
        total += segment
    }

    const km = Math.round(total * 10) / 10
    // Rough urban school-bus average ~22 km/h including stops.
    const estimatedMinutes = Math.max(5, Math.round((km / 22) * 60))
    return {
        km,
        pinnedStops: points.length,
        label: `${km} km`,
        estimatedMinutes,
        estimatedTimeLabel: `${estimatedMinutes} mins`,
    }
}
