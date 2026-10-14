import { apiRequest, getAccessToken, isApiAnnouncementsEnabled } from './apiClient'

/** True when announcements come from the server (never the browser). */
export const canUseAnnouncementsApi = () => isApiAnnouncementsEnabled() && Boolean(getAccessToken())

const enc = encodeURIComponent

export const listAnnouncementsApi = () => apiRequest('/announcements')

export const getAnnouncementApi = (ref) => apiRequest(`/announcements/${enc(ref)}`)

/** `announcementDate` is an ISO date (yyyy-mm-dd); `file` is optional. */
export const createAnnouncementApi = ({ title, category, message, announcementDate, file }) => {
    const body = new FormData()
    body.append('title', title)
    body.append('category', category)
    body.append('message', message)
    if (announcementDate) body.append('announcement_date', announcementDate)
    if (file) body.append('file', file)
    return apiRequest('/announcements', { method: 'POST', body, formData: true })
}

export const acknowledgeAnnouncementApi = (ref) =>
    apiRequest(`/announcements/${enc(ref)}/acknowledge`, { method: 'POST' })

export const replyToAnnouncementApi = (ref, text) =>
    apiRequest(`/announcements/${enc(ref)}/replies`, { method: 'POST', body: { text } })
