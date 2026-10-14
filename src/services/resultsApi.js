import { apiRequest, getAccessToken, isApiAuthEnabled } from './apiClient'

export const canUseResultsApi = () => isApiAuthEnabled() && Boolean(getAccessToken())

export const getStudentResultsApi = (studentId) =>
    apiRequest(`/results/students/${encodeURIComponent(studentId)}`)
