import { getStudentsList } from '../StudentDatabase/studentDatabaseData'
import {
    canUseAcademicsApi,
    listAcademicsCollectionApi,
    replaceAcademicsCollectionApi,
    stripAcademicsMeta,
} from '../../services/academicsApi'

export const MAX_STARS = 3

export const RATING_CATEGORY = 'Overall Performance'

export const SOY_MONTH_COUNT = 12

const COLLECTION = 'student-star-ratings'
const STORAGE_KEY = 'student-star-ratings-som'
export const SOM_RATINGS_UPDATED_EVENT = 'schoolerp-som-ratings-updated'

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

const getAcademicYearStartYear = (asOf = new Date()) => {
    const year = asOf.getFullYear()
    return asOf.getMonth() >= 5 ? year : year - 1
}

const buildAcademicYearLabel = (startYear) => `${startYear}-${startYear + 1}`

const buildAcademicYearMonths = (startYear) => {
    const months = []
    for (let offset = 0; offset < 12; offset += 1) {
        const monthIndex = (5 + offset) % 12
        const calendarYear = startYear + (5 + offset >= 12 ? 1 : 0)
        months.push(`${MONTH_NAMES[monthIndex]} ${calendarYear}`)
    }
    return months
}

const currentAyStart = getAcademicYearStartYear()

export const ACADEMIC_YEARS = [
    buildAcademicYearLabel(currentAyStart),
    buildAcademicYearLabel(currentAyStart - 1),
]

/** Full current + previous AY month labels (legacy helpers). */
export const ACADEMIC_YEAR_MONTHS = [
    ...buildAcademicYearMonths(currentAyStart - 1),
    ...buildAcademicYearMonths(currentAyStart),
]

export const parseSomMonthLabel = (monthLabel) => {
    const parts = String(monthLabel || '').trim().split(/\s+/)
    if (parts.length < 2) return null
    const year = Number(parts[parts.length - 1])
    const monthName = parts.slice(0, -1).join(' ')
    const monthIndex = MONTH_NAMES.indexOf(monthName)
    if (!Number.isFinite(year) || monthIndex < 0) return null
    return { year, monthIndex, monthName }
}

/** Current academic year months from June through the current calendar month (no future months). */
export const getEligibleSomMonths = (asOf = new Date()) => {
    const ayStart = getAcademicYearStartYear(asOf)
    const months = buildAcademicYearMonths(ayStart)
    const current = new Date(asOf.getFullYear(), asOf.getMonth(), 1)
    return months.filter((label) => {
        const parsed = parseSomMonthLabel(label)
        if (!parsed) return false
        const monthStart = new Date(parsed.year, parsed.monthIndex, 1)
        return monthStart.getTime() <= current.getTime()
    })
}

export const getDefaultSomMonth = (asOf = new Date()) => {
    const eligible = getEligibleSomMonths(asOf)
    const label = `${MONTH_NAMES[asOf.getMonth()]} ${asOf.getFullYear()}`
    if (eligible.includes(label)) return label
    return eligible[eligible.length - 1] || label
}

/** Month options for SOM add/filter: AY start → current month only. */
export const getSomMonthOptions = (asOf = new Date()) => getEligibleSomMonths(asOf)

/** @deprecated Use getSomMonthOptions / getEligibleSomMonths */
export const getAvailableSomMonths = () => {
    const months = [...new Set(readLocalRatings().map((item) => item.month))]
    const eligible = getEligibleSomMonths()
    return months
        .filter((month) => eligible.includes(month) || ACADEMIC_YEAR_MONTHS.includes(month))
        .sort((a, b) => ACADEMIC_YEAR_MONTHS.indexOf(a) - ACADEMIC_YEAR_MONTHS.indexOf(b))
}

/** Derive academic year label (June–May) from a SOM month label like "August 2026". */
export const academicYearFromMonthLabel = (monthLabel, fallback = ACADEMIC_YEARS[0]) => {
    const parsed = parseSomMonthLabel(monthLabel)
    if (!parsed) return fallback
    const startYear = parsed.monthIndex >= 5 ? parsed.year : parsed.year - 1
    return buildAcademicYearLabel(startYear)
}

export const getDefaultAcademicYear = (asOf = new Date()) =>
    buildAcademicYearLabel(getAcademicYearStartYear(asOf))

/** Normalize "2026-27", "2026/2027", "2026-2027" → "2026-2027". */
export const normalizeAcademicYearLabel = (value) => {
    const text = String(value || '').trim()
    const match = text.match(/(\d{4})\s*[-/]\s*(\d{2,4})/)
    if (!match) return text
    const start = Number(match[1])
    let end = Number(match[2])
    if (match[2].length === 2) end = Math.floor(start / 100) * 100 + end
    if (!Number.isFinite(start) || !Number.isFinite(end)) return text
    if (end < start) end = start + 1
    return `${start}-${end}`
}

export const ROUTE_BASE_BY_PREFIX = {
    teacher: '/teacher/star-ratings',
    coordinator: '/coordinator/star-ratings',
}

const buildSomRating = ({
    ratingId,
    month,
    academicYear,
    studentId,
    studentName,
    rollNumber,
    className,
    section,
    rating,
    description,
    ratedByRole = 'Teacher',
}) => ({
    id: ratingId,
    ratingId,
    month,
    academicYear,
    studentId: String(studentId),
    studentName,
    rollNumber,
    className,
    section,
    classSection: `${className}-${section}`,
    rating: Number(rating) || 0,
    description: description || '',
    ratedByRole,
})

const normalizeRating = (row) => {
    if (!row || typeof row !== 'object') return null
    const ratingId = String(row.ratingId || row.id || '').trim()
    if (!ratingId) return null
    const className = row.className || ''
    const section = row.section || ''
    return buildSomRating({
        ratingId,
        month: row.month || '',
        academicYear: row.academicYear || academicYearFromMonthLabel(row.month),
        studentId: row.studentId,
        studentName: row.studentName || '',
        rollNumber: row.rollNumber || '',
        className,
        section,
        rating: row.rating,
        description: row.description || '',
        ratedByRole: row.ratedByRole || 'Teacher',
    })
}

/** Normalize enrolled / list student → star-ratings row shape. */
export const mapStudentForStarRatings = (student) => {
    const className = student.className || student.class || ''
    const section = student.section || (student.classSection && student.classSection !== className ? student.classSection : '') || ''
    return {
        id: String(student.id),
        name: student.name || '',
        rollNumber: student.rollNumber || student.admissionNumber || '',
        className,
        section: section || 'A',
        classSection: section ? `${className}-${section}` : `${className}-A`,
    }
}

export const getStudents = (rows) => {
    const source = Array.isArray(rows) ? rows : getStudentsList()
    return source.map(mapStudentForStarRatings).filter((student) => student.className)
}

export const getClassSectionOptions = (rows) => {
    const sections = [...new Set(getStudents(rows).map((student) => student.classSection))]
    return sections.sort()
}

export const getStudentById = (studentId, rows) =>
    getStudents(rows).find((student) => student.id === studentId) ?? null

let apiMemory = null
let hydratePromise = null

const emitUpdated = () => {
    try {
        window.dispatchEvent(new CustomEvent(SOM_RATINGS_UPDATED_EVENT))
    } catch {
        /* ignore */
    }
}

const readLocalRatings = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) return parsed.map(normalizeRating).filter(Boolean)
        }
    } catch {
        /* ignore */
    }
    return []
}

const writeLocalRatings = (ratings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings))
}

const usesApiMemory = () => canUseAcademicsApi() && apiMemory !== null

export const getSomRatings = () => {
    if (usesApiMemory()) return apiMemory.map((item) => ({ ...item }))
    return readLocalRatings()
}

const persistRatings = async (ratings) => {
    const list = (Array.isArray(ratings) ? ratings : []).map(normalizeRating).filter(Boolean)
    if (canUseAcademicsApi()) {
        apiMemory = list
        const payload = list.map((row) => stripAcademicsMeta({ ...row, id: row.ratingId }))
        await replaceAcademicsCollectionApi(COLLECTION, payload)
        writeLocalRatings(list)
        emitUpdated()
        return list
    }
    writeLocalRatings(list)
    emitUpdated()
    return list
}

/** Load campus SOM ratings from GET /academics/student-star-ratings. */
export async function hydrateSomRatingsFromApi({ force = false } = {}) {
    if (!canUseAcademicsApi()) {
        apiMemory = null
        return getSomRatings()
    }
    if (hydratePromise && !force) return hydratePromise
    hydratePromise = listAcademicsCollectionApi(COLLECTION)
        .then((rows) => {
            const list = (Array.isArray(rows) ? rows : []).map(normalizeRating).filter(Boolean)
            apiMemory = list
            writeLocalRatings(list)
            emitUpdated()
            return list
        })
        .catch(() => {
            // Keep any local cache so a transient failure does not wipe teacher work.
            if (apiMemory == null) apiMemory = readLocalRatings()
            return apiMemory
        })
        .finally(() => {
            hydratePromise = null
        })
    return hydratePromise
}

export const addSomRating = async (payload) => {
    if (canUseAcademicsApi()) {
        await hydrateSomRatingsFromApi()
    }
    const list = getSomRatings()
    const month = String(payload.month || '').trim()
    const studentId = String(payload.studentId || '')
    const academicYear = normalizeAcademicYearLabel(
        payload.academicYear ?? academicYearFromMonthLabel(month),
    )

    const existingIndex = list.findIndex(
        (item) => String(item.studentId) === studentId && item.month === month,
    )

    let record
    if (existingIndex >= 0) {
        record = buildSomRating({
            ratingId: list[existingIndex].ratingId,
            month,
            academicYear,
            studentId,
            studentName: payload.studentName,
            rollNumber: payload.rollNumber,
            className: payload.className,
            section: payload.section,
            rating: payload.rating,
            description: payload.description,
            ratedByRole: payload.ratedByRole ?? 'Teacher',
        })
        const next = [...list]
        next[existingIndex] = record
        await persistRatings(next)
        return record
    }

    const maxId = list.reduce((max, item) => {
        const num = parseInt(String(item.ratingId).replace(/^SSR-?/i, ''), 10)
        return Number.isNaN(num) ? max : Math.max(max, num)
    }, 0)
    const ratingId = `SSR-${String(maxId + 1).padStart(3, '0')}`
    record = buildSomRating({
        ratingId,
        month,
        academicYear,
        studentId,
        studentName: payload.studentName,
        rollNumber: payload.rollNumber,
        className: payload.className,
        section: payload.section,
        rating: payload.rating,
        description: payload.description,
        ratedByRole: payload.ratedByRole ?? 'Teacher',
    })
    await persistRatings([...list, record])
    return record
}

export const getSomRatingsByMonth = (month) =>
    getSomRatings().filter((item) => item.month === month)

/** Match a rating row to a portal student (id first, then roll / name + class). */
export const ratingMatchesStudent = (rating, student) => {
    if (!rating || !student) return false
    const ratingId = String(rating.studentId || '').trim()
    const studentId = String(student.id || '').trim()
    if (ratingId && studentId && ratingId === studentId) return true

    const ratingRoll = String(rating.rollNumber || '').trim().toLowerCase()
    const studentRoll = String(student.rollNumber || student.admissionNumber || '').trim().toLowerCase()
    if (ratingRoll && studentRoll && ratingRoll === studentRoll) return true

    const ratingName = String(rating.studentName || '').trim().toLowerCase()
    const studentName = String(student.name || '').trim().toLowerCase()
    if (!ratingName || !studentName || ratingName !== studentName) return false

    const ratingClass = String(rating.className || '').trim().toLowerCase()
    const studentClass = String(student.className || student.class || '').trim().toLowerCase()
    if (ratingClass && studentClass && ratingClass !== studentClass) return false

    const ratingSection = String(rating.section || '').trim().toUpperCase()
    const studentSection = String(student.section || '').trim().toUpperCase()
    if (ratingSection && studentSection && ratingSection !== studentSection) return false

    return true
}

export const getSomRatingsForStudent = (student) =>
    getSomRatings().filter((item) => ratingMatchesStudent(item, student))

export const getSoyRatingForStudent = (student, academicYear) => {
    const consolidated = getConsolidatedSoyRatings(academicYear)
    return consolidated.find((item) => ratingMatchesStudent(item, student)) ?? null
}

export const getStarOfMonth = (month) => {
    const monthRatings = getSomRatingsByMonth(month)
    if (!monthRatings.length) return null
    return monthRatings.reduce((best, current) =>
        current.rating > best.rating ? current : best,
    )
}

export const getConsolidatedSoyRatings = (academicYear = '2025-2026') => {
    const targetYear = normalizeAcademicYearLabel(academicYear)
    const yearRatings = getSomRatings().filter(
        (item) => normalizeAcademicYearLabel(item.academicYear) === targetYear,
    )
    const grouped = yearRatings.reduce((acc, item) => {
        if (!acc[item.studentId]) {
            acc[item.studentId] = {
                studentId: item.studentId,
                studentName: item.studentName,
                rollNumber: item.rollNumber,
                className: item.className,
                section: item.section,
                classSection: item.classSection,
                academicYear,
                monthlyRatings: [],
            }
        }
        acc[item.studentId].monthlyRatings.push({ month: item.month, rating: item.rating })
        return acc
    }, {})

    return Object.values(grouped)
        .map((entry) => {
            const total = entry.monthlyRatings.reduce((sum, item) => sum + item.rating, 0)
            const monthsRated = entry.monthlyRatings.length
            const averageRating = monthsRated ? total / monthsRated : 0
            return {
                ...entry,
                monthsRated,
                averageRating: Number(averageRating.toFixed(2)),
                annualRating: Math.round(averageRating),
            }
        })
        .sort((a, b) => b.averageRating - a.averageRating)
}

export const getStarOfYear = (academicYear = '2025-2026') => {
    const consolidated = getConsolidatedSoyRatings(academicYear)
    return consolidated[0] ?? null
}

export const getRouteBaseFromPath = (pathname) => {
    if (pathname.startsWith('/coordinator')) return ROUTE_BASE_BY_PREFIX.coordinator
    return ROUTE_BASE_BY_PREFIX.teacher
}
