import { apiRequest } from './apiClient'

/** Parents of students visible to the signed-in staff (grade-band filtered for coordinators). */
export async function listStaffParentsApi() {
    const rows = await apiRequest('/parents')
    return Array.isArray(rows) ? rows : []
}
