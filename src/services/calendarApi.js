import { apiRequest, getAccessToken, isApiCalendarEnabled } from './apiClient'

export const canUseCalendarApi = () => isApiCalendarEnabled() && Boolean(getAccessToken())

const enc = encodeURIComponent

export const listCalendarApi = () => apiRequest('/calendar')

/** Body: type, title, startDate, endDate?, description? */
export const createCalendarApi = ({ type, title, startDate, endDate, description }) =>
    apiRequest('/calendar', {
        method: 'POST',
        body: {
            type,
            title,
            startDate,
            ...(endDate ? { endDate } : {}),
            ...(description != null ? { description } : {}),
        },
    })

/** Body fields optional: type, title, startDate, endDate?, description? */
export const updateCalendarApi = (ref, patch) =>
    apiRequest(`/calendar/${enc(ref)}`, {
        method: 'PATCH',
        body: patch,
    })

export const deleteCalendarApi = (ref) =>
    apiRequest(`/calendar/${enc(ref)}`, { method: 'DELETE' })
