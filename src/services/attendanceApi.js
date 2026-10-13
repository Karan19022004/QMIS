import { apiRequest } from './apiClient'

/** @returns {Promise<Array<object>>} */
export async function listAttendanceApi({ date, className, section, roster = false } = {}) {
    const qs = new URLSearchParams()
    if (date) qs.set('date', date)
    if (className) qs.set('className', className)
    if (section) qs.set('section', section)
    if (roster) qs.set('roster', 'true')
    const rows = await apiRequest(`/attendance?${qs}`)
    return Array.isArray(rows) ? rows : []
}

/** @returns {Promise<Array<object>>} */
export async function upsertAttendanceApi(payload) {
    return apiRequest('/attendance', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

/** @returns {Promise<Record<string, string>>} P/A/H map */
export async function studentAttendanceCalendarApi(studentId, year, month) {
    return apiRequest(`/attendance/students/${studentId}/calendar?year=${year}&month=${month}`)
}
