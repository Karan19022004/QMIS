import { getAssignmentsForTeacher } from '../RBAC/academicsCatalogData'
import { getActiveCreatedUserSession } from '../RBAC/createdUsersData'
import {
    getAllocationByEmployeeId,
    getAllocations,
    hydrateTeacherAllocationsFromApi,
    TEACHER_ALLOCATIONS_UPDATED_EVENT,
} from '../../Pages/Principal/TeacherAllocation/teacherAllocationData'
import {
    getClassTimetables,
    hydrateClassTimetablesFromApi,
    CLASS_TIMETABLES_UPDATED_EVENT,
} from '../../Pages/Principal/ClassTimetable/classTimetableData'
import { apiRequest, getAccessToken, isApiAuthEnabled } from '../../services/apiClient'
import { canUseAcademicsApi } from '../../services/academicsApi'

export const TEACHER_ASSIGNMENTS_UPDATED_EVENT = 'schoolerp-teacher-assignments-updated'

let cachedSelf = null
let hydratePromise = null

const emitUpdated = () => {
    try {
        window.dispatchEvent(new CustomEvent(TEACHER_ASSIGNMENTS_UPDATED_EVENT))
    } catch {
        /* ignore */
    }
}

/** Normalize "Grade 10" / "10" / "10-A" style labels for comparison. */
export const normalizeClassKey = (value) => {
    const text = String(value || '')
        .trim()
        .replace(/^class\s+/i, '')
        .replace(/\s+/g, ' ')
    if (!text || text === '—') return ''
    const gradeMatch = text.match(/^grade\s*(\d+[A-Z]?)$/i)
    if (gradeMatch) return `grade ${gradeMatch[1].toLowerCase()}`
    const bare = text.match(/^(\d+[A-Z]?)$/i)
    if (bare) return `grade ${bare[1].toLowerCase()}`
    return text.toLowerCase()
}

export const normalizeSectionKey = (value) => String(value || '').trim().toUpperCase()

export const classKeysMatch = (a, b) => {
    const left = normalizeClassKey(a)
    const right = normalizeClassKey(b)
    return Boolean(left && right && left === right)
}

/**
 * Resolve the logged-in teacher's HR employee code (allocation key).
 * Teachers can call GET /hr/portal/employees with hr.self — returns own row only.
 */
export const resolveOwnTeacherProfile = async () => {
    if (cachedSelf) return cachedSelf
    if (!isApiAuthEnabled() || !getAccessToken()) {
        const session = getActiveCreatedUserSession()
        cachedSelf = {
            employeeId: session?.staffCode || session?.employeeId || '',
            name: session?.name || '',
            email: String(session?.email || '').toLowerCase(),
            source: 'session',
        }
        return cachedSelf
    }
    try {
        const rows = await apiRequest('/hr/portal/employees')
        const list = Array.isArray(rows) ? rows : []
        const first = list[0]
        if (first) {
            cachedSelf = {
                employeeId: String(first.id || '').trim(),
                name: String(first.name || '').trim(),
                email: String(first.email || '').toLowerCase(),
                source: 'hr',
            }
            return cachedSelf
        }
    } catch {
        /* fall through */
    }
    const session = getActiveCreatedUserSession()
    cachedSelf = {
        employeeId: session?.staffCode || session?.employeeId || '',
        name: session?.name || '',
        email: String(session?.email || '').toLowerCase(),
        source: 'session',
    }
    return cachedSelf
}

export const clearTeacherAssignmentCache = () => {
    cachedSelf = null
    hydratePromise = null
}

export const getCachedTeacherProfile = () => cachedSelf

const rowsFromAllocation = (allocation) => {
    if (!allocation || allocation.status === 'Not Allocated') return []
    const fromMappings = (allocation.mappings || [])
        .filter((row) => row.className)
        .map((row) => ({
            className: String(row.className).trim(),
            section: String(row.section || '').trim(),
            subject: String(row.subject || '').trim(),
            isClassTeacher: Boolean(
                allocation.classTeacher &&
                    classKeysMatch(allocation.classTeacher.className, row.className) &&
                    normalizeSectionKey(allocation.classTeacher.section) === normalizeSectionKey(row.section),
            ),
            source: 'allocation',
        }))
    if (fromMappings.length) return fromMappings

    const teaching = Array.isArray(allocation.teachingClasses) ? allocation.teachingClasses : []
    const subjects = Array.isArray(allocation.subjects) ? allocation.subjects : []
    return teaching.map((className) => ({
        className: String(className).trim(),
        section: '',
        subject: subjects[0] || '',
        isClassTeacher: Boolean(
            allocation.classTeacher && classKeysMatch(allocation.classTeacher.className, className),
        ),
        source: 'allocation',
    }))
}

const rowsFromRbac = (email) =>
    getAssignmentsForTeacher(email).map((item) => ({
        className: String(item.className || '').trim(),
        section: String(item.section || '').trim(),
        subject: String(item.subject || '').trim(),
        isClassTeacher: String(item.classTeacher || '').toLowerCase() === 'yes',
        source: 'rbac',
    }))

/**
 * Find allocation for this teacher: by employeeId, else match name on any allocation
 * that was saved with a seed TEA-* id while the teacher has EMP-*.
 */
const findAllocationForTeacher = (profile) => {
    if (profile.employeeId) {
        const direct = getAllocationByEmployeeId(profile.employeeId)
        if (direct) return direct
    }
    const name = String(profile.name || '').trim().toLowerCase()
    if (!name) return null
    // Allocations don't store teacher name — only employeeId. Prefer directory match via id.
    return null
}

/** Assignment rows for the current teacher (allocation preferred, RBAC fallback). */
export const getTeacherAssignmentRows = (email = '') => {
    const profile = cachedSelf || {
        employeeId: '',
        name: '',
        email: String(email || '').toLowerCase(),
    }
    const allocation = findAllocationForTeacher(profile)
    const fromAlloc = rowsFromAllocation(allocation)
    if (fromAlloc.length) return fromAlloc

    // If employeeId is set but allocation missing, still try scanning all allocations
    // (campus list is readable with academics.read) in case id casing differs.
    if (profile.employeeId) {
        const match = getAllocations().find(
            (item) => String(item.employeeId).toLowerCase() === String(profile.employeeId).toLowerCase(),
        )
        const rows = rowsFromAllocation(match)
        if (rows.length) return rows
    }

    return rowsFromRbac(profile.email || email)
}

export const getTeacherClassOptions = (email = '') => {
    const classes = [
        ...new Set(getTeacherAssignmentRows(email).map((row) => row.className).filter(Boolean)),
    ]
    return classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export const getTeacherSectionOptions = (email = '', className = '') => {
    const rows = getTeacherAssignmentRows(email).filter(
        (row) => !className || classKeysMatch(row.className, className),
    )
    const sections = [...new Set(rows.map((row) => row.section).filter(Boolean))]
    return sections.length ? sections.sort() : ['A', 'B', 'C']
}

export const getTeacherSubjectOptions = (email = '') => {
    const subjects = [
        ...new Set(getTeacherAssignmentRows(email).map((row) => row.subject).filter(Boolean)),
    ]
    return subjects.sort((a, b) => a.localeCompare(b))
}

export const studentInTeacherScope = (student, email = '') => {
    const assignments = getTeacherAssignmentRows(email)
    if (!assignments.length) return false
    const className = student.className || student.class || student.class_name
    const section = student.section || student.classSection || student.class_section
    return assignments.some((row) => {
        if (!classKeysMatch(row.className, className)) return false
        if (!row.section) return true
        if (!section || section === '—' || section === 'All') return true
        return normalizeSectionKey(row.section) === normalizeSectionKey(section)
    })
}

/** Build weekly schedule cells from Principal class timetables for this teacher's name. */
export const getTeacherWeeklyScheduleFromTimetables = (teacherName = '') => {
    const name = String(teacherName || cachedSelf?.name || '').trim().toLowerCase()
    const timetables = getClassTimetables().filter(
        (item) => !item.approvalStatus || item.approvalStatus === 'Approved' || item.approvalStatus === 'Pending',
    )
    const schedule = {}
    const timeSlots = new Map()
    const days = new Set()

    timetables.forEach((tt) => {
        const ownerName = String(tt.ownerTeacherName || '').trim().toLowerCase()
        const ownedByTeacher = Boolean(name && ownerName && ownerName === name)
        ;(tt.timelines || []).forEach((row) => {
            const teacher = String(row.teacher || '').trim().toLowerCase()
            if (!ownedByTeacher) {
                if (name && teacher && teacher !== name) return
                if (!name && !teacher) return
            }
            if (!row.day || !row.startTime || !row.endTime || !row.subject) return
            const label = `${row.startTime} - ${row.endTime}`
            if (!timeSlots.has(label)) {
                timeSlots.set(label, {
                    label,
                    time: `${row.startTime} -\n${row.endTime}`,
                })
            }
            days.add(row.day)
            if (!schedule[label]) schedule[label] = {}
            const rowClass = row.className || tt.className || ''
            const rowSection = row.section || tt.section || ''
            schedule[label][row.day] = {
                subject: row.subject,
                className: `${String(rowClass).replace(/^Grade\s+/i, '')}${rowSection ? `-${rowSection}` : ''}`.replace(/-$/, ''),
            }
        })
    })

    return {
        timeSlots: [...timeSlots.values()],
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].filter((d) => days.has(d)),
        schedule,
        hasData: timeSlots.size > 0,
    }
}

export const hydrateTeacherPortalAssignments = async ({ force = false } = {}) => {
    if (!force && hydratePromise) return hydratePromise
    hydratePromise = (async () => {
        await resolveOwnTeacherProfile()
        if (canUseAcademicsApi()) {
            await Promise.all([hydrateTeacherAllocationsFromApi(), hydrateClassTimetablesFromApi()])
        }
        emitUpdated()
        return getTeacherAssignmentRows(cachedSelf?.email || '')
    })()
    try {
        return await hydratePromise
    } finally {
        hydratePromise = null
    }
}
