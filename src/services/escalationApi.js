import { apiRequest, getAccessToken, isApiEscalationsEnabled } from './apiClient'

/** True when the escalation API should be used (flag on and a real backend session exists). */
export const canUseEscalationsApi = () => isApiEscalationsEnabled() && Boolean(getAccessToken())

export const listEscalationsApi = (box = 'mine') => apiRequest(`/escalations?box=${encodeURIComponent(box)}`)

export const getEscalationApi = (id) => apiRequest(`/escalations/${id}`)

export const listEscalationRecipientsApi = () => apiRequest('/escalations/recipients')

export const raiseEscalationApi = ({ description, fullDescription, remarks, recipientUserId }) =>
    apiRequest('/escalations', {
        method: 'POST',
        body: {
            description,
            fullDescription: fullDescription || null,
            remarks: remarks || null,
            recipientUserId: recipientUserId || null,
        },
    })

export const setEscalationStatusApi = (id, status, note) =>
    apiRequest(`/escalations/${id}/status`, { method: 'POST', body: { status, note: note || null } })
