import { apiRequest, getAccessToken, isApiDashboardEnabled } from './apiClient'

export const canUseDashboardApi = () => isApiDashboardEnabled() && Boolean(getAccessToken())

export const getAdminDashboardApi = () => apiRequest('/admin/dashboard')
