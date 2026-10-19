import { getAccessToken, isApiAuthEnabled } from '../../services/apiClient'
import { listDirectoryApi } from '../../services/communicationApi'
import { canUseExamsApi, listExamsApi } from '../../services/examsApi'
import { getMyGradeBandApi, listCoordinatorGradeBandsApi } from '../../services/placementApi'
import {
    getExamTimetableById,
    getExamTimetables,
    mapExamApiToTimetableRecord,
    saveExamTimetables,
} from '../../Pages/Principal/ExaminationTimetable/examinationTimetableData'
import { getAllocationByEmployeeId, getAllocations } from '../../Pages/Principal/TeacherAllocation/teacherAllocationData'
import { getTeacherAssignmentRows } from '../Teacher/teacherAssignedClasses'

export const EXAM_TYPE_OPTIONS = [
    { code: 'MIDTERM', label: 'MIDTERM' },
    { code: 'QUARTERLY', label: 'Quarterly' },
    { code: 'HALF_YEARLY', label: 'Half Yearly' },
    { code: 'ANNUAL', label: 'Annual' },
]

export const DISTRIBUTION = {
    NONE: '',
    AWAITING_COORDINATOR: 'AwaitingCoordinator',
    FORWARDED: 'Forwarded',
}

const classKeysMatch = (left, right) => {
    const normalize = (value) => String(value || '').trim().toLowerCase().replace(/^grade\s+/, '')
    return normalize(left) === normalize(right)
}

export const parseGradeNumber = (className) => {
    const match = String(className || '').match(/(\d{1,2})/)
    if (!match) return null
    const n = Number(match[1])
    return Number.isFinite(n) ? n : null
}

const emailOf = (value) => String(value || '').trim().toLowerCase()

/** Coordinators with emails + grade bands (preferred) or directory fallback. */
export async function loadCoordinatorOptions() {
    if (!(isApiAuthEnabled() && getAccessToken())) return []

    let directoryById = new Map()
    try {
        const people = await listDirectoryApi()
        directoryById = new Map(
            (Array.isArray(people) ? people : []).map((person) => [String(person.id), person]),
        )
    } catch {
        directoryById = new Map()
    }

    try {
        const bands = await listCoordinatorGradeBandsApi()
        if (Array.isArray(bands) && bands.length) {
            return bands
                .filter((row) => row.isActive !== false)
                .map((row) => {
                    const person = directoryById.get(String(row.userId)) || {}
                    const email = emailOf(row.email || person.email)
                    return {
                        id: String(row.userId || ''),
                        name: person.name || (email ? email.split('@')[0] : 'Coordinator'),
                        email,
                        gradeFrom: row.gradeFrom ?? null,
                        gradeTo: row.gradeTo ?? null,
                    }
                })
                .filter((row) => row.id || row.email)
                .sort((a, b) => a.name.localeCompare(b.name))
        }
    } catch {
        /* Principal-only endpoint; fall through to directory. */
    }

    try {
        const people = [...directoryById.values()]
        return people
            .filter((person) => String(person.role || '').toLowerCase() === 'coordinator')
            .map((person) => ({
                id: String(person.id || person.employeeId || person.email || ''),
                name: person.name || person.email || 'Coordinator',
                email: emailOf(person.email),
                gradeFrom: null,
                gradeTo: null,
            }))
            .filter((row) => row.id || row.email)
            .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
        return []
    }
}

/**
 * Prefer coordinator whose grade band covers the class; else allocation match; else first.
 */
export function findCoordinatorForClass(className, coordinators = []) {
    if (!className || !coordinators.length) return null
    const grade = parseGradeNumber(className)
    if (grade != null) {
        const byBand = coordinators.find((row) => (
            row.gradeFrom != null
            && row.gradeTo != null
            && grade >= Number(row.gradeFrom)
            && grade <= Number(row.gradeTo)
        ))
        if (byBand) return byBand
    }

    const allocations = getAllocations()
    const byId = new Map(coordinators.map((c) => [String(c.id), c]))
    const byEmail = new Map(coordinators.filter((c) => c.email).map((c) => [c.email, c]))

    for (const allocation of allocations) {
        const status = String(allocation?.status || 'Active').toLowerCase()
        if (status && status !== 'active') continue
        const maps = Array.isArray(allocation.mappings) ? allocation.mappings : []
        const teaching = Array.isArray(allocation.teachingClasses) ? allocation.teachingClasses : []
        const classTeacher = allocation.classTeacher?.className
        const hits = teaching.some((c) => classKeysMatch(c, className))
            || maps.some((m) => classKeysMatch(m.className, className))
            || classKeysMatch(classTeacher, className)
        if (!hits) continue
        const match = byId.get(String(allocation.employeeId))
            || byEmail.get(emailOf(allocation.email))
        if (match) return match
    }
    return coordinators[0] || null
}

export const examTypeLabel = (code) => {
    const match = EXAM_TYPE_OPTIONS.find((item) => item.code === code)
    return match?.label || code || '—'
}

const sectionMatches = (examSection, studentSection) => {
    const label = String(examSection || '').trim()
    if (!label || /^all$/i.test(label)) return true
    if (!studentSection) return true
    const parts = label.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    return parts.includes(String(studentSection).trim().toLowerCase())
}

const isReadyForCoordinator = (row) => {
    const approval = String(row.approvalStatus || '').toLowerCase()
    if (approval === 'approved') return true
    const dist = row.distributionStatus || DISTRIBUTION.NONE
    if (dist === DISTRIBUTION.AWAITING_COORDINATOR || dist === DISTRIBUTION.FORWARDED) return true
    const status = String(row.status || '').toLowerCase()
    return status === 'approved' || status === 'published'
}

const isDemoExamId = (id) => /^EXM\d+$/i.test(String(id || ''))

/** Merge campus exams with local overlay (timelines, coordinator, distribution). */
export async function loadMergedExamRecords() {
    const local = getExamTimetables()
    let apiRows = []
    const api = canUseExamsApi()
    if (api) {
        try {
            apiRows = (await listExamsApi()).map(mapExamApiToTimetableRecord)
        } catch {
            apiRows = []
        }
    }
    const byId = new Map()
    local.forEach((row) => {
        // Drop browser-only demo seeds (e.g. Mid Term EXM001) when campus API is live.
        if (api && isDemoExamId(row.id) && row.source !== 'api') return
        byId.set(String(row.id), { ...row })
    })
    apiRows.forEach((row) => {
        const id = String(row.id)
        const existing = byId.get(id)
        if (!existing) {
            byId.set(id, row)
            return
        }
        const apiApproval = String(row.approvalStatus || '').toLowerCase()
        const localApproval = String(existing.approvalStatus || '').toLowerCase()
        const approvalStatus = (apiApproval === 'approved' || apiApproval === 'denied')
            ? row.approvalStatus
            : (localApproval === 'approved' || localApproval === 'denied'
                ? existing.approvalStatus
                : (existing.approvalStatus || row.approvalStatus))
        byId.set(id, {
            ...row,
            ...existing,
            approvalStatus,
            status: String(approvalStatus).toLowerCase() === 'approved'
                ? 'Published'
                : (existing.status || row.status),
            approvalId: row.approvalId || existing.approvalId,
            // Prefer campus fields after PUT; keep local timelines / coordinator / forward state.
            examName: row.examName || existing.examName,
            examType: row.examType || existing.examType,
            academicYear: row.academicYear || existing.academicYear || '',
            className: row.className || existing.className,
            startDate: row.startDate || existing.startDate,
            endDate: row.endDate || existing.endDate,
        })
    })
    return [...byId.values()]
}

export function patchExamDistribution(id, patch) {
    const list = getExamTimetables()
    const idx = list.findIndex((item) => String(item.id) === String(id))
    if (idx < 0) {
        const seed = getExamTimetableById(id) || { id: String(id) }
        const next = { ...seed, ...patch }
        saveExamTimetables([next, ...list])
        return next
    }
    const updated = [...list]
    updated[idx] = { ...list[idx], ...patch }
    saveExamTimetables(updated)
    return updated[idx]
}

export function forwardExamTimetable(id, forwardedBy = '') {
    return patchExamDistribution(id, {
        distributionStatus: DISTRIBUTION.FORWARDED,
        forwardedAt: new Date().toISOString(),
        forwardedBy,
    })
}

/**
 * Approved exams waiting for the logged-in coordinator to forward.
 * Matches by assigned email/id, else by the coordinator's grade band (Grade 1 → bands 1–4).
 */
export function filterCoordinatorInbox(records, { email, name, userId, gradeFrom, gradeTo } = {}) {
    const meEmail = emailOf(email)
    const meName = String(name || '').trim().toLowerCase()
    const meId = String(userId || '').trim()
    const hasBand = gradeFrom != null && gradeTo != null

    return records.filter((row) => {
        if (!isReadyForCoordinator(row)) return false
        const dist = row.distributionStatus || DISTRIBUTION.NONE
        if (dist === DISTRIBUTION.FORWARDED) return false
        const awaiting = !dist || dist === DISTRIBUTION.AWAITING_COORDINATOR
        if (!awaiting) return false

        const assignedEmail = emailOf(row.coordinatorEmail)
        const assignedName = String(row.coordinatorName || '').trim().toLowerCase()
        const assignedId = String(row.coordinatorId || '').trim()

        const emailMatch = Boolean(meEmail && assignedEmail && assignedEmail === meEmail)
        const idMatch = Boolean(meId && assignedId && assignedId === meId)
        const nameMatch = Boolean(meName && assignedName && assignedName === meName)
        if (emailMatch || idMatch || nameMatch) return true

        // Explicit email assignment to a different coordinator → hide
        if (assignedEmail && meEmail && assignedEmail !== meEmail) return false

        // Grade band covers this class (also covers older rows that stored employee codes
        // instead of user ids, or had no email on the directory payload).
        if (hasBand) {
            const grade = parseGradeNumber(row.className)
            if (grade == null) return true
            return grade >= Number(gradeFrom) && grade <= Number(gradeTo)
        }

        if (!assignedEmail && !assignedName && !assignedId) return true
        return false
    })
}

/** Load the signed-in coordinator's grade band (1–4, 5–8, …). */
export async function loadMyCoordinatorBand() {
    if (!(isApiAuthEnabled() && getAccessToken())) return null
    try {
        return await getMyGradeBandApi()
    } catch {
        return null
    }
}

/** Forwarded exams for a teacher (classes/subjects they teach). */
export function filterTeacherVisibleExams(records, teacherEmail) {
    const assignments = getTeacherAssignmentRows(teacherEmail)
    const classKeys = assignments.map((a) => a.className).filter(Boolean)
    const subjectSet = new Set(assignments.map((a) => String(a.subject || '').toLowerCase()).filter(Boolean))
    const employeeId = assignments[0]?.employeeId
    const allocation = employeeId ? getAllocationByEmployeeId(employeeId) : null
    const teaching = Array.isArray(allocation?.teachingClasses) ? allocation.teachingClasses : []
    const allClassKeys = [...classKeys, ...teaching]

    return records.filter((row) => {
        if (!isReadyForCoordinator(row)) return false
        if (row.distributionStatus !== DISTRIBUTION.FORWARDED) return false
        if (allClassKeys.length && !allClassKeys.some((c) => classKeysMatch(c, row.className))) {
            return false
        }
        const timelines = Array.isArray(row.timelines) ? row.timelines : []
        if (!timelines.length || !subjectSet.size) return true
        return timelines.some((t) => subjectSet.has(String(t.subject || '').toLowerCase()))
    })
}

/** Forwarded exams for a student class/section (All sections → every section). */
export function filterStudentVisibleExams(records, student) {
    if (!student?.className) return []
    return records.filter((row) => {
        if (!isReadyForCoordinator(row)) return false
        if (row.distributionStatus !== DISTRIBUTION.FORWARDED) return false
        if (!classKeysMatch(row.className, student.className)) return false
        return sectionMatches(row.section, student.section)
    })
}

export function toScheduleRow(record) {
    const examType = record.examType || record.exam_type || ''
    return {
        id: String(record.id),
        name: record.examName || record.name || 'Exam',
        examType,
        examTypeLabel: examTypeLabel(examType),
        academicYear: record.academicYear || '',
        className: record.className || '',
        section: record.section || '',
        startDate: record.startDate || '',
        endDate: record.endDate || '',
        distributionStatus: record.distributionStatus || '',
        coordinatorName: record.coordinatorName || '',
        timelines: Array.isArray(record.timelines) ? record.timelines : [],
        record,
    }
}
