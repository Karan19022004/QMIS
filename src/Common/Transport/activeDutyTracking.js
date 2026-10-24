/**
 * Resolve whether Parent/Student Track Bus should show a live trip for a duty.
 * Pickup: home stop → school. Drop: school → home stop (pickups become drop points).
 * Live map only after the driver presses Start (In Progress).
 */

const STOP_ARRIVAL_RADIUS_M = 130
const PASSED_ALONG_ROUTE_M = 80

export function normalizeDutyType(value) {
    return String(value || '').trim().toLowerCase() === 'drop' ? 'Drop' : 'Pickup'
}

/** Duty exists for today and is not closed (Assigned or In Progress). */
export function isDutyOpenToday(duty) {
    if (!duty) return false
    if (duty.trackingActive === false) return false
    const status = String(duty.dutyStatus || duty.status || '').trim()
    if (['Completed', 'Cancelled', 'Done'].includes(status)) return false
    return ['Assigned', 'In Progress', 'Started', ''].includes(status) || duty.trackingActive === true
}

/** Live GPS / on-the-move — only after driver Start. */
export function isDutyTrackingActive(duty) {
    if (!duty) return false
    if (duty.trackingActive === false) return false
    const status = String(duty.dutyStatus || duty.status || '').trim()
    if (['Completed', 'Cancelled', 'Done'].includes(status)) return false
    return ['In Progress', 'Started'].includes(status)
}

export function parseDutyDateParts(value) {
    const text = String(value || '').trim()
    const m = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (!m) return null
    return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) }
}

export function isDutyDateToday(dutyDate, now = new Date()) {
    const parts = parseDutyDateParts(dutyDate)
    if (!parts) return false
    return (
        parts.day === now.getDate()
        && parts.month === now.getMonth() + 1
        && parts.year === now.getFullYear()
    )
}

export function findStudentStop(route, assignment) {
    const stops = Array.isArray(route?.stops) ? route.stops : []
    const want = String(
        assignment?.startLocation
        || assignment?.pickupLocation
        || assignment?.stopName
        || assignment?.pickupPoint
        || '',
    ).trim().toLowerCase()
    if (!want) return stops[0] || null
    return stops.find((stop) => {
        const name = String(stop.startLocation || stop.label || '').trim().toLowerCase()
        return name && (name === want || name.includes(want) || want.includes(name))
    }) || stops[0] || null
}

export function haversineMeters(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return Infinity
    const [lat1, lon1] = a.map(Number)
    const [lat2, lon2] = b.map(Number)
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity
    const toRad = (deg) => (deg * Math.PI) / 180
    const R = 6371000
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const x = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

/** Parse "07:30 AM", "6 AM", "7 :20 AM", "7:30", "19:30" into today's Date, or null. */
export function parseScheduleTimeToday(value, now = new Date()) {
    const text = String(value || '')
        .trim()
        .replace(/\s*:\s*/g, ':')
        .replace(/\s+/g, ' ')
    if (!text) return null
    const ampm = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
    if (ampm) {
        let hour = Number(ampm[1])
        const minute = Number(ampm[2] || 0)
        const meridiem = ampm[3].toUpperCase()
        if (meridiem === 'PM' && hour < 12) hour += 12
        if (meridiem === 'AM' && hour === 12) hour = 0
        const d = new Date(now)
        d.setHours(hour, minute, 0, 0)
        return d
    }
    const hhmm = text.match(/^(\d{1,2}):(\d{2})$/)
    if (hhmm) {
        const d = new Date(now)
        d.setHours(Number(hhmm[1]), Number(hhmm[2]), 0, 0)
        return d
    }
    return null
}

export function isScheduleTimeExpired(value, now = new Date()) {
    const at = parseScheduleTimeToday(value, now)
    if (!at) return false
    return now.getTime() >= at.getTime()
}

function stopPosition(row) {
    const lat = Number(row?.pickupLat ?? row?.startLat)
    const lng = Number(row?.pickupLng ?? row?.startLng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return null
    return [lat, lng]
}

function namesMatch(a, b) {
    const left = String(a || '').trim().toLowerCase()
    const right = String(b || '').trim().toLowerCase()
    if (!left || !right) return false
    return left === right || left.includes(right) || right.includes(left)
}

/**
 * Grade each route stop: pending → active (next up) → done (GPS crossed or schedule time passed).
 */
export function gradeRouteStops({
    stops = [],
    dutyType = 'Pickup',
    busPosition = null,
    schoolPosition = null,
    studentStopName = '',
    now = new Date(),
} = {}) {
    const isDrop = normalizeDutyType(dutyType) === 'Drop'
    const graded = (Array.isArray(stops) ? stops : []).map((row, index) => {
        const position = stopPosition(row)
        const name = row.startLocation || row.label || `Stop ${index + 1}`
        const scheduleTime = isDrop
            ? (row.dropTime || row.pickUpTime || '')
            : (row.pickUpTime || row.dropTime || '')
        const timeExpired = isScheduleTimeExpired(scheduleTime, now)
        const nearBus = Boolean(position && busPosition && haversineMeters(busPosition, position) <= STOP_ARRIVAL_RADIUS_M)
        let passedAlongRoute = false
        if (position && busPosition && schoolPosition) {
            const busToSchool = haversineMeters(busPosition, schoolPosition)
            const stopToSchool = haversineMeters(position, schoolPosition)
            if (isDrop) {
                // Leaving school toward homes — stop done once bus is farther from school than the stop.
                passedAlongRoute = busToSchool > stopToSchool + PASSED_ALONG_ROUTE_M
            } else {
                // Heading to school — stop done once bus is closer to school than the stop.
                passedAlongRoute = busToSchool < stopToSchool - PASSED_ALONG_ROUTE_M
            }
        }
        const done = timeExpired || nearBus || passedAlongRoute
        const reason = nearBus
            ? 'arrived'
            : passedAlongRoute
                ? 'passed'
                : timeExpired
                    ? 'time'
                    : ''
        return {
            index,
            position,
            name,
            scheduleTime,
            kind: isDrop ? 'drop' : 'pickup',
            label: isDrop ? `Drop ${index + 1}` : `Pickup ${index + 1}`,
            isStudentStop: namesMatch(name, studentStopName),
            status: done ? 'done' : 'pending',
            reason,
        }
    })

    const firstPending = graded.findIndex((row) => row.status !== 'done')
    return graded.map((row, index) => {
        if (row.status === 'done') return row
        if (index === firstPending) return { ...row, status: 'active' }
        return row
    })
}

/**
 * Build map polarity for an active duty.
 * @returns {{ tripMode, startLocation, endLocation, startPosition, endPosition, stopMarkers, labels, tripHeadline }}
 */
export function buildTripMapView({
    duty,
    route,
    assignment,
    schoolPosition,
    busPosition = null,
    now = new Date(),
}) {
    const dutyType = normalizeDutyType(duty?.dutyType || duty?.shift)
    const school = Array.isArray(schoolPosition) ? schoolPosition : null
    const schoolName = route?.endLocation || duty?.endLocation || 'Queen Mira International School'
    const stop = findStudentStop(route, assignment)
    const stopName = stop?.startLocation || assignment?.startLocation || assignment?.pickupLocation || 'Pickup'
    const stopPos = stopPosition(stop) || (() => {
        const lat = Number(assignment?.pickupLat ?? assignment?.startLat)
        const lng = Number(assignment?.pickupLng ?? assignment?.startLng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return null
        return [lat, lng]
    })()

    const stops = Array.isArray(route?.stops) ? route.stops : []
    // Keep every named stop — even before lat/lng resolve — so the checklist shows the full route.
    const stopMarkers = gradeRouteStops({
        stops,
        dutyType,
        busPosition,
        schoolPosition: school,
        studentStopName: stopName,
        now,
    }).filter((row) => row.name)

    if (dutyType === 'Drop') {
        return {
            tripMode: 'drop',
            startLocation: schoolName,
            startSubtitle: 'School Campus (start)',
            endLocation: stopName,
            endSubtitle: 'Your drop-off',
            startPosition: school,
            endPosition: stopPos,
            stopMarkers,
            tripHeadline: `Bus is on the move from ${schoolName}`,
            labels: {
                from: schoolName,
                to: stopName,
            },
        }
    }

    const routeStartName = stops[0]?.startLocation || stopName
    return {
        tripMode: 'pickup',
        startLocation: stopName,
        startSubtitle: 'Your pickup',
        endLocation: schoolName,
        endSubtitle: 'School Campus',
        startPosition: stopPos,
        endPosition: school,
        stopMarkers,
        tripHeadline: `Bus is on the move from ${routeStartName}`,
        labels: {
            from: stopName,
            to: schoolName,
        },
    }
}
