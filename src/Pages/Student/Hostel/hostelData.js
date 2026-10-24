/**
 * Hostel assignments + payments — campus ops SoT.
 * API: /api/v1/ops/hostel-assignments + hostel-payments
 * Student/parent scoped read: GET /api/v1/ops/my-hostel
 */
import { apiRequest, getAccessToken, isApiAuthEnabled } from '../../../services/apiClient'
import {
    ensureCampusSeed,
    hydrateCampusKey,
    loadCampusJson,
    usesCampusApiForKey,
} from '../../../services/campusJsonStore'

export const HOSTEL_ASSIGNMENTS_KEY = 'schoolerp-hostel-assignments-v1'
export const HOSTEL_PAYMENTS_KEY = 'schoolerp-hostel-payments-v1'

const seedFor = () => []

const norm = (value) => String(value || '').trim().toLowerCase()

const studentKeys = (student) => {
    if (!student) return new Set()
    return new Set(
        [
            student.id,
            student.studentId,
            student.admissionNumber,
            student.admissionNo,
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean),
    )
}

export const matchHostelRow = (row, student) => {
    if (!row || !student) return false
    const keys = studentKeys(student)
    const rowKeys = [
        row.studentId,
        row.student_id,
        row.admissionNumber,
        row.admissionNo,
        row.admission_number,
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    if (rowKeys.some((key) => keys.has(key))) return true

    const name = norm(student.name)
    if (name && norm(row.studentName) === name) {
        const klass = norm(student.classSection || `${student.className || ''}-${student.section || ''}`)
        if (!klass) return true
        const rowClass = norm(row.classSection || row.className || '')
        return !rowClass || rowClass.replace(/\s+/g, '') === klass.replace(/\s+/g, '') || rowClass === klass
    }
    return false
}

export function getHostelAssignments() {
    return ensureCampusSeed(HOSTEL_ASSIGNMENTS_KEY, seedFor())
}

export function getHostelPayments() {
    return ensureCampusSeed(HOSTEL_PAYMENTS_KEY, seedFor())
}

export function findHostelAssignment(student, rows = getHostelAssignments()) {
    if (!student?.id && !student?.admissionNumber && !student?.admissionNo) return null
    const list = Array.isArray(rows) ? rows : []
    return list.find((row) => matchHostelRow(row, student) && !isInactive(row)) || null
}

export function findHostelPayments(student, rows = getHostelPayments()) {
    if (!student?.id && !student?.admissionNumber && !student?.admissionNo) return []
    const list = Array.isArray(rows) ? rows : []
    return list.filter((row) => matchHostelRow(row, student))
}

const isInactive = (row) => /^(inactive|released|vacated|cancelled)$/i.test(String(row?.status || ''))

export async function hydrateHostelFromApi() {
    const tasks = []
    if (usesCampusApiForKey(HOSTEL_ASSIGNMENTS_KEY)) {
        tasks.push(hydrateCampusKey(HOSTEL_ASSIGNMENTS_KEY, []))
    }
    if (usesCampusApiForKey(HOSTEL_PAYMENTS_KEY)) {
        tasks.push(hydrateCampusKey(HOSTEL_PAYMENTS_KEY, []))
    }
    if (!tasks.length) return false
    await Promise.all(tasks)
    return true
}

const readLocal = (key) => {
    const mem = loadCampusJson(key, [])
    return Array.isArray(mem) ? mem : []
}

/**
 * Load hostel SoT for the active student.
 * Prefers GET /ops/my-hostel (student/parent), then campus ops collections.
 */
export async function loadHostelBundle(student) {
    if (isApiAuthEnabled() && getAccessToken()) {
        try {
            const payload = await apiRequest('/ops/my-hostel')
            const assignments = Array.isArray(payload?.assignments) ? payload.assignments : []
            const payments = Array.isArray(payload?.payments) ? payload.payments : []
            return { assignments, payments, source: 'my-hostel' }
        } catch {
            /* Student/parent may lack ops.read — fall through to campus store. */
        }
        await hydrateHostelFromApi()
        return {
            assignments: readLocal(HOSTEL_ASSIGNMENTS_KEY),
            payments: readLocal(HOSTEL_PAYMENTS_KEY),
            source: 'ops',
        }
    }
    await hydrateHostelFromApi()
    return {
        assignments: getHostelAssignments(),
        payments: getHostelPayments(),
        source: 'local',
    }
}

export function formatHostelAmount(value) {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return String(value || '—')
    return `₹${amount.toLocaleString('en-IN')}`
}

export const hostelPaymentStatusColor = {
    Paid: 'bg-[#4CAF5033] text-[#4CAF50]',
    Partial: 'bg-[#FF980033] text-[#FF9800]',
    Due: 'bg-[#2196F333] text-[#2196F3]',
    Overdue: 'bg-[#FF000033] text-[#FF0000]',
    Waived: 'bg-[#66708533] text-[#667085]',
}
