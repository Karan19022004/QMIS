/**
 * Staff Star of the Month / Year — shared browser SoT (localStorage).
 * Employee pickers load from HR / communication directory (not demo lists).
 * Not a REST ratings domain yet; do not claim live multi-user persistence.
 */

import { getAccessToken, isApiAuthEnabled } from '../../../services/apiClient'
import { canUseEmployeeDirectoryApi, loadEmployeeDirectory } from '../../../services/employeeDirectoryApi'
import { listDirectoryApi } from '../../../services/communicationApi'

export const MAX_STARS = 3

export const RATING_CATEGORY = 'Overall Performance'

/** Full academic year June → May (12 months). */
export const SOY_MONTH_COUNT = 12

/** Bumped so previous seed demos in localStorage are not reused. */
export const STORAGE_KEY = 'director-staff-star-ratings-v2'

export const EMPLOYEE_TYPE_OPTIONS = [
    { value: 'teacher', label: 'Teacher' },
    { value: 'coordinator', label: 'Co-ordinator' },
]

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

/** Academic year starts in June (0-indexed month 5). */
export const getAcademicYearStartYear = (asOf = new Date()) => {
    const year = asOf.getFullYear()
    return asOf.getMonth() >= 5 ? year : year - 1
}

export const buildAcademicYearLabel = (startYear) => `${startYear}-${startYear + 1}`

/** June (startYear) through May (startYear + 1). */
export const buildAcademicYearMonths = (startYear) => {
    const months = []
    for (let offset = 0; offset < 12; offset += 1) {
        const monthIndex = (5 + offset) % 12
        const calendarYear = startYear + (5 + offset >= 12 ? 1 : 0)
        months.push(`${MONTH_NAMES[monthIndex]} ${calendarYear}`)
    }
    return months
}

const currentAyStart = getAcademicYearStartYear()

/** Current + previous academic years for filters. */
export const ACADEMIC_YEARS = [
    buildAcademicYearLabel(currentAyStart),
    buildAcademicYearLabel(currentAyStart - 1),
]

/** Month picker: previous AY + current AY (24 months, June→May each). */
export const ACADEMIC_YEAR_MONTHS = [
    ...buildAcademicYearMonths(currentAyStart - 1),
    ...buildAcademicYearMonths(currentAyStart),
]

/** Prefer today's month in the Add form when it falls in the academic calendar. */
export const getDefaultSomMonth = (asOf = new Date()) => {
    const label = `${MONTH_NAMES[asOf.getMonth()]} ${asOf.getFullYear()}`
    if (ACADEMIC_YEAR_MONTHS.includes(label)) return label
    return ACADEMIC_YEAR_MONTHS[ACADEMIC_YEAR_MONTHS.length - 1] || label
}

/** @deprecated Use loadStaffEmployeesByType() */
export const TEACHER_OPTIONS = []
/** @deprecated Use loadStaffEmployeesByType() */
export const COORDINATOR_OPTIONS = []

const roleMatchesType = (role, employeeType) => {
    const text = String(role || '').toLowerCase()
    if (employeeType === 'coordinator') {
        return text.includes('coord')
    }
    return text.includes('teacher')
}

const mapStaffOption = (row) => ({
    id: String(row.employeeId || row.id || row.email || ''),
    name: row.name || row.email || 'Staff',
    department: String(row.department || '').replace(/^—$/, '') || '',
    email: row.email || '',
    role: row.role || '',
})

/** Live Teacher / Co-ordinator options for Star of the Month Add form. */
export async function loadStaffEmployeesByType(employeeType = 'teacher') {
    const want = employeeType === 'coordinator' ? 'coordinator' : 'teacher'

    if (canUseEmployeeDirectoryApi()) {
        try {
            const { records } = await loadEmployeeDirectory()
            const rows = (records || [])
                .map((item) => item.row)
                .filter((row) => row && roleMatchesType(row.role, want))
                .map(mapStaffOption)
                .filter((row) => row.id && row.name)
                .sort((a, b) => a.name.localeCompare(b.name))
            if (rows.length) return rows
        } catch {
            /* fall through */
        }
    }

    if (!(isApiAuthEnabled() && getAccessToken())) return []

    try {
        const people = await listDirectoryApi()
        return (Array.isArray(people) ? people : [])
            .filter((person) => roleMatchesType(person.role, want))
            .map(mapStaffOption)
            .filter((row) => row.id && row.name)
            .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
        return []
    }
}

const buildSomRating = ({
    ratingId,
    month,
    academicYear,
    employeeType,
    employeeId,
    employeeName,
    department,
    rating,
    description,
}) => ({
    ratingId,
    month,
    academicYear,
    employeeType,
    employeeId,
    employeeName,
    department,
    rating,
    description,
})

/** Seed rows used only when localStorage is empty (first visit). */
export const SEED_SOM_RATINGS = [
    buildSomRating({ ratingId: 'SOM-001', month: 'June 2025', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1001', employeeName: 'Mr. Ravi Kumar', department: 'Mathematics', rating: 3, description: 'Outstanding classroom delivery and student outcomes.' }),
    buildSomRating({ ratingId: 'SOM-002', month: 'June 2025', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1002', employeeName: 'Ms. Anitha Verma', department: 'English', rating: 2, description: 'Good engagement; consistent assignment follow-up.' }),
    buildSomRating({ ratingId: 'SOM-003', month: 'June 2025', academicYear: '2025-2026', employeeType: 'coordinator', employeeId: 'COO-1001', employeeName: 'Sandy Selva', department: 'Science', rating: 3, description: 'Excellent department coordination.' }),
    buildSomRating({ ratingId: 'SOM-004', month: 'July 2025', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1001', employeeName: 'Mr. Ravi Kumar', department: 'Mathematics', rating: 3, description: 'Maintained high teaching standards.' }),
    buildSomRating({ ratingId: 'SOM-005', month: 'July 2025', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1003', employeeName: 'Rajesh Kumar', department: 'Science', rating: 2, description: 'Solid lab sessions and student support.' }),
    buildSomRating({ ratingId: 'SOM-006', month: 'July 2025', academicYear: '2025-2026', employeeType: 'coordinator', employeeId: 'COO-1002', employeeName: 'John Milton', department: 'Mathematics', rating: 2, description: 'Effective exam scheduling support.' }),
    buildSomRating({ ratingId: 'SOM-007', month: 'August 2025', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1002', employeeName: 'Ms. Anitha Verma', department: 'English', rating: 3, description: 'Exceptional literary club leadership.' }),
    buildSomRating({ ratingId: 'SOM-008', month: 'August 2025', academicYear: '2025-2026', employeeType: 'coordinator', employeeId: 'COO-1001', employeeName: 'Sandy Selva', department: 'Science', rating: 2, description: 'Good inter-department liaison.' }),
    buildSomRating({ ratingId: 'SOM-009', month: 'September 2025', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1001', employeeName: 'Mr. Ravi Kumar', department: 'Mathematics', rating: 2, description: 'Strong term assessment preparation.' }),
    buildSomRating({ ratingId: 'SOM-010', month: 'September 2025', academicYear: '2025-2026', employeeType: 'coordinator', employeeId: 'COO-1003', employeeName: 'Priya Nair', department: 'English', rating: 3, description: 'Proactive curriculum alignment.' }),
    buildSomRating({ ratingId: 'SOM-011', month: 'October 2025', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1003', employeeName: 'Rajesh Kumar', department: 'Science', rating: 3, description: 'Science fair coordination excellence.' }),
    buildSomRating({ ratingId: 'SOM-012', month: 'November 2025', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1001', employeeName: 'Mr. Ravi Kumar', department: 'Mathematics', rating: 3, description: 'Top performer for mid-year review.' }),
    buildSomRating({ ratingId: 'SOM-013', month: 'December 2025', academicYear: '2025-2026', employeeType: 'coordinator', employeeId: 'COO-1001', employeeName: 'Sandy Selva', department: 'Science', rating: 3, description: 'Holiday event planning executed well.' }),
    buildSomRating({ ratingId: 'SOM-014', month: 'January 2026', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1002', employeeName: 'Ms. Anitha Verma', department: 'English', rating: 2, description: 'Steady progress in board prep classes.' }),
    buildSomRating({ ratingId: 'SOM-015', month: 'February 2026', academicYear: '2025-2026', employeeType: 'teacher', employeeId: 'TEA-1001', employeeName: 'Mr. Ravi Kumar', department: 'Mathematics', rating: 3, description: 'Consistent excellence through Term 2.' }),
    buildSomRating({ ratingId: 'SOM-016', month: 'March 2026', academicYear: '2025-2026', employeeType: 'coordinator', employeeId: 'COO-1001', employeeName: 'Sandy Selva', department: 'Science', rating: 3, description: 'Year-end department review leadership.' }),
]

/** @deprecated use getSomRatings() — kept for any leftover imports */
export const MOCK_SOM_RATINGS = SEED_SOM_RATINGS

export const saveSomRatings = (items) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export const getSomRatings = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) return parsed
        }
    } catch {
        /* ignore corrupt cache */
    }
    // Do not auto-seed demo ratings — start empty until Principal/Director add real ones.
    return []
}

export const nextSomRatingId = (items = getSomRatings()) => {
    let max = 0
    items.forEach((row) => {
        const match = String(row.ratingId || '').match(/SOM-(\d+)/i)
        if (match) max = Math.max(max, Number(match[1]))
    })
    return `SOM-${String(max + 1).padStart(3, '0')}`
}

export const addSomRating = ({
    month,
    academicYear = ACADEMIC_YEARS[0],
    employeeType,
    employeeId,
    employeeName,
    department,
    rating,
    description,
}) => {
    const items = getSomRatings()
    const row = buildSomRating({
        ratingId: nextSomRatingId(items),
        month,
        academicYear,
        employeeType,
        employeeId,
        employeeName,
        department,
        rating: Number(rating) || 0,
        description: description || '',
    })
    const next = [row, ...items]
    saveSomRatings(next)
    return row
}

export const getEmployeeTypeLabel = (type) =>
    EMPLOYEE_TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type

export const getAvailableSomMonths = () => {
    const months = [...new Set(getSomRatings().map((item) => item.month))]
    const order = ACADEMIC_YEAR_MONTHS
    return months.sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

export const getSomRatingsByMonth = (month) =>
    getSomRatings().filter((item) => item.month === month)

export const getStarOfMonth = (month) => {
    const monthRatings = getSomRatingsByMonth(month)
    if (!monthRatings.length) return null
    return monthRatings.reduce((best, current) =>
        current.rating > best.rating ? current : best,
    )
}

export const getConsolidatedSoyRatings = (academicYear = ACADEMIC_YEARS[0]) => {
    const yearRatings = getSomRatings().filter((item) => item.academicYear === academicYear)
    const grouped = yearRatings.reduce((acc, item) => {
        if (!acc[item.employeeId]) {
            acc[item.employeeId] = {
                employeeId: item.employeeId,
                employeeName: item.employeeName,
                employeeType: item.employeeType,
                department: item.department,
                academicYear,
                monthlyRatings: [],
            }
        }
        acc[item.employeeId].monthlyRatings.push({ month: item.month, rating: item.rating })
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

export const getStarOfYear = (academicYear = ACADEMIC_YEARS[0]) => {
    const consolidated = getConsolidatedSoyRatings(academicYear)
    return consolidated[0] ?? null
}

/** Offline / empty fallback — prefer loadStaffEmployeesByType in UI. */
export const getEmployeesByType = (employeeType) =>
    employeeType === 'coordinator' ? COORDINATOR_OPTIONS : TEACHER_OPTIONS
