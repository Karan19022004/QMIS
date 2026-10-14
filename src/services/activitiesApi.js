import { apiRequest, getAccessToken, isApiActivitiesEnabled } from './apiClient'

export const canUseActivitiesApi = () => isApiActivitiesEnabled() && Boolean(getAccessToken())

const enc = encodeURIComponent

export const listActivitiesApi = (type) =>
    apiRequest(type ? `/activities?type=${enc(type)}` : '/activities')

export const getActivityApi = (ref) => apiRequest(`/activities/${enc(ref)}`)

export const createActivityApi = (body) => apiRequest('/activities', { method: 'POST', body })

export const updateActivityApi = (ref, body) => apiRequest(`/activities/${enc(ref)}`, { method: 'PATCH', body })

export const deleteActivityApi = (ref) => apiRequest(`/activities/${enc(ref)}`, { method: 'DELETE' })

export const approveActivityApi = (ref, status) =>
    apiRequest(`/activities/${enc(ref)}/approval`, { method: 'POST', body: { status } })
