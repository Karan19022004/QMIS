import { CLASSES, SECTIONS, SUBJECTS } from '../../Pages/Teacher/AssignedClass/assignedClassData'
import { getStudentsList } from '../StudentDatabase/studentDatabaseData'
import { PARENT_CHILD_PROFILES } from '../../Pages/Parent/parentStudentProfiles'
import { decideApprovalApi } from '../../services/approvalsApi'
import {
    canUseExamsApi,
    getMarksBatchApi,
    listMarksBatchesApi,
    mapMarksBatchFromApi,
} from '../../services/examsApi'

export { CLASSES, SECTIONS, SUBJECTS }
export { canUseExamsApi }

export const ACADEMIC_YEARS = ['2026 - 2027', '2025 - 2026']
export const TERMS = ['Term 1', 'Term 2', 'Term 3']

export const EXAM_OPTIONS = [
    { name: 'Mid Term', maxMarks: 100 },
    { name: 'Unit Test', maxMarks: 50 },
    { name: 'Annual Examination', maxMarks: 100 },
    { name: 'Pre-Board Examination', maxMarks: 100 },
]

/** Match exam academic year label (preferred) or start-date years like "2026 - 2027". */
export const examMatchesAcademicYear = (exam, academicYear) => {
    const wanted = String(academicYear || '').trim().toLowerCase()
    if (!wanted) return true
    const labeled = String(exam?.academicYear || exam?.academic_year || '').trim().toLowerCase()
    if (labeled) return labeled === wanted
    const years = wanted.match(/\d{4}/g)?.map(Number) || []
    if (!years.length) return true
    const startYear = Number(String(exam?.startDate || exam?.start_date || '').slice(0, 4))
    if (!Number.isFinite(startYear) || !startYear) return true
    return years.includes(startYear)
}

/** Unique exam display names (Grade 1 / Grade 2 entries share one name). */
export const uniqueExamNames = (exams = []) => {
    const seen = new Set()
    const names = []
    exams.forEach((row) => {
        const name = String(row.examName || row.name || '').trim()
        if (!name) return
        const key = name.toLowerCase()
        if (seen.has(key)) return
        seen.add(key)
        names.push(name)
    })
    return names.sort((a, b) => a.localeCompare(b))
}

/** Classes that have a campus exam row for the selected exam name. */
export const classesForExamName = (exams = [], examName = '') => {
    const wanted = String(examName || '').trim().toLowerCase()
    if (!wanted) return []
    const classes = new Set()
    exams.forEach((row) => {
        const name = String(row.examName || row.name || '').trim().toLowerCase()
        if (name !== wanted) return
        const className = String(row.className || '').trim()
        if (className) classes.add(className)
    })
    return [...classes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/** Resolve the campus exam id for a name + class pair. */
export const findExamForNameAndClass = (exams = [], examName = '', className = '') => {
    const wantedName = String(examName || '').trim().toLowerCase()
    const wantedClass = String(className || '').trim().toLowerCase().replace(/^grade\s+/, '')
    if (!wantedName || !wantedClass) return null
    return exams.find((row) => {
        const name = String(row.examName || row.name || '').trim().toLowerCase()
        if (name !== wantedName) return false
        const cls = String(row.className || '').trim().toLowerCase().replace(/^grade\s+/, '')
        return cls === wantedClass
    }) || null
}

export const STATUS_FILTERS = ['All', 'Pending', 'Entered', 'Absent']
export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected']

export const PASS_MARK_PERCENT = 33

const STORAGE_KEY = 'teacher-mark-entry-sessions'

/** Optional aliases for parent-portal student IDs (empty after Academics wipe). */
const STUDENT_MARK_ID_ALIASES = {}

export const resolveStudentIdForMarks = (studentId) =>
    STUDENT_MARK_ID_ALIASES[studentId] ?? studentId

const getEncouragementName = (studentId) => {
    const parentProfile = PARENT_CHILD_PROFILES[studentId]
    if (parentProfile?.name) return parentProfile.name.split(' ')[0]

    const resolvedId = resolveStudentIdForMarks(studentId)
    const student = getStudentsList().find((item) => item.id === resolvedId)
    return student?.name?.split(' ')[0] ?? 'Student'
}

export const formatClassLabel = (className) => {
    const value = String(className || '').trim()
    if (!value) return ''
    return /^grade\s+/i.test(value) ? value : value
}

export const approvalStatusColor = {
    Pending: 'bg-[#FF980033] text-[#FF9800]',
    Approved: 'bg-[#4CAF5033] text-[#4CAF50]',
    Rejected: 'bg-[#FF000033] text-[#FF0000]',
}

export const getGradeFromPercentage = (percentage) => {
    if (percentage >= 90) return 'A+'
    if (percentage >= 80) return 'A'
    if (percentage >= 70) return 'B+'
    if (percentage >= 60) return 'B'
    if (percentage >= 50) return 'C'
    if (percentage >= PASS_MARK_PERCENT) return 'D'
    return 'F'
}

export const computeMarkEntry = ({ obtainedMarks, maxMarks, absent }) => {
    if (absent) {
        return { grade: '—', percentage: null, displayPercent: '—', result: 'Absent' }
    }

    if (obtainedMarks === null || obtainedMarks === '' || Number.isNaN(Number(obtainedMarks))) {
        return { grade: '—', percentage: null, displayPercent: '—', result: '—' }
    }

    const obtained = Number(obtainedMarks)
    const percentage = (obtained / maxMarks) * 100
    const grade = getGradeFromPercentage(percentage)
    const result = percentage >= PASS_MARK_PERCENT ? 'Pass' : 'Fail'

    return {
        grade,
        percentage,
        displayPercent: `${Math.round(percentage)}%`,
        result,
    }
}

export const buildContextKey = (context) =>
    [
        context.academicYear,
        context.exam,
        context.className,
        context.section,
        context.subject,
    ].join('|')

export const encodeContextKey = (contextKey) => encodeURIComponent(contextKey)

export const decodeContextKey = (encoded) => decodeURIComponent(encoded)

export const getExamMaxMarks = (examName) =>
    EXAM_OPTIONS.find((item) => item.name === examName)?.maxMarks ?? 100

export const getStudentsForMarkEntry = (className, section) => {
    const students = getStudentsList().filter((student) => {
        const studentClass = student.className || student.class || ''
        if (studentClass !== className) return false
        if (!section) return true
        const studentSection = student.section || ''
        // Campus student rows often omit section — still include them for the selected class.
        if (!studentSection || studentSection === '—' || studentSection === 'All') return true
        return studentSection === section
    })

    return [...students].sort((a, b) => {
        const rollA = parseInt(String(a.rollNumber || a.admissionNumber || '').replace(/\D/g, ''), 10) || 0
        const rollB = parseInt(String(b.rollNumber || b.admissionNumber || '').replace(/\D/g, ''), 10) || 0
        return rollA - rollB
    })
}

const defaultEntry = () => ({
    obtainedMarks: null,
    absent: false,
    remarks: '',
})

export const createEmptyEntries = (students) => {
    const entries = {}
    students.forEach((student) => {
        entries[student.id] = defaultEntry()
    })
    return entries
}

const readSessions = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) return JSON.parse(stored)
    } catch {
        /* ignore */
    }
    return {}
}

const writeSessions = (sessions) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

export const getAllMarkSessions = () =>
    Object.values(readSessions()).sort(
        (a, b) => new Date(b.submittedAt || b.updatedAt || 0) - new Date(a.submittedAt || a.updatedAt || 0),
    )

export const getMarkSessionByKey = (contextKey) => readSessions()[contextKey] ?? null

/** Map a marks-batch API row into the Director approval session shape. */
export const mapMarksBatchToApprovalSession = (batch) => {
    const status = String(batch.status || '').toLowerCase()
    let approvalStatus = 'Pending'
    if (status === 'published' || status === 'approved') approvalStatus = 'Approved'
    else if (status === 'denied' || status === 'rejected') approvalStatus = 'Rejected'

    const students = (batch.entries || []).map((entry) => ({
        id: entry.studentId,
        name: entry.studentName || 'Student',
        admissionNumber: entry.admissionNumber || '',
        rollNo: entry.admissionNumber || '—',
    }))
    const entries = {}
    for (const entry of batch.entries || []) {
        entries[entry.studentId] = {
            obtainedMarks: entry.absent ? null : entry.marks,
            absent: Boolean(entry.absent),
            remarks: entry.remarks || '',
        }
    }

    const teacherLabel = batch.teacherName
        || (batch.teacherEmail ? String(batch.teacherEmail).split('@')[0].replace(/\./g, ' ') : '')
        || 'Teacher'

    return {
        contextKey: batch.id,
        batchId: batch.id,
        approvalId: batch.approvalId || null,
        exam: batch.examName || batch.examId || 'Exam',
        className: batch.className || '',
        section: batch.section || '',
        subject: batch.subject || '',
        term: '',
        academicYear: batch.academicYear || '',
        examDate: batch.examDate || '',
        maxMarks: batch.maxMarks ?? 100,
        status: 'submitted',
        approvalStatus,
        students,
        entries,
        submittedByName: teacherLabel,
        submittedByRole: 'Teacher',
        teacherEmail: batch.teacherEmail || '',
        awaitingRole: batch.awaitingRole || null,
        submittedAt: batch.submittedAt || null,
        source: 'api',
    }
}

/** Director list: submitted / published / denied batches (not drafts). */
export async function hydrateMarkApprovalsFromApi() {
    if (!canUseExamsApi()) return getAllMarkSessions().filter((s) => s.status === 'submitted')
    const rows = await listMarksBatchesApi({})
    const submitted = (Array.isArray(rows) ? rows : [])
        .map(mapMarksBatchFromApi)
        .filter((batch) => {
            const status = String(batch.status || '').toLowerCase()
            return status === 'submitted' || status === 'published' || status === 'denied'
        })

    const detailed = await Promise.all(
        submitted.map(async (batch) => {
            try {
                return mapMarksBatchFromApi(await getMarksBatchApi(batch.id))
            } catch {
                return batch
            }
        }),
    )
    return detailed.map(mapMarksBatchToApprovalSession)
}

export async function getMarkApprovalSessionFromApi(batchId) {
    if (!canUseExamsApi()) return getMarkSessionByKey(batchId)
    const batch = mapMarksBatchFromApi(await getMarksBatchApi(batchId))
    return mapMarksBatchToApprovalSession(batch)
}

/** Resolve campus approval id from session or by re-fetching the marks batch. */
async function resolveMarksBatchApprovalId(session) {
    if (session?.approvalId) return String(session.approvalId)
    const batchId = session?.batchId || session?.contextKey
    if (!batchId || !canUseExamsApi()) return null
    try {
        const fresh = mapMarksBatchFromApi(await getMarksBatchApi(batchId))
        return fresh.approvalId ? String(fresh.approvalId) : null
    } catch {
        return null
    }
}

/** Approve or reject a marks batch via POST /approvals/{id}/decide. */
export async function decideMarkApprovalViaApi(session, approvalStatus, rejectionReason = '') {
    const decision = approvalStatus === 'Approved' ? 'approve' : 'deny'
    if (decision === 'deny' && !String(rejectionReason || '').trim()) {
        return { success: false, message: 'A rejection reason is required.' }
    }
    const approvalId = await resolveMarksBatchApprovalId(session)
    if (!approvalId) {
        return {
            success: false,
            message: 'This submission has no approval request yet. Ask the teacher to re-submit marks.',
        }
    }
    await decideApprovalApi(approvalId, {
        decision,
        comment: rejectionReason || undefined,
    })
    return { success: true, approvalId }
}

export const getPendingMarkSessions = () =>
    getAllMarkSessions().filter(
        (session) => session.status === 'submitted' && session.approvalStatus === 'Pending',
    )

export const getPendingApprovalCount = () => getPendingMarkSessions().length

export const loadMarkEntrySession = (context) => {
    const contextKey = buildContextKey(context)
    const sessions = readSessions()
    const existing = sessions[contextKey]

    if (existing) {
        return { ...existing, contextKey }
    }

    const students = getStudentsForMarkEntry(context.className, context.section)
    return {
        contextKey,
        ...context,
        maxMarks: context.maxMarks ?? getExamMaxMarks(context.exam),
        status: 'draft',
        approvalStatus: null,
        entries: createEmptyEntries(students),
        students,
    }
}

export const saveMarkEntrySession = (session) => {
    const sessions = readSessions()
    sessions[session.contextKey] = {
        ...session,
        updatedAt: new Date().toISOString(),
    }
    writeSessions(sessions)
    return session
}

export const submitMarkEntrySession = (session, { submittedByRole = 'Teacher' } = {}) => {
    const submitted = {
        ...session,
        status: 'submitted',
        approvalStatus: 'Pending',
        submittedByRole,
        submittedAt: new Date().toISOString(),
        approvedAt: null,
        approvedBy: null,
        rejectionReason: null,
    }
    saveMarkEntrySession(submitted)
    return submitted
}

export const updateMarkSessionApproval = (contextKey, approvalStatus, rejectionReason = '') => {
    const sessions = readSessions()
    const session = sessions[contextKey]
    if (!session) return null

    const updated = {
        ...session,
        approvalStatus,
        approvedAt: approvalStatus === 'Approved' ? new Date().toISOString() : session.approvedAt,
        approvedBy: approvalStatus === 'Approved' ? 'Director' : session.approvedBy,
        rejectionReason: approvalStatus === 'Rejected' ? rejectionReason : null,
        updatedAt: new Date().toISOString(),
    }

    sessions[contextKey] = updated
    writeSessions(sessions)
    return updated
}

/**
 * Director Approve & Publish / Reject.
 * When campus API auth is on, always hits POST /approvals/{id}/decide (never local-only).
 */
export async function resolveMarkSessionApproval(session, approvalStatus, rejectionReason = '') {
    if (canUseExamsApi()) {
        return decideMarkApprovalViaApi(session, approvalStatus, rejectionReason)
    }
    const updated = updateMarkSessionApproval(session.contextKey, approvalStatus, rejectionReason)
    return updated
        ? { success: true, session: updated }
        : { success: false, message: 'Mark entry session not found.' }
}

export const filterMarkSessions = (sessions, { search = '', approvalStatus = '' } = {}) => {
    const query = search.trim().toLowerCase()

    return sessions.filter((session) => {
        if (session.status !== 'submitted') return false
        if (approvalStatus && session.approvalStatus !== approvalStatus) return false

        if (!query) return true

        const haystack = [
            session.exam,
            session.subject,
            session.className,
            session.section,
            session.term,
            session.academicYear,
            session.submittedByRole,
        ].join(' ').toLowerCase()

        return haystack.includes(query)
    })
}

export const getEntryWithComputed = (entry, maxMarks) => {
    const computed = computeMarkEntry({
        obtainedMarks: entry.obtainedMarks,
        maxMarks,
        absent: entry.absent,
    })
    return { ...entry, ...computed }
}

export const isEntryComplete = (entry) =>
    entry.absent || (entry.obtainedMarks !== null && entry.obtainedMarks !== '' && !Number.isNaN(Number(entry.obtainedMarks)))

export const getMarkEntryStats = (students, entries, maxMarks) => {
    let marksEntered = 0
    let pending = 0
    let absent = 0
    const obtainedValues = []

    students.forEach((student) => {
        const entry = entries[student.id] ?? defaultEntry()
        if (entry.absent) {
            absent += 1
            marksEntered += 1
            return
        }
        if (isEntryComplete(entry)) {
            marksEntered += 1
            obtainedValues.push(Number(entry.obtainedMarks))
            return
        }
        pending += 1
    })

    const averageMark = obtainedValues.length
        ? (obtainedValues.reduce((sum, value) => sum + value, 0) / obtainedValues.length).toFixed(1)
        : '—'
    const highestMark = obtainedValues.length ? Math.max(...obtainedValues) : '—'
    const lowestMark = obtainedValues.length ? Math.min(...obtainedValues) : '—'

    return {
        totalStudents: students.length,
        marksEntered,
        pending,
        absent,
        averageMark,
        highestMark,
        lowestMark,
    }
}

export const filterStudentsForTable = (students, entries, { search, statusFilter }) => {
    const query = search.trim().toLowerCase()

    return students.filter((student) => {
        const entry = entries[student.id] ?? defaultEntry()

        if (query) {
            const haystack = `${student.name} ${student.rollNumber} ${student.admissionNumber}`.toLowerCase()
            if (!haystack.includes(query)) return false
        }

        if (statusFilter === 'Pending') return !isEntryComplete(entry)
        if (statusFilter === 'Entered') return isEntryComplete(entry) && !entry.absent
        if (statusFilter === 'Absent') return entry.absent

        return true
    })
}

export const resultBadgeColor = {
    Pass: 'bg-[#4CAF5033] text-[#4CAF50]',
    Fail: 'bg-[#FF000033] text-[#FF0000]',
    Absent: 'bg-[#FF980033] text-[#FF9800]',
    '—': 'bg-[#66708533] text-[#667085]',
}

export const getApprovedMarksForStudent = (studentId) => {
    const resolvedId = resolveStudentIdForMarks(studentId)
    const rows = []

    getAllMarkSessions()
        .filter((session) => session.approvalStatus === 'Approved')
        .forEach((session) => {
            const entry = session.entries?.[resolvedId]
            if (!entry || !isEntryComplete(entry)) return

            const computed = getEntryWithComputed(entry, session.maxMarks)
            rows.push({
                id: `${session.contextKey}|${studentId}`,
                examName: session.exam,
                subject: session.subject,
                term: session.term,
                academicYear: session.academicYear,
                totalMarks: session.maxMarks,
                obtainedMarks: entry.absent ? '—' : entry.obtainedMarks,
                grade: computed.grade,
                percentage: computed.displayPercent,
                resultStatus: computed.result,
                teacherRemarks: entry.remarks || '—',
                examDate: session.examDate,
            })
        })

    return rows.sort((a, b) => {
        if (a.examName !== b.examName) return a.examName.localeCompare(b.examName)
        return a.subject.localeCompare(b.subject)
    })
}

export const getStudentResultSummary = (studentId) => {
    const resolvedId = resolveStudentIdForMarks(studentId)
    const approvedRows = getApprovedMarksForStudent(studentId)
    const staticFallback = {
        examAppeared: 0,
        averagePercent: 0,
        highestMark: '—',
        highestSubject: '—',
        overallGrade: '—',
        encouragementName: getEncouragementName(studentId),
    }

    if (!approvedRows.length) {
        return staticFallback
    }

    const numericRows = approvedRows.filter(
        (row) => row.resultStatus !== 'Absent' && row.obtainedMarks !== '—',
    )

    const percentages = numericRows.map((row) => {
        const match = String(row.percentage).match(/(\d+)/)
        return match ? Number(match[1]) : 0
    })

    const averagePercent = percentages.length
        ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
        : 0

    let highestRow = numericRows[0]
    numericRows.forEach((row) => {
        const current = Number(row.obtainedMarks)
        const highest = Number(highestRow?.obtainedMarks ?? 0)
        if (current > highest) highestRow = row
    })

    const overallGrade = averagePercent
        ? getGradeFromPercentage(averagePercent)
        : '—'

    const encouragementName = getEncouragementName(studentId)

    return {
        examAppeared: approvedRows.length,
        averagePercent,
        highestMark: highestRow
            ? `${highestRow.obtainedMarks}/${highestRow.totalMarks}`
            : '—',
        highestSubject: highestRow?.subject ?? '—',
        overallGrade,
        encouragementName,
    }
}

export const getSessionDisplayLabel = (session) =>
    `${session.exam} — ${formatClassLabel(session.className)} Section ${session.section} — ${session.subject}`

export const isSessionLocked = (session) =>
    session?.status === 'submitted'
    && (session.approvalStatus === 'Pending' || session.approvalStatus === 'Approved')

export const getSessionStatusLabel = (session) => {
    if (session?.status !== 'submitted') return 'Draft'
    if (session.approvalStatus === 'Pending') return 'Pending Director Approval'
    if (session.approvalStatus === 'Approved') return 'Approved'
    if (session.approvalStatus === 'Rejected') return 'Rejected — Revise & Resubmit'
    return 'Submitted'
}

export const getSessionStatusColor = (session) => {
    if (session?.status !== 'submitted') return 'bg-[#FF980033] text-[#FF9800]'
    if (session.approvalStatus === 'Pending') return 'bg-[#2196F333] text-[#2196F3]'
    if (session.approvalStatus === 'Approved') return 'bg-[#4CAF5033] text-[#4CAF50]'
    if (session.approvalStatus === 'Rejected') return 'bg-[#FF000033] text-[#FF0000]'
    return 'bg-[#66708533] text-[#667085]'
}
