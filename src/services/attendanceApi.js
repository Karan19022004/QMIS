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

/**
 * Classes/sections the signed-in user may load and mark on ``date`` (YYYY-MM-DD; default today).
 * Substitute-duty sections appear only while that duty is valid for the date and current period.
 */
export async function listMyAttendanceClassesApi(date) {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : ''
    const data = await apiRequest(`/attendance/my-classes${suffix}`)
    return {
        scoped: Boolean(data?.scoped),
        classes: Array.isArray(data?.classes) ? data.classes : [],
        substituteDuties: Array.isArray(data?.substituteDuties) ? data.substituteDuties : [],
    }
}

/** @returns {Promise<Array<object>>} */
export async function upsertAttendanceApi(payload) {
    return apiRequest('/attendance', {
        method: 'POST',
        body: payload,
    })
}

/** @returns {Promise<Record<string, string>>} P/A/H map */
export async function studentAttendanceCalendarApi(studentId, year, month) {
    return apiRequest(`/attendance/students/${studentId}/calendar?year=${year}&month=${month}`)
}
