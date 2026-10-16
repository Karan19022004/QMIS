import { apiRequest, getAccessToken, isApiAuthEnabled } from './apiClient'

/** True when the signed-in session can load own HR attendance. */
export const canUseMyAttendanceApi = () => isApiAuthEnabled() && Boolean(getAccessToken())

const DASH = '—'

const clockOrDash = (value) => {
    const text = String(value ?? '').trim()
    return /\d/.test(text) ? text : DASH
}

const formatDisplayDate = (value) => {
    const text = String(value ?? '').trim()
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
    if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`
    const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text)
    if (dmy) return `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${dmy[3]}`
    return text || DASH
}

const mapMineRow = (item, index) => ({
    id: String(item.id ?? `mine-${index}`),
    employeeId: String(item.employeeId || DASH),
    name: String(item.employeeName || item.name || DASH),
    date: formatDisplayDate(item.date),
    inTime: clockOrDash(item.punchIn) !== DASH ? clockOrDash(item.punchIn) : clockOrDash(item.checkIn),
    outTime: clockOrDash(item.punchOut) !== DASH ? clockOrDash(item.punchOut) : clockOrDash(item.checkOut),
    attendanceStatus: String(item.status || DASH),
    source: 'api',
})

/**
 * Own attendance only (GET /hr/attendance/mine). Server scopes by linked HrEmployee
 * (user_id or matching email) — never returns another staff member's punches.
 *
 * Link diagnosis uses the campus employee directory email match (hr.employees.read / hr.self).
 * It never pulls campus-wide /hr/attendance into this screen.
 *
 * @param {string} [sessionEmail] signed-in user email from AuthContext
 * @returns {Promise<{ records: object[], linkStatus: 'unlinked'|'linked_empty'|'linked_with_rows'|'unknown', linkedEmployeeId: string|null }>}
 */
export const loadMyAttendanceBundle = async (sessionEmail = '') => {
    const [mineResult, employeesResult] = await Promise.allSettled([
        apiRequest('/hr/attendance/mine'),
        apiRequest('/hr/portal/employees'),
    ])
    if (mineResult.status === 'rejected') throw mineResult.reason

    const records = (Array.isArray(mineResult.value) ? mineResult.value : []).map(mapMineRow)
    const email = String(sessionEmail || '').trim().toLowerCase()
    let linkedEmployeeId = null
    let linkStatus = 'unknown'

    if (employeesResult.status === 'fulfilled' && email) {
        const match = (Array.isArray(employeesResult.value) ? employeesResult.value : []).find(
            (row) => String(row.email || '').trim().toLowerCase() === email,
        )
        if (match) {
            linkedEmployeeId = String(match.id || '')
            linkStatus = records.length > 0 ? 'linked_with_rows' : 'linked_empty'
        } else {
            linkStatus = 'unlinked'
        }
    } else if (records.length > 0) {
        linkStatus = 'linked_with_rows'
        linkedEmployeeId = records[0].employeeId !== DASH ? records[0].employeeId : null
    }

    return { records, linkStatus, linkedEmployeeId }
}

/** @deprecated prefer loadMyAttendanceBundle for link diagnosis */
export const listMyAttendanceApi = async () => {
    const bundle = await loadMyAttendanceBundle()
    return bundle.records
}
