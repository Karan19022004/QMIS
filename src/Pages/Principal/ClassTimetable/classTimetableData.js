import {
    getClasses as getCatalogClasses,
    getSections as getCatalogSections,
    getSubjects as getCatalogSubjects,
} from '../../../Common/RBAC/academicsCatalogData'
import {
    canUseAcademicsApi,
    listAcademicsCollectionApi,
    replaceAcademicsCollectionApi,
    stripAcademicsMeta,
} from '../../../services/academicsApi'
import { getAccessToken, isApiAuthEnabled } from '../../../services/apiClient'
import { listDirectoryApi } from '../../../services/communicationApi'
import {
    getAllocationByEmployeeId,
    getTeachers,
    hydrateTeacherAllocationsFromApi,
    hydrateTeachersFromDirectory,
    isUsingDemoTeacherRoster,
} from '../TeacherAllocation/teacherAllocationData'

export const STORAGE_KEY = 'principal-class-timetables'
export const CHANGE_KEY = 'principal-class-timetable-change-requests'
export const CLASS_TIMETABLES_UPDATED_EVENT = 'schoolerp-class-timetables-updated'

export const ROUTE_BASE = '/principal/class-timetable'
export const CREATE_ROUTE = '/principal/create-class-timetable'
export const COORDINATOR_ROUTE_BASE = '/coordinator/class/class-timetable'
export const COORDINATOR_CREATE_ROUTE = '/coordinator/class/create-class-timetable'

export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Denied']

export const TERMS = ['Term 1', 'Term 2', 'Term 3']
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Live catalog helpers (empty until Class Details / subjects exist). */
export const getGradeOptions = () => {
    const classes = getCatalogClasses()
    return classes.length ? classes : []
}
export const getSectionOptions = () => {
    const sections = getCatalogSections()
    return sections.length ? sections : ['A', 'B', 'C', 'D']
}
export const getSubjectOptions = () => getCatalogSubjects()

/** @deprecated Prefer getGradeOptions / getSectionOptions / getSubjectOptions */
export const GRADES = []
export const SECTIONS = ['A', 'B', 'C', 'D']
export const SUBJECTS = []
export const TEACHERS = []

export const getTimetableRoutes = (pathname = '') => {
    if (String(pathname).startsWith('/coordinator')) {
        return { listPath: COORDINATOR_ROUTE_BASE, createPath: COORDINATOR_CREATE_ROUTE }
    }
    return { listPath: ROUTE_BASE, createPath: CREATE_ROUTE }
}

const classKeysMatch = (left, right) => {
    const normalize = (value) => String(value || '').trim().toLowerCase().replace(/^grade\s+/, '')
    return normalize(left) === normalize(right)
}

/** Subjects allocated to a teacher (optionally narrowed by class / section mappings). */
export const getSubjectsForTimetableTeacher = (employeeId, className = '', section = '') => {
    if (!employeeId) return []
    const allocation = getAllocationByEmployeeId(employeeId)
    if (!allocation) return []

    const mappings = Array.isArray(allocation.mappings) ? allocation.mappings : []
    if (className) {
        const mapped = mappings
            .filter((item) => classKeysMatch(item.className, className))
            .filter((item) => !section || !item.section || String(item.section) === String(section))
            .map((item) => item.subject)
            .filter(Boolean)
        if (mapped.length) return [...new Set(mapped)].sort((a, b) => a.localeCompare(b))
    }

    const subjects = Array.isArray(allocation.subjects) ? allocation.subjects.filter(Boolean) : []
    if (subjects.length) return [...new Set(subjects)].sort((a, b) => a.localeCompare(b))

    return [...new Set(mappings.map((item) => item.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

/** Teaching classes allocated to a teacher. */
export const getClassesForTimetableTeacher = (employeeId) => {
    if (!employeeId) return getGradeOptions()
    const allocation = getAllocationByEmployeeId(employeeId)
    const teaching = Array.isArray(allocation?.teachingClasses) ? allocation.teachingClasses.filter(Boolean) : []
    if (teaching.length) return [...new Set(teaching)].sort((a, b) => a.localeCompare(b))
    const fromMaps = (allocation?.mappings || []).map((item) => item.className).filter(Boolean)
    if (fromMaps.length) return [...new Set(fromMaps)].sort((a, b) => a.localeCompare(b))
    return getGradeOptions()
}

/** Sections mapped for a teacher + class (from allocation mappings). */
export const getSectionsForTimetableTeacher = (employeeId, className = '') => {
    if (!employeeId || !className) return []
    const allocation = getAllocationByEmployeeId(employeeId)
    const mappings = Array.isArray(allocation?.mappings) ? allocation.mappings : []
    const sections = mappings
        .filter((item) => classKeysMatch(item.className, className))
        .map((item) => item.section)
        .filter(Boolean)
    if (sections.length) return [...new Set(sections)].sort((a, b) => a.localeCompare(b))
    // Class allocated without section detail — fall back to catalog sections.
    return getSectionOptions()
}

/** Apply class selection on a timeline row: map section + subject from teacher allocation. */
export const applyClassToTimelineRow = (row, employeeId, className, teacherName = '') => {
    const sections = getSectionsForTimetableTeacher(employeeId, className)
    const section = sections.length === 1 ? sections[0] : (sections.includes(row.section) ? row.section : '')
    const subjects = getSubjectsForTimetableTeacher(employeeId, className, section)
    const subject = subjects.length === 1
        ? subjects[0]
        : (subjects.includes(row.subject) ? row.subject : '')
    return {
        ...row,
        className: className || '',
        section,
        subject,
        teacher: teacherName || row.teacher,
    }
}

/** Active campus teachers for the owner picker (HR directory, else communication directory). */
export async function loadClassTimetableTeacherOptions() {
    try {
        await hydrateTeacherAllocationsFromApi()
    } catch {
        /* ignore */
    }
    try {
        await hydrateTeachersFromDirectory({ force: true })
        if (!isUsingDemoTeacherRoster()) {
            return getTeachers()
                .filter((item) => item.employeeId && item.name)
                .map((item) => ({
                    employeeId: String(item.employeeId),
                    name: item.name,
                    email: item.email || '',
                }))
                .sort((a, b) => a.name.localeCompare(b.name))
        }
    } catch {
        /* fall through */
    }

    if (!(isApiAuthEnabled() && getAccessToken())) return []

    try {
        const people = await listDirectoryApi()
        return (Array.isArray(people) ? people : [])
            .filter((person) => {
                const role = String(person.role || '').toLowerCase()
                return role === 'teacher' || role === 'coordinator'
            })
            .map((person) => ({
                employeeId: String(person.employeeId || person.id),
                name: person.name || person.email || 'Staff',
                email: person.email || '',
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
        return []
    }
}

export const approvalStatusColor = {
    Approved: 'text-[#4CAF50] border-[#4CAF5033] bg-[#4CAF5014]',
    Pending: 'text-[#FF9800] border-[#FF980033] bg-[#FF980014]',
    Denied: 'text-[#980E0F] border-[#980E0F33] bg-[#980E0F14]',
}

export const createTimelineRow = () => ({
    id: `TL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    periodNumber: '',
    day: '',
    className: '',
    section: '',
    subject: '',
    teacher: '',
    startTime: '',
    endTime: '',
})

export const defaultClassTimetableForm = () => ({
    timetableId: '',
    academicYear: '',
    term: '',
    ownerTeacherId: '',
    ownerTeacherName: '',
    ownerTeacherEmail: '',
    timelines: [createTimelineRow()],
})

const DEFAULT_CLASS_TIMETABLES = []

let apiMemoryTimetables = null
let apiMemoryChanges = null

const usesApiMemory = () => canUseAcademicsApi()

const emitUpdated = () => {
    try {
        window.dispatchEvent(new CustomEvent(CLASS_TIMETABLES_UPDATED_EVENT))
    } catch {
        /* ignore */
    }
}

const purgeBrowserCopies = () => {
    try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(CHANGE_KEY)
        sessionStorage.removeItem(STORAGE_KEY)
        sessionStorage.removeItem(CHANGE_KEY)
    } catch {
        /* ignore */
    }
}

export const clearClassTimetableMemory = () => {
    apiMemoryTimetables = null
    apiMemoryChanges = null
    emitUpdated()
}

const cleanList = (rows) => (Array.isArray(rows) ? rows.map(stripAcademicsMeta) : [])

const pushTimetables = (rows) => {
    if (!usesApiMemory()) return
    replaceAcademicsCollectionApi('class-timetables', cleanList(rows)).catch(() => {})
}

const pushChanges = (rows) => {
    if (!usesApiMemory()) return
    replaceAcademicsCollectionApi('class-timetable-change-requests', cleanList(rows)).catch(() => {})
}

export const hydrateClassTimetablesFromApi = async () => {
    if (!canUseAcademicsApi()) return false
    try {
        const [tts, changes] = await Promise.all([
            listAcademicsCollectionApi('class-timetables'),
            listAcademicsCollectionApi('class-timetable-change-requests'),
        ])
        apiMemoryTimetables = cleanList(tts)
        apiMemoryChanges = cleanList(changes)
        purgeBrowserCopies()
        emitUpdated()
        return true
    } catch {
        apiMemoryTimetables = []
        apiMemoryChanges = []
        emitUpdated()
        return false
    }
}

export const getClassTimetables = () => {
    if (usesApiMemory()) {
        return Array.isArray(apiMemoryTimetables) ? [...apiMemoryTimetables] : []
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) return JSON.parse(stored)
    } catch {
        /* ignore */
    }
    return [...DEFAULT_CLASS_TIMETABLES]
}

export const saveClassTimetables = (records) => {
    const list = Array.isArray(records) ? records : []
    if (usesApiMemory()) {
        apiMemoryTimetables = list
        pushTimetables(list)
        emitUpdated()
        return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export const getClassTimetableById = (id) =>
    getClassTimetables().find((item) => item.id === id) ?? null

export const generateTimetableId = () => {
    const list = getClassTimetables()
    const max = list.reduce((acc, item) => {
        const num = Number(String(item.id).replace('CTT', ''))
        return Number.isFinite(num) ? Math.max(acc, num) : acc
    }, 0)
    return `CTT${String(max + 1).padStart(3, '0')}`
}

export const formatSubmittedDate = () =>
    new Date().toLocaleDateString('en-GB').replace(/\//g, '-')

export const addClassTimetable = (payload) => {
    const ownerName = payload.ownerTeacherName || ''
    const timelines = (payload.timelines || [])
        .filter((row) => row.day && row.subject && row.className && row.section)
        .map((row) => ({
            ...row,
            teacher: row.teacher || ownerName,
        }))
    const first = timelines[0] || {}
    const record = {
        id: payload.timetableId || generateTimetableId(),
        // Summary fields for list filters (first period); full detail is on each timeline row.
        className: first.className || '',
        section: first.section || '',
        academicYear: payload.academicYear,
        term: payload.term,
        ownerTeacherId: payload.ownerTeacherId || '',
        ownerTeacherName: ownerName,
        ownerTeacherEmail: payload.ownerTeacherEmail || '',
        createdByRole: payload.createdByRole || 'Principal',
        submittedDate: formatSubmittedDate(),
        approvalStatus: 'Pending',
        timelines,
    }
    saveClassTimetables([record, ...getClassTimetables()])
    return record
}

export const buildClassGridFromTimelines = (timelines = []) => {
    const days = [...new Set(timelines.map((row) => row.day).filter(Boolean))]
    const slotMap = new Map()

    timelines.forEach((row) => {
        if (!row.day || !row.startTime || !row.endTime) return
        const label = `${row.startTime} - ${row.endTime}`
        if (!slotMap.has(label)) {
            slotMap.set(label, {
                label,
                time: `${row.startTime} -\n${row.endTime}`,
            })
        }
    })

    const timeSlots = [...slotMap.values()]
    const schedule = {}

    timelines.forEach((row) => {
        if (!row.day || !row.startTime || !row.endTime || !row.subject) return
        const label = `${row.startTime} - ${row.endTime}`
        if (!schedule[label]) schedule[label] = {}
        const classLabel = row.className
            ? `${String(row.className).replace(/^Grade\s+/i, '')}${row.section ? `-${row.section}` : ''}`
            : ''
        schedule[label][row.day] = {
            subject: classLabel ? `${row.subject} (${classLabel})` : row.subject,
            teacher: row.teacher || '—',
        }
    })

    return {
        days: days.length ? days : DAYS.slice(0, 5),
        timeSlots: timeSlots.length ? timeSlots : [{ time: '—', label: '—' }],
        schedule,
    }
}

export const getClassSectionLabel = (record) => {
    const fromRows = [...new Set(
        (record?.timelines || [])
            .filter((row) => row.className)
            .map((row) => `${row.className}${row.section ? ` - ${row.section}` : ''}`),
    )]
    if (fromRows.length) return fromRows.join(', ')
    if (record?.className) return `${record.className}${record.section ? ` - ${record.section}` : ''}`
    return '—'
}

const readChangesLocal = () => {
    try {
        const stored = localStorage.getItem(CHANGE_KEY)
        if (stored) return JSON.parse(stored)
    } catch {
        /* ignore */
    }
    return []
}

export const getTimetableChangeRequests = () => {
    if (usesApiMemory()) {
        return Array.isArray(apiMemoryChanges) ? [...apiMemoryChanges] : []
    }
    return readChangesLocal()
}

const saveChanges = (items) => {
    const list = Array.isArray(items) ? items : []
    if (usesApiMemory()) {
        apiMemoryChanges = list
        pushChanges(list)
        emitUpdated()
        return
    }
    localStorage.setItem(CHANGE_KEY, JSON.stringify(list))
}

export const addTimetableChangeRequest = (payload) => {
    const items = getTimetableChangeRequests()
    const record = {
        id: `TCR-${Date.now()}`,
        timetableId: payload.timetableId || '',
        className: payload.className,
        section: payload.section,
        day: payload.day,
        periodNumber: payload.periodNumber || '',
        currentSubject: payload.currentSubject || '',
        requestedSubject: payload.requestedSubject,
        requestedTeacher: payload.requestedTeacher || '',
        reason: payload.reason,
        requestedBy: payload.requestedBy,
        requestedByRole: payload.requestedByRole,
        status: 'Pending',
        reviewedBy: '',
        reviewedAt: '',
        rejectionReason: '',
    }
    saveChanges([record, ...items])
    return record
}

const applyChangeToTimetable = (request) => {
    const timetables = getClassTimetables()
    const match = timetables.find((item) => (
        item.id === request.timetableId
        || (item.className === request.className && item.section === request.section)
    ))
    const row = {
        id: `TL-${Date.now()}`,
        periodNumber: request.periodNumber || '1',
        day: request.day,
        subject: request.requestedSubject,
        teacher: request.requestedTeacher || '—',
        startTime: '09:00',
        endTime: '09:45',
    }
    if (!match) {
        addClassTimetable({
            className: request.className,
            section: request.section,
            academicYear: '2025-2026',
            term: 'Term 1',
            timelines: [row],
        })
        const created = getClassTimetables()[0]
        if (created) {
            saveClassTimetables(getClassTimetables().map((item) => (
                item.id === created.id ? { ...item, approvalStatus: 'Approved' } : item
            )))
        }
        return
    }
    const timelines = match.timelines.map((item) => (
        item.day === request.day && (!request.periodNumber || item.periodNumber === request.periodNumber)
            ? { ...item, subject: request.requestedSubject, teacher: request.requestedTeacher || item.teacher }
            : item
    ))
    const changed = timelines.some((item, index) => item !== match.timelines[index])
    saveClassTimetables(timetables.map((item) => (
        item.id === match.id
            ? { ...item, timelines: changed ? timelines : [...timelines, row], approvalStatus: 'Approved' }
            : item
    )))
}

/** Principal decides a submitted class timetable (Approve / Deny). */
export const decideClassTimetableApproval = (id, approvalStatus, reviewer = 'Principal', rejectionReason = '') => {
    const nextStatus = approvalStatus === 'Approved' ? 'Approved' : 'Denied'
    const list = getClassTimetables()
    const target = list.find((item) => item.id === id)
    if (!target || target.approvalStatus !== 'Pending') return null
    const updated = {
        ...target,
        approvalStatus: nextStatus,
        reviewedBy: reviewer,
        reviewedAt: new Date().toISOString(),
        rejectionReason: nextStatus === 'Denied' ? rejectionReason : '',
    }
    saveClassTimetables(list.map((item) => (item.id === id ? updated : item)))
    return updated
}

export const decideTimetableChangeRequest = (id, approved, reviewer, rejectionReason = '') => {
    const items = getTimetableChangeRequests()
    const target = items.find((item) => item.id === id)
    if (!target || target.status !== 'Pending') return items
    if (approved) applyChangeToTimetable(target)
    const next = items.map((item) => (
        item.id === id
            ? {
                ...item,
                status: approved ? 'Approved' : 'Rejected',
                reviewedBy: reviewer,
                reviewedAt: new Date().toISOString(),
                rejectionReason: approved ? '' : rejectionReason,
            }
            : item
    ))
    saveChanges(next)
    return next
}
