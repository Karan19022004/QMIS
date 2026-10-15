import { apiRequest, getAccessToken, isApiAuthEnabled } from './apiClient'

export const canUseExamsApi = () => isApiAuthEnabled() && Boolean(getAccessToken())

/** @returns {Promise<Array<object>>} */
export async function listExamsApi(params = {}) {
    const qs = new URLSearchParams()
    if (params.className) qs.set('className', params.className)
    if (params.status) qs.set('status', params.status)
    const suffix = qs.toString() ? `?${qs}` : ''
    const rows = await apiRequest(`/exams${suffix}`)
    return Array.isArray(rows) ? rows : []
}

/** @returns {Promise<object>} */
export async function getExamApi(examId) {
    return apiRequest(`/exams/${examId}`)
}

/** @returns {Promise<object>} */
export async function createExamApi(body) {
    return apiRequest('/exams', { method: 'POST', body })
}

/** @returns {Promise<object>} */
export async function submitExamApi(examId) {
    return apiRequest(`/exams/${examId}/submit`, { method: 'POST' })
}

/** @returns {Promise<Array<object>>} */
export async function listMarksBatchesApi(params = {}) {
    const qs = new URLSearchParams()
    if (params.examId) qs.set('examId', params.examId)
    if (params.status) qs.set('status', params.status)
    if (params.mine) qs.set('mine', 'true')
    const suffix = qs.toString() ? `?${qs}` : ''
    const rows = await apiRequest(`/marks-batches${suffix}`)
    return Array.isArray(rows) ? rows : []
}

/** @returns {Promise<object>} */
export async function createMarksBatchApi(body) {
    return apiRequest('/marks-batches', { method: 'POST', body })
}

export function mapExamFromApi(row) {
    return {
        id: String(row.id),
        name: row.name || '',
        examType: row.examType || row.exam_type || '',
        className: row.className || row.class_name || '',
        startDate: row.startDate || row.start_date || '',
        endDate: row.endDate || row.end_date || '',
        status: row.status || '',
        source: 'api',
    }
}

export function mapMarksBatchFromApi(row) {
    return {
        id: String(row.id),
        examId: row.examId || row.exam_id || '',
        subject: row.subject || '',
        section: row.section || '',
        maxMarks: row.maxMarks ?? row.max_marks ?? null,
        status: row.status || '',
        entries: Array.isArray(row.entries) ? row.entries : [],
        source: 'api',
    }
}
