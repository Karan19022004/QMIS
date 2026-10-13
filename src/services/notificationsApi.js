import { apiRequest, getAccessToken, isApiNotificationsEnabled } from './apiClient'

export const canUseNotificationsApi = () => isApiNotificationsEnabled() && Boolean(getAccessToken())

export const listNotificationsApi = () => apiRequest('/notifications')

export const markNotificationReadApi = (id) => apiRequest(`/notifications/${id}/read`, { method: 'POST' })
