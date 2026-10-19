import { apiRequest } from '../../../services/apiClient'
import { canUseClassDetailsApi, loadClassDirectory } from '../../../services/classDetailsApi'
import {
    getClasses as getCatalogClasses,
    getSections as getCatalogSections,
    getSubjects as getCatalogSubjects,
} from '../../../Common/RBAC/academicsCatalogData'
import {
    getSubjectsForClass,
    hydrateClassTimetablesFromApi,
    loadClassTimetableTeacherOptions,
} from '../ClassTimetable/classTimetableData'
import { hydrateTeacherAllocationsFromApi } from '../TeacherAllocation/teacherAllocationData'

export { getSubjectsForClass }

const STORAGE_KEY = 'principal-examination-timetables'

export const ROUTE_BASE = '/principal/examination-timetable'
export const CREATE_ROUTE = '/principal/create-examination-timetable'
export const EDIT_ROUTE = '/principal/edit-examination-timetable/:id'
export const DIRECTOR_ROUTE_BASE = '/director/examination-approvals'
export const DIRECTOR_EDIT_ROUTE = '/director/edit-examination-timetable/:id'

export const getExamTimetableRoutes = (pathname = '') => {
    if (String(pathname).startsWith('/director')) {
        return {
            listPath: DIRECTOR_ROUTE_BASE,
            createPath: CREATE_ROUTE,
            editPath: (id) => `/director/edit-examination-timetable/${id}`,
            reviewer: 'Director',
        }
    }
    return {
        listPath: ROUTE_BASE,
        createPath: CREATE_ROUTE,
        editPath: (id) => `/principal/edit-examination-timetable/${id}`,
        reviewer: 'Principal',
    }
}

export const EXAM_STATUSES = ['Draft', 'Published']
export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Denied']

/** Create-form exam types (also seeded in backend DEFAULT_TYPES). */
export const EXAM_TYPE_OPTIONS = [
    { code: 'MIDTERM', label: 'MIDTERM' },
    { code: 'QUARTERLY', label: 'Quarterly' },
    { code: 'HALF_YEARLY', label: 'Half Yearly' },
    { code: 'ANNUAL', label: 'Annual' },
]

/** @deprecated Use loadExamFormOptions() — kept empty so UI never shows hard-coded campus rows. */
export const GRADES = []
/** @deprecated Use loadExamFormOptions() */
export const SECTIONS = []
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** @deprecated Use loadExamFormOptions() */
export const SUBJECTS = []
/** @deprecated Use loadExamFormOptions() */
export const TEACHERS = []

/**
 * Campus class / section / subject / teacher options for Create Examination Timetable.
 * Prefer masters API; fall back to academics catalog + HR/communication teachers.
 */
export async function loadExamFormOptions() {
    let classes = []
    let sectionsByClass = {}
    let subjects = []

    if (canUseClassDetailsApi()) {
        try {
            const { records } = await loadClassDirectory()
            classes = (records || [])
                .filter((row) => row.isActive !== false)
                .map((row) => ({
                    id: row.id,
                    name: row.className || row.displayName,
                    sections: (row.sections || [])
                        .filter((section) => section.isActive !== false)
                        .map((section) => section.name)
                        .filter(Boolean),
                }))
            classes.forEach((row) => {
                sectionsByClass[row.name] = row.sections
            })
        } catch {
            /* fall through to catalog */
        }
        try {
            const rows = await apiRequest('/masters/subjects')
            subjects = (Array.isArray(rows) ? rows : [])
                .map((row) => row.name || row.code)
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b))
        } catch {
            /* fall through */
        }
    }

    if (!classes.length) {
        classes = getCatalogClasses().map((name) => ({ id: name, name, sections: [] }))
        const catalogSections = getCatalogSections()
        classes.forEach((row) => {
            sectionsByClass[row.name] = catalogSections
        })
    }
    if (!subjects.length) {
        subjects = getCatalogSubjects()
    }

    // Ensure teacher allocations + class timetables are loaded so exam subjects
    // can be derived per class (subjects teachers already handle for that grade).
    try {
        await Promise.all([
            hydrateTeacherAllocationsFromApi(),
            hydrateClassTimetablesFromApi(),
        ])
    } catch {
        /* ignore — local / catalog fallbacks still work */
    }

    const teachers = await loadClassTimetableTeacherOptions()

    return {
        classes: classes.map((row) => row.name).filter(Boolean),
        sectionsByClass,
        /** Campus master list (fallback only). Prefer getSubjectsForClass(className). */
        subjects,
        teachers: teachers.map((row) => ({
            id: row.employeeId || row.email || row.name,
            name: row.name,
            email: row.email || '',
        })),
    }
}

export const approvalStatusColor = {
    Approved: 'text-[#4CAF50] border-[#4CAF5033] bg-[#4CAF5014]',
    Pending: 'text-[#FF9800] border-[#FF980033] bg-[#FF980014]',
    Denied: 'text-[#980E0F] border-[#980E0F33] bg-[#980E0F14]',
}

export const examStatusColor = {
    Published: 'text-[#4CAF50] border-[#4CAF5033] bg-[#4CAF5014]',
    Draft: 'text-[#667085] border-[#66708533] bg-[#66708514]',
}

export const createTimelineRow = () => ({
    id: `TL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    day: '',
    subject: '',
    examDate: '',
    startTime: '',
    endTime: '',
})

export const defaultExamTimetableForm = () => ({
    examId: '',
    examName: '',
    examType: 'MIDTERM',
    academicYear: '',
    className: '',
    /** Multi-select section names; may include `__ALL__` when every section is chosen. */
    sections: [],
    /** Grade coordinator who receives the approved timetable to forward. */
    coordinatorId: '',
    coordinatorName: '',
    coordinatorEmail: '',
    status: 'Draft',
    startDate: null,
    endDate: null,
    timelines: [createTimelineRow()],
})

/** Resolve multi-select sections to concrete labels for storage / display. */
export const formatSectionsLabel = (sections = [], availableSections = []) => {
    const selected = Array.isArray(sections) ? sections.filter(Boolean) : []
    if (!selected.length) return ''
    if (selected.includes('__ALL__')) return 'All'
    if (availableSections.length && availableSections.every((s) => selected.includes(s))) return 'All'
    return selected.filter((s) => s !== '__ALL__').join(', ')
}

const DEFAULT_EXAM_TIMETABLES = [
    {
        id: 'EXM001',
        examName: 'Mid Term Examination',
        className: 'Grade 9',
        section: 'A',
        teacherName: 'Mr. Ravi Kumar',
        status: 'Published',
        startDate: '15-09-2025',
        endDate: '20-09-2025',
        createdDate: '01-09-2025',
        approvalStatus: 'Pending',
        timelines: [
            { id: 'TL-1', day: 'Monday', subject: 'Tamil', examDate: '02/05/2026', startTime: '10:30', endTime: '12:30' },
            { id: 'TL-2', day: 'Monday', subject: 'English', examDate: '02/05/2026', startTime: '14:30', endTime: '16:30' },
            { id: 'TL-3', day: 'Tuesday', subject: 'Science', examDate: '03/05/2026', startTime: '10:30', endTime: '12:30' },
            { id: 'TL-4', day: 'Wednesday', subject: 'Maths', examDate: '04/05/2026', startTime: '14:30', endTime: '16:30' },
        ],
    },
]

/** Map campus GET /exams row into the Principal timetable list shape. */
export const mapExamApiToTimetableRecord = (exam) => {
    const statusRaw = String(exam.status || '').toLowerCase()
    const apiStatus = statusRaw.includes('publish') || statusRaw === 'approved' ? 'Published' : 'Draft'
    const apiApproval =
        statusRaw.includes('pending') || statusRaw.includes('await') || statusRaw === 'submitted'
            ? 'Pending'
            : statusRaw === 'approved' || statusRaw.includes('publish')
              ? 'Approved'
              : statusRaw.includes('reject') || statusRaw.includes('den')
                ? 'Denied'
                : 'Pending'
    const local = getExamTimetableById(String(exam.id))
    // Campus approval is authoritative when decided. Keep local Approved/Denied only as a
    // fallback while the API is still submitted (local-only decide path).
    const localApproval = local?.approvalStatus || ''
    let approvalStatus = apiApproval
    if (apiApproval === 'Approved' || apiApproval === 'Denied') {
        approvalStatus = apiApproval
    } else if (localApproval === 'Approved' || localApproval === 'Denied') {
        approvalStatus = localApproval
    } else {
        approvalStatus = localApproval || apiApproval
    }
    const status = approvalStatus === 'Approved'
        ? 'Published'
        : (local?.status || apiStatus)
    return {
        id: String(exam.id),
        examName: local?.examName || exam.name || exam.examName || '',
        className: local?.className || exam.className || exam.class_name || '',
        section: local?.section || exam.section || '',
        sections: local?.sections || [],
        teacherName: local?.teacherName || '',
        examType: local?.examType || exam.examType || exam.exam_type || '',
        academicYear: local?.academicYear || exam.academicYear || exam.academic_year || '',
        coordinatorId: local?.coordinatorId || '',
        coordinatorName: local?.coordinatorName || '',
        coordinatorEmail: local?.coordinatorEmail || '',
        distributionStatus: local?.distributionStatus || '',
        status,
        startDate: local?.startDate || exam.startDate || exam.start_date || '',
        endDate: local?.endDate || exam.endDate || exam.end_date || '',
        createdDate: local?.createdDate || '',
        approvalStatus,
        approvalId: exam.approvalId || exam.approval_id || local?.approvalId || null,
        awaitingRoles: Array.isArray(exam.awaitingRoles) ? exam.awaitingRoles : [],
        rejectionReason: local?.rejectionReason || '',
        timelines: Array.isArray(local?.timelines) && local.timelines.length
            ? local.timelines
            : (Array.isArray(exam.timelines) ? exam.timelines : []),
        source: 'api',
    }
}

export const getExamTimetables = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const rows = JSON.parse(stored)
            return Array.isArray(rows) ? rows : []
        }
    } catch {
        /* ignore */
    }
    // Empty until the principal creates an exam (or hydrates from API). Avoid seeding
    // demo "Mid Term Examination" into Mark Entry / coordinator forward lists.
    return []
}

/** Demo-only seed used when API auth is disabled. */
export const getDemoExamTimetables = () => [...DEFAULT_EXAM_TIMETABLES]

export const saveExamTimetables = (records) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export const getExamTimetableById = (id) =>
    getExamTimetables().find((item) => item.id === id) ?? null

export const generateExamId = () => {
    const list = getExamTimetables()
    const max = list.reduce((acc, item) => {
        const num = Number(item.id.replace('EXM', ''))
        return Number.isFinite(num) ? Math.max(acc, num) : acc
    }, 0)
    return `EXM${String(max + 1).padStart(3, '0')}`
}

export const formatDisplayDate = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    return value.toLocaleDateString('en-GB').replace(/\//g, '-')
}

export const addExamTimetable = (payload) => {
    const sectionLabel = payload.section
        || formatSectionsLabel(payload.sections, payload.availableSections || [])
        || 'All'
    const record = {
        id: payload.examId || generateExamId(),
        examName: payload.examName,
        examType: payload.examType || 'MIDTERM',
        academicYear: payload.academicYear || '',
        className: payload.className,
        section: sectionLabel,
        sections: Array.isArray(payload.sections) ? payload.sections : [],
        teacherName: payload.coordinatorName || payload.teacherName || '',
        coordinatorId: payload.coordinatorId || '',
        coordinatorName: payload.coordinatorName || '',
        coordinatorEmail: payload.coordinatorEmail || '',
        distributionStatus: '',
        status: payload.status || 'Draft',
        startDate: formatDisplayDate(payload.startDate),
        endDate: formatDisplayDate(payload.endDate),
        createdDate: formatDisplayDate(new Date()),
        approvalStatus: 'Pending',
        timelines: payload.timelines.filter((row) => row.day && row.subject),
    }
    saveExamTimetables([record, ...getExamTimetables()])
    return record
}

const parseFormDate = (value) => {
    if (!value) return null
    if (value instanceof Date) return value
    const raw = String(value).trim()
    // ISO yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const d = new Date(raw.slice(0, 10))
        return Number.isNaN(d.getTime()) ? null : d
    }
    // dd-mm-yyyy or dd/mm/yyyy
    const parts = raw.split(/[-/]/)
    if (parts.length === 3) {
        const [dd, mm, yyyy] = parts
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
        return Number.isNaN(d.getTime()) ? null : d
    }
    return null
}

/** Load a stored/API-shaped record into the create/edit form. */
export const examRecordToForm = (record) => {
    if (!record) return defaultExamTimetableForm()
    const sectionLabel = record.section || ''
    let sections = Array.isArray(record.sections) ? [...record.sections] : []
    if (!sections.length && sectionLabel) {
        if (String(sectionLabel).toLowerCase() === 'all') sections = ['__ALL__']
        else sections = sectionLabel.split(',').map((s) => s.trim()).filter(Boolean)
    }
    return {
        examId: record.id || '',
        examName: record.examName || '',
        examType: record.examType || 'MIDTERM',
        academicYear: record.academicYear || '',
        className: record.className || '',
        sections,
        coordinatorId: record.coordinatorId || '',
        coordinatorName: record.coordinatorName || record.teacherName || '',
        coordinatorEmail: record.coordinatorEmail || '',
        teacherName: record.coordinatorName || record.teacherName || '',
        status: record.status || 'Draft',
        startDate: parseFormDate(record.startDate),
        endDate: parseFormDate(record.endDate),
        timelines: Array.isArray(record.timelines) && record.timelines.length
            ? record.timelines.map((row) => ({ ...createTimelineRow(), ...row }))
            : [createTimelineRow()],
        approvalId: record.approvalId || null,
    }
}

/** Update an existing exam timetable; edits reset approval to Pending. */
export const updateExamTimetable = (id, payload) => {
    const sectionLabel = payload.section
        || formatSectionsLabel(payload.sections, payload.availableSections || [])
        || 'All'
    const list = getExamTimetables()
    const idx = list.findIndex((item) => String(item.id) === String(id))
    const resetApproval = payload.resetApproval !== false
    const next = {
        id: String(id),
        examName: payload.examName,
        examType: payload.examType || (idx >= 0 ? list[idx].examType : 'MIDTERM') || 'MIDTERM',
        academicYear: payload.academicYear
            || (idx >= 0 ? list[idx].academicYear : '')
            || '',
        className: payload.className,
        section: sectionLabel,
        sections: Array.isArray(payload.sections) ? payload.sections : [],
        teacherName: payload.coordinatorName || payload.teacherName || '',
        coordinatorId: payload.coordinatorId || '',
        coordinatorName: payload.coordinatorName || '',
        coordinatorEmail: payload.coordinatorEmail || '',
        distributionStatus: resetApproval
            ? ''
            : (payload.distributionStatus || (idx >= 0 ? list[idx].distributionStatus : '') || ''),
        status: payload.status || (idx >= 0 ? list[idx].status : 'Draft') || 'Draft',
        startDate: formatDisplayDate(payload.startDate),
        endDate: formatDisplayDate(payload.endDate),
        createdDate: idx >= 0 ? list[idx].createdDate : formatDisplayDate(new Date()),
        approvalStatus: resetApproval
            ? 'Pending'
            : (payload.approvalStatus || (idx >= 0 ? list[idx].approvalStatus : 'Pending')),
        approvalId: payload.approvalId || (idx >= 0 ? list[idx].approvalId : null) || null,
        rejectionReason: resetApproval ? '' : (payload.rejectionReason || ''),
        timelines: (payload.timelines || []).filter((row) => row.day && row.subject),
        source: idx >= 0 ? list[idx].source : payload.source,
    }
    if (idx >= 0) {
        const updated = [...list]
        updated[idx] = { ...list[idx], ...next }
        saveExamTimetables(updated)
        return updated[idx]
    }
    saveExamTimetables([next, ...list])
    return next
}

/**
 * Apply Approve/Deny. Upserts a local overlay when the exam only exists from the API list.
 * @param {string} id
 * @param {'Approved'|'Denied'|string} approvalStatus
 * @param {string} reviewer
 * @param {string} rejectionReason
 * @param {object} [baseRecord] current list row to seed overlay from
 */
export const decideExamTimetableApproval = (
    id,
    approvalStatus,
    reviewer = 'Principal',
    rejectionReason = '',
    baseRecord = null,
) => {
    const nextApproval = approvalStatus === 'Approved' ? 'Approved' : 'Denied'
    const list = getExamTimetables()
    const idx = list.findIndex((item) => String(item.id) === String(id))
    const seed = idx >= 0 ? list[idx] : (baseRecord || {})
    const decided = {
        ...seed,
        id: String(id),
        examName: seed.examName || seed.name || '',
        examType: seed.examType || 'MIDTERM',
        academicYear: seed.academicYear || '',
        className: seed.className || '',
        section: seed.section || '',
        sections: seed.sections || [],
        teacherName: seed.coordinatorName || seed.teacherName || '',
        coordinatorId: seed.coordinatorId || '',
        coordinatorName: seed.coordinatorName || '',
        coordinatorEmail: seed.coordinatorEmail || '',
        startDate: seed.startDate || '',
        endDate: seed.endDate || '',
        createdDate: seed.createdDate || formatDisplayDate(new Date()),
        timelines: Array.isArray(seed.timelines) ? seed.timelines : [],
        approvalId: seed.approvalId || null,
        source: seed.source || (idx >= 0 ? list[idx].source : 'local'),
        approvalStatus: nextApproval,
        status: nextApproval === 'Approved' ? 'Published' : (seed.status || 'Draft'),
        // Approved → grade coordinator inbox for forwarding to teachers/students.
        distributionStatus: nextApproval === 'Approved'
            ? 'AwaitingCoordinator'
            : (seed.distributionStatus || ''),
        rejectionReason: nextApproval === 'Denied' ? rejectionReason : '',
        reviewedBy: reviewer,
    }
    if (idx >= 0) {
        const updated = [...list]
        updated[idx] = { ...list[idx], ...decided }
        saveExamTimetables(updated)
        return updated[idx]
    }
    saveExamTimetables([decided, ...list])
    return decided
}

export const buildExamGridFromTimelines = (timelines = []) => {
    const rows = Array.isArray(timelines) ? timelines : []
    const days = [...new Set(rows.map((row) => row.day).filter(Boolean))]
    const slotMap = new Map()

    rows.forEach((row) => {
        if (!row.startTime || !row.endTime) return
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
    let filledCells = 0

    rows.forEach((row) => {
        if (!row.day || !row.startTime || !row.endTime || !row.subject) return
        const label = `${row.startTime} - ${row.endTime}`
        if (!schedule[label]) schedule[label] = {}
        schedule[label][row.day] = {
            subject: row.subject,
            date: row.examDate || '—',
        }
        filledCells += 1
    })

    return {
        days: days.length ? days : DAYS.slice(0, 6),
        timeSlots: timeSlots.length ? timeSlots : [{ time: '—', label: '—' }],
        schedule,
        hasGridData: filledCells > 0,
        rows,
    }
}

export const getClassSectionLabel = (record) =>
    `${record.className} - ${record.section}`
