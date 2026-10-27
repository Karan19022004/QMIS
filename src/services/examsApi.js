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
export async function updateExamApi(examId, body) {
    return apiRequest(`/exams/${examId}`, { method: 'PUT', body })
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

/** @returns {Promise<object>} */
export async function getMarksBatchApi(batchId) {
    return apiRequest(`/marks-batches/${batchId}`)
}

/** @returns {Promise<object>} */
export async function updateMarksBatchEntriesApi(batchId, entries) {
    return apiRequest(`/marks-batches/${batchId}/entries`, {
        method: 'PUT',
        body: { entries },
    })
}

/** @returns {Promise<object>} */
export async function submitMarksBatchApi(batchId) {
    return apiRequest(`/marks-batches/${batchId}/submit`, { method: 'POST' })
}

export function mapExamFromApi(row) {
    return {
        id: String(row.id),
        name: row.name || '',
        examType: row.examType || row.exam_type || '',
        examTypeName: row.examTypeName || row.exam_type_name || '',
        className: row.className || row.class_name || '',
        section: row.section || '',
        academicYear: row.academicYear || row.academic_year || '',
        teacherName: row.teacherName || row.teacher_name || '',
        startDate: row.startDate || row.start_date || '',
        endDate: row.endDate || row.end_date || '',
        status: row.status || '',
        approvalId: row.approvalId || row.approval_id || null,
        timelines: Array.isArray(row.timelines) ? row.timelines : [],
        source: 'api',
    }
}

export function mapMarksBatchFromApi(row) {
    return {
        id: String(row.id),
        examId: row.examId || row.exam_id || '',
        examName: row.examName || row.exam_name || '',
        className: row.className || row.class_name || '',
        subject: row.subject || '',
        section: row.section || '',
        maxMarks: row.maxMarks ?? row.max_marks ?? null,
        status: row.status || '',
        entries: Array.isArray(row.entries)
            ? row.entries.map((entry) => ({
                  studentId: String(entry.studentId || entry.student_id || ''),
                  studentName: entry.studentName || entry.student_name || '',
                  admissionNumber: entry.admissionNumber || entry.admission_number || '',
                  marks: entry.marks ?? null,
                  absent: Boolean(entry.absent),
                  remarks: entry.remarks || '',
              }))
            : [],
        source: 'api',
    }
}
