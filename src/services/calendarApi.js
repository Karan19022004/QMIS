import { apiRequest, getAccessToken, isApiCalendarEnabled } from './apiClient'

export const canUseCalendarApi = () => isApiCalendarEnabled() && Boolean(getAccessToken())

export const listCalendarApi = () => apiRequest('/calendar')
