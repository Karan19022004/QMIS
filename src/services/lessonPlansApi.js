import { apiRequest, getAccessToken, isApiAuthEnabled } from './apiClient'

export const canUseLessonPlansApi = () => isApiAuthEnabled() && Boolean(getAccessToken())

/** @returns {Promise<Array<object>>} */
export async function listLessonPlansApi(params = {}) {
    const qs = new URLSearchParams()
    if (params.month) qs.set('month', params.month)
    if (params.className) qs.set('className', params.className)
    if (params.status) qs.set('status', params.status)
    if (params.mine) qs.set('mine', 'true')
    const suffix = qs.toString() ? `?${qs}` : ''
    const rows = await apiRequest(`/lesson-plans${suffix}`)
    return Array.isArray(rows) ? rows : []
}

/** @returns {Promise<object>} */
export async function getLessonPlanApi(planId) {
    return apiRequest(`/lesson-plans/${planId}`)
}

/** @returns {Promise<object>} */
export async function createLessonPlanApi(body) {
    return apiRequest('/lesson-plans', { method: 'POST', body })
}

/** @returns {Promise<object>} */
export async function submitLessonPlanApi(planId) {
    return apiRequest(`/lesson-plans/${planId}/submit`, { method: 'POST' })
}

/** @returns {Promise<object>} */
export async function completeLessonPlanApi(planId, remarks = '') {
    return apiRequest(`/lesson-plans/${planId}/complete`, {
        method: 'POST',
        body: { remarks: String(remarks || '').trim() },
    })
}

/** Map API lesson plan → existing Teacher/Coordinator UI record shape. */
export function mapLessonPlanFromApi(row) {
    const content = row.content && typeof row.content === 'object' ? row.content : {}
    const status = String(row.status || '').toLowerCase()
    let approvalStatus = 'Pending'
    if (status === 'approved') approvalStatus = 'Approved'
    else if (status === 'denied' || status === 'rejected') approvalStatus = 'Rejected'
    else if (status === 'draft') approvalStatus = 'Draft'

    const markAsDone = Boolean(content.markAsDone)
    let trackStatus = content.trackStatus || 'On Track'
    if (markAsDone) trackStatus = 'Completed'
    else if (!content.trackStatus && approvalStatus === 'Approved') trackStatus = 'On Track'

    return {
        id: String(row.id),
        subject: row.subject || content.subject || '',
        submitterName: content.submitterName || row.teacherName || row.teacherEmail || '',
        submitterRole: content.submitterRole || 'Teacher',
        className: row.className || '',
        section: row.section || '',
        title: row.title || content.title || content.chapterName || '',
        academicYear: content.academicYear || '',
        month: row.month || content.month || '',
        weekNo: content.weekNo || '',
        numberOfSessions: content.numberOfSessions || '',
        chapterName: content.chapterName || row.title || '',
        planningRows: Array.isArray(content.planningRows) ? content.planningRows : [],
        specialAttention: content.specialAttention || '',
        classroomSetup: content.classroomSetup || '',
        teacherNotes: content.teacherNotes || '',
        reflection: content.reflection || '',
        subjectMentor: content.subjectMentor || '',
        evaluator: content.evaluator || '',
        coordinatorSignoff: content.coordinatorSignoff || '',
        sdgPlanned: content.sdgPlanned || '',
        sdcPlanned: content.sdcPlanned || '',
        worksheetsPlanned: content.worksheetsPlanned || '',
        description: content.description || row.title || '',
        fromDate: content.fromDate || '',
        toDate: content.toDate || '',
        submittedAt: row.createdAt || row.submittedAt || '',
        approvalStatus,
        trackStatus,
        markAsDone,
        completionRemarks: content.completionRemarks || '',
        attachment: row.fileId ? String(row.fileId) : content.attachment || '',
        approvalId: row.approvalId || row.approval_id || null,
        awaitingRole: row.awaitingRole || row.awaiting_role || null,
        campusStatus: status,
        source: 'api',
    }
}
