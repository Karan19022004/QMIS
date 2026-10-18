import { apiRequest } from './apiClient'

export async function listPendingPlacementApi() {
    const rows = await apiRequest('/students/pending-placement')
    return Array.isArray(rows) ? rows : []
}

/** Sections for a class (server ensures Grade N + A/B/C exist for the current year). */
export async function getPlacementOptionsApi(className) {
    const qs = new URLSearchParams({ className: String(className || '').trim() || 'Grade 1' })
    return apiRequest(`/students/placement-options?${qs}`)
}

/** Next grade only + sections for promote. */
export async function getPromoteOptionsApi(studentId) {
    return apiRequest(`/students/promote-options/${studentId}`)
}

export async function listCoordinatorGradeBandsApi() {
    const rows = await apiRequest('/students/coordinator-grade-bands')
    return Array.isArray(rows) ? rows : []
}

export async function upsertCoordinatorGradeBandApi({ userId, gradeFrom, gradeTo }) {
    return apiRequest('/students/coordinator-grade-bands', {
        method: 'PUT',
        body: { userId, gradeFrom, gradeTo },
    })
}

export async function listPlacedStudentsApi() {
    const rows = await apiRequest('/students/placed')
    return Array.isArray(rows) ? rows : []
}

export async function getMyGradeBandApi() {
    return apiRequest('/students/my-grade-band')
}

export async function placeStudentApi(studentId, sectionId) {
    return apiRequest(`/students/${studentId}/place`, {
        method: 'POST',
        body: { sectionId },
    })
}

export async function promoteStudentApi(studentId, { targetClassId, targetSectionId, academicYearId }) {
    return apiRequest(`/students/${studentId}/promote`, {
        method: 'POST',
        body: {
            targetClassId,
            targetSectionId,
            academicYearId: academicYearId || null,
        },
    })
}
